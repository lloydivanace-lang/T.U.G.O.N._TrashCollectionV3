import { WasteReport, PiStatus, SavedLogBook, TelegramBotStatus } from '../types';
import { BRGY_41_HALL_COORDS, evaluateJurisdiction } from './jurisdiction';
import { formatTicketNumber, canonicalTicketKey, isValidPhotoSrc } from './imageCompressor';

const BARE_TUNNEL_ROOTS = new Set([
  'ngrok.dev',
  'www.ngrok.dev',
  'ngrok.com',
  'www.ngrok.com',
  'ngrok.app',
  'ngrok-free.app',
  'ngrok-free.dev',
  'ngrok.io',
  'trycloudflare.com',
  'cloudflare.com',
  'www.cloudflare.com',
  'loca.lt',
  'ts.net',
  'pages.dev',
  'workers.dev',
]);

export function isLocalLanUrl(urlOrHost: string): boolean {
  try {
    const cleaned = urlOrHost.trim();
    if (!cleaned) return false;
    const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`;
    const parsed = new URL(withProto);
    const h = parsed.hostname.toLowerCase();
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h.endsWith('.local') ||
      h.startsWith('192.168.') ||
      h.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
    );
  } catch {
    return false;
  }
}

function isPublicTunnelHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.endsWith('.ngrok-free.dev') ||
    h.endsWith('.ngrok-free.app') ||
    h.endsWith('.ngrok.dev') ||
    h.endsWith('.ngrok.app') ||
    h.endsWith('.ngrok.io') ||
    h.endsWith('.trycloudflare.com') ||
    h.endsWith('.ts.net') ||
    h.endsWith('.loca.lt')
  );
}

export function isBareTunnelRootDomain(rawInput: string): boolean {
  try {
    const cleaned = rawInput.trim().replace(/^["'`|]+|["'`|]+$/g, '').trim();
    if (!cleaned) return false;
    const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const parsed = new URL(withProto);
    return BARE_TUNNEL_ROOTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isValidPiUrlSyntax(cleanUrl: string): boolean {
  if (!cleanUrl || isBareTunnelRootDomain(cleanUrl)) return false;
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const h = parsed.hostname.toLowerCase();
    if (!h) return false;
    if (typeof window !== 'undefined' && window.location?.origin) {
      if (parsed.origin.toLowerCase() === window.location.origin.toLowerCase()) {
        return false;
      }
    }
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':');
    const isLocal = h === 'localhost' || h.endsWith('.local');
    const hasValidDomain =
      h.includes('.') && /\.[a-z]{2,}$/i.test(h) && !h.startsWith('.') && !h.endsWith('.');
    return isIp || isLocal || hasValidDomain;
  } catch {
    return false;
  }
}

export function isValidPiHealthPayload(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (parsed.online === false || parsed.ok === false || parsed.healthy === false) return false;
  const statusStr = String(parsed.status ?? parsed.state ?? '').trim().toLowerCase();
  if (['offline', 'error', 'down', 'dead', 'disconnected', 'fail', 'failed'].includes(statusStr)) {
    return false;
  }
  if (parsed.error && !statusStr && parsed.online !== true && parsed.ok !== true) {
    return false;
  }
  const positiveStatuses = [
    'online',
    'active',
    'ok',
    'healthy',
    'running',
    'up',
    'ready',
    'connected',
    'live',
    'success',
  ];
  if (positiveStatuses.includes(statusStr)) return true;
  if (
    parsed.online === true ||
    parsed.ok === true ||
    parsed.healthy === true ||
    parsed.active === true
  ) {
    return true;
  }
  if (
    parsed.storage_folder ||
    parsed.hardware ||
    parsed.system ||
    parsed.disk_total ||
    parsed.cpu_temp ||
    typeof parsed.reports_count === 'number'
  ) {
    return true;
  }
  return false;
}

export function detectPiConnectionMethod(url: string): string {
  const lower = (url || '').toLowerCase();
  if (!lower) return 'None';
  if (lower.includes('ngrok')) return 'ngrok Domain Tunnel';
  if (lower.includes('trycloudflare') || lower.includes('cloudflare')) return 'Cloudflare Tunnel';
  if (lower.includes('.ts.net') || lower.includes('tailscale')) return 'Tailscale Funnel';
  if (isLocalLanUrl(lower)) return 'Local Wi-Fi / LAN';
  return 'HTTPS Cloud Domain';
}

export function normalizeClientPiUrl(raw: string): string {
  if (!raw) return '';
  let u = raw.trim().replace(/^["'`|]+|["'`|]+$/g, '').trim();
  if (!u || (/\s/.test(u) && !/https?:\/\//i.test(u))) return '';

  // Extract clean URL if user copied an entire terminal line (e.g. "Forwarding https://xxx.ngrok-free.dev -> http://localhost:3000")
  const embeddedUrlMatch = u.match(
    /https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[^\s|"'<>]*)?/i
  );
  if (embeddedUrlMatch && (u.includes(' ') || u.includes('->') || u.includes('|'))) {
    const allMatches = u.match(/https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?/gi) || [];
    const publicTunnel = allMatches.find((m) => !isLocalLanUrl(m));
    u = publicTunnel || embeddedUrlMatch[0];
  }

  if (!/^https?:\/\//i.test(u)) {
    const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.|.*\.local)/i.test(u);
    if (isLocal) {
      const hasPort = /:\d+(\/|$)/.test(u);
      u = `http://${hasPort ? u : `${u.replace(/\/+$/, '')}:8000`}`;
    } else {
      u = `https://${u}`;
    }
  } else if (/^http:\/\//i.test(u) && !isLocalLanUrl(u)) {
    const isHttpsPage =
      typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const isKnownHttpsTunnel = /\.(ngrok\.dev|ngrok-free\.(app|dev)|ngrok\.(app|io)|trycloudflare\.com|ts\.net|pages\.dev|workers\.dev)(\/|:|$)/i.test(
      u
    );
    if (isHttpsPage || isKnownHttpsTunnel) {
      u = u.replace(/^http:\/\//i, 'https://');
    }
  }

  try {
    const parsed = new URL(u);
    if (isPublicTunnelHostname(parsed.hostname) && (parsed.port === '3000' || parsed.port === '8000')) {
      parsed.port = '';
      u = parsed.toString();
    }
  } catch {
    return '';
  }

  return u
    .replace(/\/api\/(health|storage|reports|logbooks|config|pi-status)\/?$/i, '')
    .replace(/\/test\.txt$/i, '')
    .replace(/\/+$/, '');
}

/**
 * Builds CORS-safe headers for direct browser-to-Pi requests.
 * IMPORTANT: Only sends headers listed in server.py's Access-Control-Allow-Headers
 * so preflight OPTIONS requests never fail on older or newer server.py deployments.
 */
export function getPiHeaders(
  targetUrl = '',
  withJsonContentType = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const lower = targetUrl.toLowerCase();
  if (lower.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  } else if (lower.includes('loca.lt')) {
    headers['Bypass-Tunnel-Reminder'] = 'true';
  }
  if (withJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export const CLIENT_PI_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

export function getStoredPiEndpoint(): string {
  try {
    // 1. Check URL query string (?pi=https://... or ?server=https://...) for instant link binding
    if (typeof window !== 'undefined' && window.location?.search) {
      const sp = new URLSearchParams(window.location.search);
      const queryPi = sp.get('pi') || sp.get('server') || sp.get('pi_url');
      if (queryPi) {
        const normalizedQuery = normalizeClientPiUrl(queryPi);
        if (normalizedQuery && !isBareTunnelRootDomain(normalizedQuery)) {
          localStorage.setItem('pulse_pi_endpoint', normalizedQuery);
          return normalizedQuery;
        }
      }
    }

    // 2. Check browser localStorage
    const raw = localStorage.getItem('pulse_pi_endpoint') || '';
    const clean = normalizeClientPiUrl(raw);
    if (clean && !isBareTunnelRootDomain(clean)) {
      return clean;
    }

    // 3. Check build-time Vite environment variable (Cloudflare Pages / Workers / GitHub Actions)
    const envUrl = (import.meta as any)?.env?.VITE_PI_SERVER_URL || '';
    const cleanEnv = normalizeClientPiUrl(envUrl);
    if (cleanEnv && !isBareTunnelRootDomain(cleanEnv)) {
      return cleanEnv;
    }

    return '';
  } catch {
    return '';
  }
}

export function setStoredPiEndpoint(url: string): void {
  try {
    const clean = normalizeClientPiUrl(url);
    if (clean && !isBareTunnelRootDomain(clean)) {
      localStorage.setItem('pulse_pi_endpoint', clean);
    } else if (!url.trim()) {
      localStorage.removeItem('pulse_pi_endpoint');
    }
  } catch {}
}

export function buildShareablePortalUrl(piUrl?: string): string {
  const cleanPi = normalizeClientPiUrl(piUrl || getStoredPiEndpoint());
  if (typeof window === 'undefined') return cleanPi;
  const base = `${window.location.origin}${window.location.pathname}`;
  if (!cleanPi) return base;
  return `${base}?pi=${encodeURIComponent(cleanPi)}`;
}

async function safePortalApiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = 7000
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  headers: Headers | null;
  isStaticFallback: boolean;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const activePi = getStoredPiEndpoint();
    const mergedHeaders = new Headers(init.headers || {});
    if (!mergedHeaders.has('Accept')) {
      mergedHeaders.set('Accept', 'application/json');
    }
    if (activePi && !mergedHeaders.has('X-Pi-Endpoint')) {
      mergedHeaders.set('X-Pi-Endpoint', activePi);
    }

    const res = await fetch(path, {
      ...init,
      headers: mergedHeaders,
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // On static hosts (Cloudflare Workers Static Assets, GitHub Pages), /api/* returns HTML index.html or 404/405
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        status: res.status,
        data: null,
        headers: res.headers,
        isStaticFallback: true,
      };
    }

    const data = await res.json().catch(() => null);
    if (data && (data.edgeUnhandled || data.edgeNeedsDirectClient)) {
      return {
        ok: false,
        status: res.status,
        data,
        headers: res.headers,
        isStaticFallback: true,
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      data,
      headers: res.headers,
      isStaticFallback: false,
    };
  } catch {
    clearTimeout(timer);
    return {
      ok: false,
      status: 0,
      data: null,
      headers: null,
      isStaticFallback: true,
    };
  }
}

export async function hydratePiEndpointOnBoot(): Promise<string> {
  const existing = getStoredPiEndpoint();

  // Clean ?pi= from address bar after capturing it so URL stays tidy
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      const urlObj = new URL(window.location.href);
      if (urlObj.searchParams.has('pi') || urlObj.searchParams.has('server')) {
        urlObj.searchParams.delete('pi');
        urlObj.searchParams.delete('server');
        window.history.replaceState({}, '', urlObj.pathname + urlObj.search + urlObj.hash);
      }
    }
  } catch {}

  // 1. Check /api/config (Express server or Cloudflare Pages Function Edge Cache)
  const apiCfg = await safePortalApiFetch('/api/config', {}, 3500);
  if (apiCfg.ok && apiCfg.data?.piServerUrl) {
    const remotePi = normalizeClientPiUrl(apiCfg.data.piServerUrl);
    if (remotePi && !existing) {
      setStoredPiEndpoint(remotePi);
      return remotePi;
    }
  }

  // 2. Check static /pi-config.json in public folder (for static GitHub / Cloudflare Workers builds)
  if (!existing) {
    try {
      const staticRes = await fetch('/pi-config.json', { cache: 'no-store' });
      const ct = (staticRes.headers.get('content-type') || '').toLowerCase();
      if (staticRes.ok && ct.includes('application/json')) {
        const staticJson = await staticRes.json();
        const candidate = normalizeClientPiUrl(staticJson?.piServerUrl || '');
        if (candidate && !isBareTunnelRootDomain(candidate)) {
          setStoredPiEndpoint(candidate);
          return candidate;
        }
      }
    } catch {}
  }

  return existing;
}

export async function probeDirectPiFromBrowser(
  rawUrl: string,
  timeoutMs = 5500
): Promise<{
  online: boolean;
  latencyMs: number;
  healthJson: any;
  connectionMethod: string;
  resolvedUrl?: string;
  errorDetail?: string;
}> {
  const cleanUrl = normalizeClientPiUrl(rawUrl);
  if (!cleanUrl || !isValidPiUrlSyntax(cleanUrl)) {
    return {
      online: false,
      latencyMs: 0,
      healthJson: null,
      connectionMethod: 'None',
    };
  }

  const hadExplicitPort = /:\d+(\/|$)/.test(rawUrl.trim());
  const candidates = [cleanUrl];
  if (isLocalLanUrl(cleanUrl) && !hadExplicitPort && cleanUrl.endsWith(':8000')) {
    candidates.push(cleanUrl.replace(/:8000$/, ':3000'));
  }

  for (const candidateUrl of candidates) {
    const start = Date.now();
    const trySingleProbe = async (useSimpleNoHeaderRequest: boolean) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${candidateUrl}/api/health`, {
          signal: ctrl.signal,
          headers: useSimpleNoHeaderRequest ? undefined : getPiHeaders(candidateUrl),
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        const text = await res.text();
        let healthJson: any = null;
        try {
          healthJson = JSON.parse(text);
        } catch {}
        if (isValidPiHealthPayload(healthJson)) {
          return {
            online: true,
            latencyMs: Math.max(1, Date.now() - start),
            healthJson,
            resolvedUrl: candidateUrl,
            connectionMethod: `${detectPiConnectionMethod(candidateUrl)} (Direct)`,
          };
        }
      } catch (err: any) {
        clearTimeout(timer);
        throw err;
      }
      return null;
    };

    try {
      const hit = await trySingleProbe(false);
      if (hit) return hit;
    } catch (err: any) {
      // Retry without custom headers (avoids OPTIONS preflight on servers that allow simple GET CORS)
      if (!candidateUrl.toLowerCase().includes('ngrok')) {
        try {
          const simpleHit = await trySingleProbe(true);
          if (simpleHit) return simpleHit;
        } catch {}
      }

      const isMixedContent =
        typeof window !== 'undefined' &&
        window.location?.protocol === 'https:' &&
        candidateUrl.startsWith('http://');
      if (isMixedContent && candidateUrl === candidates[candidates.length - 1]) {
        return {
          online: false,
          latencyMs: 0,
          healthJson: null,
          connectionMethod: detectPiConnectionMethod(candidateUrl),
          errorDetail:
            'Mixed Content blocked: HTTPS websites require an HTTPS tunnel link (e.g. https://your-domain.ngrok-free.dev or https://xxxx.trycloudflare.com) rather than http://192.168.x.x.',
        };
      }
      if (candidateUrl === candidates[candidates.length - 1]) {
        return {
          online: false,
          latencyMs: 0,
          healthJson: null,
          connectionMethod: detectPiConnectionMethod(candidateUrl),
          errorDetail: err?.message || 'Unreachable',
        };
      }
    }
  }

  return {
    online: false,
    latencyMs: 0,
    healthJson: null,
    connectionMethod: detectPiConnectionMethod(cleanUrl),
  };
}

/**
 * Non-destructive merge of two WasteReport arrays (keeps whichever copy has higher status/more proofs).
 */
export function mergeWasteReportArrays(
  listA: WasteReport[],
  listB: WasteReport[]
): WasteReport[] {
  const byId = new Map<string, WasteReport>();
  const rank = (r: WasteReport) => {
    if (r.status === 'RESOLVED') return 4;
    if (r.status === 'CANCELLED') return 3;
    if (r.status === 'DISPATCHED') return 2;
    return 1;
  };

  const pickBestPhotos = (primary?: string[], secondary?: string[]): string[] => {
    const validPrimary = Array.isArray(primary) ? primary.filter(isValidPhotoSrc) : [];
    const validSecondary = Array.isArray(secondary) ? secondary.filter(isValidPhotoSrc) : [];
    if (validPrimary.length >= validSecondary.length && validPrimary.length > 0) return validPrimary;
    if (validSecondary.length > 0) return validSecondary;
    if (Array.isArray(primary) && primary.length > 0) return primary;
    if (Array.isArray(secondary) && secondary.length > 0) return secondary;
    return [];
  };

  for (const item of [...listA, ...listB]) {
    if (!item || !item.id) continue;
    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, {
        ...item,
        ticketNumber: formatTicketNumber(item.ticketNumber),
      });
    } else {
      const scoreNew = rank(item) * 10 + (item.proofPhotos?.filter(isValidPhotoSrc).length || 0);
      const scorePrev = rank(prev) * 10 + (prev.proofPhotos?.filter(isValidPhotoSrc).length || 0);
      const winner = scoreNew >= scorePrev ? item : prev;
      const runnerUp = scoreNew >= scorePrev ? prev : item;
      byId.set(item.id, {
        ...runnerUp,
        ...winner,
        ticketNumber: formatTicketNumber(winner.ticketNumber || runnerUp.ticketNumber),
        photos: pickBestPhotos(winner.photos, runnerUp.photos),
        proofPhotos: pickBestPhotos(winner.proofPhotos, runnerUp.proofPhotos),
      });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function enrichClientReport(r: WasteReport, lang: 'tl' | 'en'): WasteReport {
  const coords = r.coordinates || { lat: BRGY_41_HALL_COORDS[0], lng: BRGY_41_HALL_COORDS[1] };
  const juris = evaluateJurisdiction(coords.lat, coords.lng, r.barangay || r.purok);
  const assignedBarangay =
    r.barangay || (juris.isWithinBrgy40 ? 'Barangay 40' : 'Barangay 41');

  const createdMs = new Date(r.createdAt || Date.now()).getTime();
  const resolvedMs = r.resolvedAt ? new Date(r.resolvedAt).getTime() : createdMs;
  const now = Date.now();
  const isResolvedOrCancelled = r.status === 'RESOLVED' || r.status === 'CANCELLED';
  const ttlMs = isResolvedOrCancelled ? 24 * 3600 * 1000 : 3 * 24 * 3600 * 1000;
  const anchorMs = isResolvedOrCancelled ? resolvedMs : createdMs;
  const remainingMs = Math.max(0, anchorMs + ttlMs - now);
  const isPurged = remainingMs <= 0;
  const hoursLeft = Math.ceil(remainingMs / (3600 * 1000));

  const purgeCountdownText = isPurged
    ? lang === 'en'
      ? 'Archived in permanent Pi logbook'
      : 'Naka-archive sa permanenteng Pi logbook'
    : lang === 'en'
    ? `Auto-purge from live map in ${hoursLeft}h (kept in logbook)`
    : `Auto-purge sa mapa sa loob ng ${hoursLeft} oras (mananatili sa logbook)`;

  const localizedTypes = (Array.isArray(r.wasteTypes) ? r.wasteTypes : ['Household Trash']).map(
    (wt) => (lang === 'en' && wt === 'Nangangailangan ng assistance' ? 'Special Assistance Needed' : wt)
  );

  return {
    ...r,
    ticketNumber: formatTicketNumber(r.ticketNumber),
    barangay: assignedBarangay,
    purok: r.purok || `${assignedBarangay}, Cavite City`,
    coordinates: coords,
    isWithinJurisdiction: r.isWithinJurisdiction ?? juris.isWithinJurisdiction,
    isWithinBrgy41: r.isWithinBrgy41 ?? assignedBarangay.includes('41'),
    photos: Array.isArray(r.photos) ? r.photos : [],
    proofPhotos: Array.isArray(r.proofPhotos) ? r.proofPhotos : [],
    wasteTypes: localizedTypes,
    severityLevel: r.severityLevel || 'MODERATE',
    isElderly: Boolean(r.isElderly),
    extraMessage: r.extraMessage || '',
    storageUsedMb:
      r.storageUsedMb ||
      +(((r.photos?.length || 0) * 0.8) + ((r.proofPhotos?.length || 0) * 0.75)).toFixed(2),
    isPurgedFromFeed: r.isPurgedFromFeed ?? isPurged,
    purgeRemainingMs: remainingMs,
    purgeCountdownText: r.purgeCountdownText || purgeCountdownText,
  };
}

/**
 * Direct Browser-to-LAN / Tunnel Bridge
 */
export async function probeAndBridgeLanPi(
  rawUrl: string,
  syncReports = false
): Promise<{ healthJson: any; latencyMs: number } | null> {
  const cleanUrl = normalizeClientPiUrl(rawUrl);
  if (!cleanUrl || isBareTunnelRootDomain(cleanUrl)) return null;

  const direct = await probeDirectPiFromBrowser(cleanUrl, 4500);
  if (!direct.online) return null;

  let piReports: any[] = [];
  if (syncReports) {
    try {
      const repRes = await fetch(`${cleanUrl}/api/reports`, {
        headers: getPiHeaders(cleanUrl),
      });
      if (repRes.ok) {
        const parsed = await repRes.json();
        if (Array.isArray(parsed)) piReports = parsed;
      }
    } catch {}
  }

  const bridgeRes = await safePortalApiFetch(
    '/api/pi/client-bridge',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cleanUrl,
        piData: direct.healthJson,
        latencyMs: direct.latencyMs,
        piReports: syncReports ? piReports : undefined,
      }),
    },
    4000
  );

  if (syncReports && bridgeRes.ok && Array.isArray(bridgeRes.data?.reports)) {
    await fetch(`${cleanUrl}/api/reports/sync`, {
      method: 'POST',
      headers: getPiHeaders(cleanUrl, true),
      body: JSON.stringify(bridgeRes.data.reports),
    }).catch(() => null);
  }

  return { healthJson: direct.healthJson, latencyMs: direct.latencyMs };
}

/**
 * Unified Connect & Bind for RaspberryPiCenter.tsx:
 * Works on AI Studio Preview, Express Node, Cloudflare Pages Functions,
 * Cloudflare Workers Static Assets, and GitHub Pages!
 */
export async function pingAndConnectPiServer(
  rawUrl: string,
  lang: 'tl' | 'en'
): Promise<{
  success: boolean;
  online: boolean;
  normalizedUrl: string;
  latencyMs?: number;
  method?: string;
  message: string;
  error?: string;
}> {
  if (isBareTunnelRootDomain(rawUrl)) {
    const msg =
      lang === 'tl'
        ? 'Kulang ng sariling subdomain ang inilagay na link (halimbawa: https://pangalan-ng-pi.ngrok-free.dev o https://xxxx.trycloudflare.com). Pakikopya ang buong Forwarding URL mula sa ngrok o cloudflared.'
        : 'The link is missing your tunnel subdomain (e.g. https://your-pi.ngrok-free.dev or https://xxxx.trycloudflare.com). Please paste your full Forwarding URL from ngrok or cloudflared.';
    return {
      success: false,
      online: false,
      normalizedUrl: '',
      message: msg,
      error: msg,
    };
  }

  const cleanUrl = normalizeClientPiUrl(rawUrl);
  if (!cleanUrl || !isValidPiUrlSyntax(cleanUrl)) {
    const msg =
      lang === 'tl'
        ? 'Hindi valid ang inilagay na Cloud Server Link. Pakilagay ang tamang URL ng iyong Raspberry Pi server o tunnel.'
        : 'Invalid Cloud Server Link format. Please enter a valid Raspberry Pi server or tunnel URL.';
    return {
      success: false,
      online: false,
      normalizedUrl: '',
      message: msg,
      error: msg,
    };
  }

  // 1. Try server/edge /api/pi/ping first (Express Node, Cloudflare Pages Functions, or Cloudflare Workers Edge Bridge)
  const serverPing = await safePortalApiFetch(
    '/api/pi/ping',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, lang }),
    },
    7500
  );

  if (serverPing.ok && serverPing.data?.success && serverPing.data?.online) {
    const savedUrl = normalizeClientPiUrl(serverPing.data.normalizedUrl || cleanUrl);
    setStoredPiEndpoint(savedUrl);
    fetch(`${savedUrl}/api/config`, {
      method: 'POST',
      headers: getPiHeaders(savedUrl, true),
      body: JSON.stringify({ piServerUrl: savedUrl }),
    }).catch(() => null);

    return {
      success: true,
      online: true,
      normalizedUrl: savedUrl,
      latencyMs: serverPing.data.latencyMs,
      method: serverPing.data.method || detectPiConnectionMethod(savedUrl),
      message:
        lang === 'tl'
          ? `Konektado at Nai-save ang Cloud Server Link! (${serverPing.data.method || detectPiConnectionMethod(savedUrl)}, Bilis: ${serverPing.data.latencyMs}ms)`
          : `Cloud Server Link Connected & Saved! (${serverPing.data.method || detectPiConnectionMethod(savedUrl)}, Latency: ${serverPing.data.latencyMs}ms)`,
    };
  }

  // 2. Direct Browser-to-Cloud-Tunnel / LAN Probe (Works on Local Wi-Fi :3000/:8000 and CORS-enabled Pi tunnels)
  const direct = await probeDirectPiFromBrowser(rawUrl, 6000);
  if (direct.online) {
    const finalUrl = direct.resolvedUrl || cleanUrl;
    setStoredPiEndpoint(finalUrl);
    probeAndBridgeLanPi(finalUrl, true).catch(() => null);
    fetch(`${finalUrl}/api/config`, {
      method: 'POST',
      headers: getPiHeaders(finalUrl, true),
      body: JSON.stringify({ piServerUrl: finalUrl }),
    }).catch(() => null);

    return {
      success: true,
      online: true,
      normalizedUrl: finalUrl,
      latencyMs: direct.latencyMs,
      method: direct.connectionMethod,
      message:
        lang === 'tl'
          ? `Konektado at Nai-bind sa Raspberry Pi Cloud Server! (${direct.connectionMethod}, Bilis: ${direct.latencyMs}ms)`
          : `Connected & Bound to Raspberry Pi Cloud Server! (${direct.connectionMethod}, Latency: ${direct.latencyMs}ms)`,
    };
  }

  const errText =
    direct.errorDetail && direct.errorDetail.includes('Mixed Content')
      ? direct.errorDetail
      : serverPing.data?.error ||
        (lang === 'tl'
          ? `Hindi maabot o hindi valid ang Raspberry Pi Cloud Server sa ${cleanUrl}. Pakisiguradong tama ang link at tumatakbo ang iyong Pi server at tunnel (hal. ngrok http 3000 o 8000).`
          : `Cannot reach or validate Raspberry Pi Cloud Server at ${cleanUrl}. Make sure the link is valid and your Pi server and tunnel (e.g. ngrok http 3000 or 8000) are running.`);

  return {
    success: false,
    online: false,
    normalizedUrl: '',
    message: errText,
    error: errText,
  };
}

export async function getUnifiedPiStatus(
  overrideEndpoint: string | undefined,
  lang: 'tl' | 'en'
): Promise<PiStatus> {
  const candidate =
    overrideEndpoint !== undefined ? normalizeClientPiUrl(overrideEndpoint) : getStoredPiEndpoint();

  if (candidate && isLocalLanUrl(candidate)) {
    await probeAndBridgeLanPi(candidate, false);
  }

  const params = new URLSearchParams({ lang });
  if (candidate) params.set('endpoint', candidate);

  const apiRes = await safePortalApiFetch(`/api/pi-status?${params.toString()}`, {}, 5500);
  if (apiRes.ok && apiRes.data && typeof apiRes.data === 'object') {
    const serverStatus = apiRes.data as PiStatus;
    if (serverStatus.online) {
      if (serverStatus.configuredUrl && !getStoredPiEndpoint()) {
        setStoredPiEndpoint(serverStatus.configuredUrl);
      }
      return serverStatus;
    }
  }

  // Fallback or secondary verification: Direct Browser-to-Pi Tunnel Probe
  const targetUrl = candidate || normalizeClientPiUrl(apiRes.data?.configuredUrl || '');
  if (targetUrl && !isBareTunnelRootDomain(targetUrl)) {
    const direct = await probeDirectPiFromBrowser(targetUrl, 5000);
    let hostname = 'raspberrypi.local';
    try {
      hostname = new URL(targetUrl).hostname;
    } catch {
      // ignore
    }

    if (direct.online) {
      const d = direct.healthJson || {};
      const rawTemp = parseFloat(String(d.cpu_temp || '42.0').replace(/[^\d.]/g, '')) || 42.0;
      const folderMb = Number(d.pulse_folder_mb ?? d.storageUsedMb ?? 0);
      return {
        online: true,
        isConfigured: true,
        configuredUrl: targetUrl,
        connectionMethod: direct.connectionMethod,
        latencyMs: direct.latencyMs,
        lastPingAt: new Date().toISOString(),
        hardware: d.hardware || 'Raspberry Pi 4 Model B',
        ram: d.ram || 'Active (Healthy)',
        storage_folder: d.storage_folder || '/media/pi/Vherrsie Back-up/RESEARCH TRASH',
        disk_total: d.disk_total || '500.0 GB',
        disk_used: d.disk_used || '20.0 GB',
        disk_free: d.disk_free || '480.0 GB',
        storageUsedMb: folderMb,
        pulseFolderMb: folderMb,
        pulseFolderKb: Number(d.pulse_folder_kb ?? Math.round(folderMb * 1024)),
        pulseStorageSummary:
          d.pulseStorageSummary ||
          `${folderMb.toFixed(2)} MB (${Number(d.pulse_folder_kb ?? Math.round(folderMb * 1024))} KB)`,
        residentPhotosCount: Number(d.residentPhotosCount ?? d.resident_photos_count ?? 0),
        residentPhotosMb: Number(d.residentPhotosMb ?? 0),
        proofPhotosCount: Number(d.proofPhotosCount ?? d.proof_photos_count ?? 0),
        proofPhotosMb: Number(d.proofPhotosMb ?? 0),
        cachedImagesCount: Number(d.cachedImagesCount ?? 0),
        activeTicketsCount: Number(d.reports_count ?? d.activeTicketsCount ?? 0),
        pendingTicketsCount: Number(d.pending_reports_count ?? d.pendingTicketsCount ?? 0),
        brgy40Count: Number(d.brgy40Count ?? 0),
        brgy41Count: Number(d.brgy41Count ?? 0),
        autoPurgeTtlDays: Number(d.autoPurgeTtlDays ?? 3),
        cpuTempCelsius: rawTemp,
        cpu_temp: d.cpu_temp || `${rawTemp.toFixed(1)}°C`,
        ipAddress: d.ipAddress || hostname,
        localHostname: d.localHostname || hostname,
        lastPurgeRun: d.lastPurgeRun || new Date().toISOString(),
        savedLogbooksCount: Number(d.saved_logbooks_count ?? d.savedLogbooksCount ?? 0),
        isPrivateLanIp: isLocalLanUrl(targetUrl),
        serverMode: 'DIRECT_CLOUD_TUNNEL',
      };
    }

    return {
      online: false,
      isConfigured: true,
      configuredUrl: targetUrl,
      connectionMethod: detectPiConnectionMethod(targetUrl),
      lastPingAt: new Date().toISOString(),
      errorDetail:
        direct.errorDetail ||
        apiRes.data?.errorDetail ||
        (lang === 'tl'
          ? 'Offline ang naka-link na Raspberry Pi Cloud Server.'
          : 'Linked Raspberry Pi Cloud Server is offline.'),
      hardware: 'Raspberry Pi 4 Model B',
      ram: 'Offline',
      storageUsedMb: 0,
      residentPhotosCount: 0,
      residentPhotosMb: 0,
      proofPhotosCount: 0,
      proofPhotosMb: 0,
      cachedImagesCount: 0,
      activeTicketsCount: 0,
      pendingTicketsCount: 0,
      autoPurgeTtlDays: 3,
      cpuTempCelsius: 0,
      ipAddress: hostname,
      localHostname: hostname,
      lastPurgeRun: '',
      savedLogbooksCount: 0,
      isPrivateLanIp: isLocalLanUrl(targetUrl),
      serverMode: 'DIRECT_CLOUD_TUNNEL',
    };
  }

  if (apiRes.data && typeof apiRes.data === 'object' && 'online' in apiRes.data) {
    return apiRes.data as PiStatus;
  }

  return {
    online: false,
    isConfigured: false,
    configuredUrl: '',
    hardware: 'Raspberry Pi 4 Model B',
    ram: 'Not Configured',
    storageUsedMb: 0,
    residentPhotosCount: 0,
    residentPhotosMb: 0,
    proofPhotosCount: 0,
    proofPhotosMb: 0,
    cachedImagesCount: 0,
    activeTicketsCount: 0,
    pendingTicketsCount: 0,
    autoPurgeTtlDays: 3,
    cpuTempCelsius: 0,
    ipAddress: 'Not Set',
    localHostname: 'raspberrypi.local',
    lastPurgeRun: '',
    savedLogbooksCount: 0,
    errorDetail:
      lang === 'tl' ? 'Walang naka-set na server link.' : 'No server link configured.',
  };
}

export async function syncUnifiedPiServer(
  rawUrl: string,
  lang: 'tl' | 'en'
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = normalizeClientPiUrl(rawUrl || getStoredPiEndpoint());
  if (!cleanUrl) {
    return {
      success: false,
      message: lang === 'tl' ? 'Walang naka-set na Pi link.' : 'No Pi link configured.',
    };
  }

  // Try direct browser sync against Pi tunnel/LAN first so it works on all deployments
  const direct = await probeDirectPiFromBrowser(cleanUrl, 5000);
  if (direct.online) {
    await probeAndBridgeLanPi(cleanUrl, true).catch(() => null);
    return {
      success: true,
      message:
        lang === 'tl'
          ? 'Matagumpay na na-sync ang lahat ng ulat at litrato sa Raspberry Pi Hard Drive!'
          : 'Successfully synced all reports and photos with Raspberry Pi Hard Drive!',
    };
  }

  const res = await safePortalApiFetch(
    '/api/pi/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, lang }),
    },
    8000
  );
  if (res.ok && res.data?.success) {
    return {
      success: true,
      message:
        res.data.message ||
        (lang === 'tl' ? 'Matagumpay na na-sync!' : 'Successfully synced!'),
    };
  }

  return {
    success: false,
    message:
      res.data?.error ||
      (lang === 'tl' ? 'Hindi ma-sync sa ngayon.' : 'Could not sync right now.'),
  };
}

export async function disconnectUnifiedPiServer(lang: 'tl' | 'en'): Promise<void> {
  setStoredPiEndpoint('');
  await safePortalApiFetch(
    '/api/pi/disconnect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
    },
    4000
  );
}

export async function sendUnifiedPiPowerAction(
  action: 'shutdown' | 'reboot',
  rawUrl: string,
  lang: 'tl' | 'en'
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = normalizeClientPiUrl(rawUrl || getStoredPiEndpoint());
  if (cleanUrl) {
    try {
      const directRes = await fetch(
        `${cleanUrl}/api/system/${action === 'reboot' ? 'reboot' : 'shutdown'}`,
        {
          method: 'POST',
          headers: getPiHeaders(cleanUrl, true),
        }
      );
      if (directRes.ok) {
        const d = await directRes.json().catch(() => ({}));
        return {
          success: true,
          message:
            d?.message ||
            (action === 'shutdown'
              ? lang === 'tl'
                ? 'Naipadala ang Safe Shutdown. Maghintay ng 5 segundo bago tanggalin sa saksakan.'
                : 'Safe Shutdown signal delivered. Wait 5 seconds before unplugging power.'
              : lang === 'tl'
              ? 'Nagre-reboot na ang Raspberry Pi!'
              : 'Raspberry Pi server is rebooting!'),
        };
      }
    } catch {}
  }

  const apiRes = await safePortalApiFetch(
    '/api/pi/system-action',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, url: cleanUrl, lang }),
    },
    6000
  );
  if (apiRes.ok && apiRes.data?.success) {
    return {
      success: true,
      message:
        apiRes.data.message ||
        (lang === 'tl' ? 'Naipadala ang command sa Pi.' : 'Command delivered to Pi.'),
    };
  }

  return {
    success: false,
    message:
      lang === 'tl' ? 'Nagkaroon ng aberya sa koneksyon sa Pi.' : 'Connection error reaching Pi.',
  };
}

/**
 * Unified Reports Fetching (Kagawad Queue + Per-Device Resident ?ids= Polling)
 */
export async function fetchUnifiedReports(
  lang: 'tl' | 'en',
  filterIds?: string[]
): Promise<{ reports: WasteReport[]; piOnline: boolean | null }> {
  const piUrl = getStoredPiEndpoint();

  if (filterIds && filterIds.length === 0) {
    // Only check Pi online status
    if (piUrl) {
      const direct = await probeDirectPiFromBrowser(piUrl, 4000);
      if (direct.online) return { reports: [], piOnline: true };
    }
    const cfg = await safePortalApiFetch('/api/config', {}, 3500);
    if (cfg.ok && cfg.data) {
      return { reports: [], piOnline: Boolean(cfg.data.piOnline) };
    }
    return { reports: [], piOnline: piUrl ? false : null };
  }

  const params = new URLSearchParams({ lang });
  if (filterIds && filterIds.length > 0) {
    params.set('ids', filterIds.join(','));
  }

  const apiRes = await safePortalApiFetch(`/api/reports?${params.toString()}`, {}, 6500);
  if (apiRes.ok && Array.isArray(apiRes.data)) {
    const headerOnline = apiRes.headers?.get('X-Pi-Online');
    const apiReports = (apiRes.data as WasteReport[]).map((r) => ({
      ...r,
      ticketNumber: formatTicketNumber(r.ticketNumber),
    }));

    // If a Pi tunnel/LAN URL is configured in browser and API returned empty or offline, also merge direct Pi reports
    if (piUrl && (headerOnline === 'false' || apiReports.length === 0)) {
      try {
        const directRes = await fetch(`${piUrl}/api/reports`, {
          headers: getPiHeaders(piUrl),
        });
        if (directRes.ok) {
          const directData = await directRes.json();
          if (Array.isArray(directData)) {
            let merged = mergeWasteReportArrays(apiReports, directData).map((r) =>
              enrichClientReport(r, lang)
            );
            if (filterIds && filterIds.length > 0) {
              const idSet = new Set(filterIds);
              const canonicalSet = new Set(filterIds.map((f) => canonicalTicketKey(f)).filter(Boolean));
              merged = merged.filter(
                (r) =>
                  idSet.has(r.id) ||
                  idSet.has(r.ticketNumber) ||
                  canonicalSet.has(canonicalTicketKey(r.ticketNumber))
              );
            }
            return { reports: merged, piOnline: true };
          }
        }
      } catch {}
    }

    return {
      reports: apiReports,
      piOnline: headerOnline !== null ? headerOnline === 'true' : null,
    };
  }

  // Direct Browser-to-Pi Tunnel Fetch (Cloudflare Workers Static Assets / GitHub Pages / ngrok.dev)
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6500);
      const directRes = await fetch(`${piUrl}/api/reports`, {
        signal: ctrl.signal,
        headers: getPiHeaders(piUrl),
      });
      clearTimeout(timer);

      if (directRes.ok) {
        const rawList = await directRes.json();
        if (Array.isArray(rawList)) {
          let enriched = rawList.map((r: WasteReport) => enrichClientReport(r, lang));
          if (filterIds && filterIds.length > 0) {
            const idSet = new Set(filterIds);
            const canonicalSet = new Set(filterIds.map((f) => canonicalTicketKey(f)).filter(Boolean));
            enriched = enriched.filter(
              (r) =>
                idSet.has(r.id) ||
                idSet.has(r.ticketNumber) ||
                canonicalSet.has(canonicalTicketKey(r.ticketNumber))
            );
          }
          return { reports: enriched, piOnline: true };
        }
      }
      return { reports: [], piOnline: false };
    } catch {
      return { reports: [], piOnline: false };
    }
  }

  return { reports: [], piOnline: false };
}

/**
 * Safe Direct Push of a Single Report to Raspberry Pi Server:
 * Uses GET /api/reports + non-destructive merge + POST /api/reports/sync
 * so it is 100% compatible with BOTH older and newer server.py scripts!
 */
export async function pushSingleReportDirectToPi(
  piUrl: string,
  report: WasteReport
): Promise<boolean> {
  const cleanUrl = normalizeClientPiUrl(piUrl);
  if (!cleanUrl || isBareTunnelRootDomain(cleanUrl)) return false;

  try {
    const probe = await probeDirectPiFromBrowser(cleanUrl, 4500);
    if (!probe.online) return false;

    let existingList: WasteReport[] = [];
    try {
      const getCtrl = new AbortController();
      const getTimer = setTimeout(() => getCtrl.abort(), 6000);
      const getRes = await fetch(`${cleanUrl}/api/reports`, {
        signal: getCtrl.signal,
        headers: getPiHeaders(cleanUrl),
      });
      clearTimeout(getTimer);
      if (getRes.ok) {
        const parsed = await getRes.json();
        if (Array.isArray(parsed)) existingList = parsed;
      }
    } catch {}

    const nextReport: WasteReport = {
      ...report,
      localSyncStatus: 'SENT_TO_PI',
      sourceStorage: 'Raspberry Pi 4B Cloud Storage',
    };
    const merged = mergeWasteReportArrays([nextReport], existingList);

    const syncCtrl = new AbortController();
    const syncTimer = setTimeout(() => syncCtrl.abort(), 18000);
    const syncRes = await fetch(`${cleanUrl}/api/reports/sync`, {
      method: 'POST',
      signal: syncCtrl.signal,
      headers: getPiHeaders(cleanUrl, true),
      body: JSON.stringify(merged),
    }).catch(() => null);
    clearTimeout(syncTimer);

    if (syncRes && syncRes.ok) return true;

    const postCtrl = new AbortController();
    const postTimer = setTimeout(() => postCtrl.abort(), 15000);
    const postRes = await fetch(`${cleanUrl}/api/reports`, {
      method: 'POST',
      signal: postCtrl.signal,
      headers: getPiHeaders(cleanUrl, true),
      body: JSON.stringify(nextReport),
    }).catch(() => null);
    clearTimeout(postTimer);

    return Boolean(postRes && postRes.ok);
  } catch {
    return false;
  }
}

export async function submitUnifiedReport(
  draftReport: WasteReport,
  lang: 'tl' | 'en'
): Promise<{
  ok: boolean;
  piOffline: boolean;
  report?: WasteReport;
  error?: string;
}> {
  const piUrl = getStoredPiEndpoint();
  let directSynced = false;

  if (piUrl && isLocalLanUrl(piUrl)) {
    directSynced = await pushSingleReportDirectToPi(piUrl, draftReport);
  }

  const apiRes = await safePortalApiFetch(
    '/api/reports',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draftReport,
        clientSyncedToPi: directSynced,
        lang,
      }),
    },
    18000
  );

  if (apiRes.ok && apiRes.data?.report) {
    return {
      ok: true,
      piOffline: false,
      report: apiRes.data.report as WasteReport,
    };
  }

  // If deployed on static Cloudflare Workers / Pages / GitHub Pages OR edge didn't know the browser's Pi tunnel URL:
  // Push directly from browser to the bound HTTPS tunnel (e.g. https://*.ngrok.dev, https://*.trycloudflare.com)!
  if (piUrl && !directSynced) {
    directSynced = await pushSingleReportDirectToPi(piUrl, draftReport);
  }

  if (directSynced) {
    const syncedReport: WasteReport = {
      ...draftReport,
      localSyncStatus: 'SENT_TO_PI',
      sourceStorage: 'Raspberry Pi 4B Cloud Storage',
    };
    // Best-effort direct Telegram notification if bot credentials exist locally or on Pi
    notifyTelegramFromClient('NEW_REPORT', syncedReport, lang).catch(() => null);
    return {
      ok: true,
      piOffline: false,
      report: syncedReport,
    };
  }

  if (apiRes.status === 503 || apiRes.data?.piOffline || apiRes.isStaticFallback) {
    return {
      ok: false,
      piOffline: true,
      error: apiRes.data?.error,
    };
  }

  return {
    ok: false,
    piOffline: false,
    error: apiRes.data?.error,
  };
}

export async function updateUnifiedReportStatus(
  id: string,
  payload: {
    status: 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED';
    lang: 'tl' | 'en';
    resolvedBy?: string;
    resolutionNotes?: string;
    cancellationReason?: string;
    proofPhotos?: string[];
    proofKagawadName?: string;
  }
): Promise<{ success: boolean; report?: WasteReport }> {
  const apiRes = await safePortalApiFetch(
    `/api/reports/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    15000
  );

  if (apiRes.ok && apiRes.data?.success && apiRes.data?.report) {
    const rawUpdated = apiRes.data.report as WasteReport;
    const updated: WasteReport = {
      ...rawUpdated,
      ticketNumber: formatTicketNumber(rawUpdated.ticketNumber),
    };
    // Mirror to LAN Pi if configured
    const piUrl = getStoredPiEndpoint();
    if (piUrl && isLocalLanUrl(piUrl)) {
      pushSingleReportDirectToPi(piUrl, updated).catch(() => null);
    }
    return { success: true, report: updated };
  }

  // Direct Browser-to-Pi Tunnel Status Update
  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    try {
      const getRes = await fetch(`${piUrl}/api/reports`, {
        headers: getPiHeaders(piUrl),
      });
      if (getRes.ok) {
        const list: WasteReport[] = await getRes.json();
        const nowIso = new Date().toISOString();
        let updatedTarget: WasteReport | undefined;
        const targetCanonical = canonicalTicketKey(id);

        const nextList = (Array.isArray(list) ? list : []).map((r) => {
          if (
            r.id === id ||
            r.ticketNumber === id ||
            (targetCanonical && canonicalTicketKey(r.ticketNumber) === targetCanonical)
          ) {
            const next: WasteReport = {
              ...r,
              ticketNumber: formatTicketNumber(r.ticketNumber),
              status: payload.status,
            };
            if (payload.status === 'DISPATCHED') {
              next.dispatchedAt = nowIso;
            } else if (payload.status === 'RESOLVED') {
              next.resolvedAt = nowIso;
              next.resolvedBy = payload.resolvedBy;
              next.resolutionNotes = payload.resolutionNotes;
              next.proofPhotos = payload.proofPhotos || [];
              next.proofKagawadName = payload.proofKagawadName;
              next.proofSubmittedAt = nowIso;
            } else if (payload.status === 'CANCELLED') {
              next.cancelledAt = nowIso;
              next.cancellationReason = payload.cancellationReason;
            }
            updatedTarget = next;
            return next;
          }
          return r;
        });

        if (updatedTarget) {
          const syncRes = await fetch(`${piUrl}/api/reports/sync`, {
            method: 'POST',
            headers: getPiHeaders(piUrl, true),
            body: JSON.stringify(nextList),
          });
          if (syncRes.ok) {
            if (payload.status === 'RESOLVED') {
              notifyTelegramFromClient('RESOLVED_REPORT', updatedTarget, payload.lang).catch(
                () => null
              );
            }
            return {
              success: true,
              report: enrichClientReport(updatedTarget, payload.lang),
            };
          }
        }
      }
    } catch {}
  }

  return { success: false };
}

export async function deleteUnifiedReport(id: string): Promise<boolean> {
  let deleted = false;
  const apiRes = await safePortalApiFetch(
    `/api/reports/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    6000
  );
  if (apiRes.ok && apiRes.data?.success) {
    deleted = true;
  }

  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    try {
      const delRes = await fetch(`${piUrl}/api/reports?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getPiHeaders(piUrl),
      });
      if (delRes.ok) deleted = true;
    } catch {}
  }

  return deleted;
}

export async function clearAllUnifiedReports(): Promise<boolean> {
  await safePortalApiFetch('/api/reports/clear-all', { method: 'POST' }, 6000);
  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    try {
      const res = await fetch(`${piUrl}/api/reports/sync`, {
        method: 'POST',
        headers: getPiHeaders(piUrl, true),
        body: JSON.stringify([]),
      });
      return res.ok;
    } catch {}
  }
  return true;
}

export async function pushReportsToLanPiIfConfigured(reportsList: WasteReport[]): Promise<void> {
  const endpoint = getStoredPiEndpoint();
  if (!endpoint || !isLocalLanUrl(endpoint)) return;
  try {
    await fetch(`${endpoint}/api/reports/sync`, {
      method: 'POST',
      headers: getPiHeaders(endpoint, true),
      body: JSON.stringify(reportsList),
    });
  } catch {}
}

export async function deleteReportOnLanPiIfConfigured(reportId: string): Promise<void> {
  const endpoint = getStoredPiEndpoint();
  if (!endpoint || !isLocalLanUrl(endpoint)) return;
  try {
    await fetch(`${endpoint}/api/reports?id=${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
      headers: getPiHeaders(endpoint),
    });
  } catch {}
}

/**
 * Unified Logbook Operations (Works across Express, Cloudflare Pages, and Direct Pi Tunnel/LAN)
 */
export async function fetchUnifiedSavedLogbooks(lang: 'tl' | 'en'): Promise<SavedLogBook[]> {
  let list: SavedLogBook[] = [];
  const apiRes = await safePortalApiFetch(`/api/pi/saved-logbooks?lang=${lang}`, {}, 5500);
  if (apiRes.ok && Array.isArray(apiRes.data?.logbooks)) {
    list = apiRes.data.logbooks;
  }

  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    try {
      const directRes = await fetch(`${piUrl}/api/logbooks`, {
        headers: getPiHeaders(piUrl),
      });
      if (directRes.ok) {
        const remLogs = await directRes.json();
        if (Array.isArray(remLogs)) {
          for (const rem of remLogs) {
            if (rem?.filename && !list.some((l) => l.filename === rem.filename)) {
              list = [
                {
                  id: rem.id || rem.filename,
                  filename: rem.filename,
                  savedAt: rem.modified || new Date().toISOString(),
                  savedAtPhilippineTime: rem.modified || new Date().toLocaleString(),
                  totalRecords: rem.totalRecords || 0,
                  pendingRecords: rem.pendingRecords || 0,
                  dispatchedRecords: rem.dispatchedRecords || 0,
                  resolvedRecords: rem.resolvedRecords || 0,
                  cancelledRecords: rem.cancelledRecords || 0,
                  brgy40Count: rem.brgy40Count || 0,
                  brgy41Count: rem.brgy41Count || 0,
                  storageUsedMb: rem.sizeKb ? +(rem.sizeKb / 1024).toFixed(2) : 0.1,
                  savedBy: rem.savedBy || 'Raspberry Pi Hard Drive',
                  destination: 'Raspberry Pi 4B Cloud Server',
                  syncStatus: 'SYNCED',
                  recordsSummary:
                    lang === 'tl'
                      ? 'Naka-imbak sa Raspberry Pi External Hard Drive'
                      : 'Stored on Raspberry Pi External Hard Drive',
                },
                ...list,
              ];
            }
          }
        }
      }
    } catch {}
  }

  return list;
}

export async function saveUnifiedLogbook(
  reports: WasteReport[],
  lang: 'tl' | 'en'
): Promise<{ success: boolean; logbook?: SavedLogBook; message?: string }> {
  const piEndpoint = getStoredPiEndpoint();
  const nowIso = new Date().toISOString();
  const phTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  const genFilename = `TUGON_Logbook_Brgy40_41_${nowIso.slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
  const savedByLabel =
    lang === 'tl' ? 'Barangay 40 & 41 Kagawad' : 'Barangay 40 & 41 Official';

  let clientSyncedToPi = false;
  if (piEndpoint && !isBareTunnelRootDomain(piEndpoint)) {
    try {
      const piRes = await fetch(`${piEndpoint}/api/logbook/save`, {
        method: 'POST',
        headers: getPiHeaders(piEndpoint, true),
        body: JSON.stringify({
          filename: genFilename,
          savedAt: nowIso,
          savedAtPhilippineTime: phTime,
          savedBy: savedByLabel,
          totalRecords: reports.length,
          reports,
        }),
      });
      if (piRes.ok) {
        clientSyncedToPi = true;
      }
    } catch {}
  }

  const apiRes = await safePortalApiFetch(
    '/api/pi/save-logbook',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        savedBy: savedByLabel,
        destination: 'Raspberry Pi 4B Cloud Server',
        piEndpoint,
        clientSyncedToPi,
        lang,
      }),
    },
    10000
  );

  if (apiRes.ok && apiRes.data?.success && apiRes.data?.logbook) {
    return {
      success: true,
      logbook: apiRes.data.logbook,
      message: apiRes.data.message,
    };
  }

  if (clientSyncedToPi) {
    const fallbackLogbook: SavedLogBook = {
      id: genFilename,
      filename: genFilename,
      savedAt: nowIso,
      savedAtPhilippineTime: phTime,
      totalRecords: reports.length,
      pendingRecords: reports.filter((r) => r.status === 'PENDING').length,
      dispatchedRecords: reports.filter((r) => r.status === 'DISPATCHED').length,
      resolvedRecords: reports.filter((r) => r.status === 'RESOLVED').length,
      cancelledRecords: reports.filter((r) => r.status === 'CANCELLED').length,
      brgy40Count: reports.filter((r) => r.barangay?.includes('40')).length,
      brgy41Count: reports.filter((r) => !r.barangay?.includes('40')).length,
      storageUsedMb: +(
        reports.reduce((acc, r) => acc + (r.storageUsedMb || 0.8), 0) || 0.1
      ).toFixed(2),
      savedBy: savedByLabel,
      destination: 'Raspberry Pi 4B Cloud Server',
      syncStatus: 'SYNCED',
      recordsSummary:
        lang === 'tl'
          ? 'Direktang na-save sa Raspberry Pi Hard Drive'
          : 'Saved directly to Raspberry Pi Hard Drive',
    };
    return {
      success: true,
      logbook: fallbackLogbook,
      message:
        lang === 'tl'
          ? `Matagumpay na na-save ang Log Book snapshot sa Pi Cloud Server! (${phTime})`
          : `Log Book snapshot successfully saved to Pi Cloud Server! (${phTime})`,
    };
  }

  return { success: false };
}

export async function downloadUnifiedLogbook(log: SavedLogBook): Promise<Blob | null> {
  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    try {
      const directRes = await fetch(
        `${piUrl}/api/logbooks/${encodeURIComponent(log.filename)}`,
        { headers: getPiHeaders(piUrl) }
      );
      if (directRes.ok) {
        return await directRes.blob();
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/pi/download-logbook/${encodeURIComponent(log.id)}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && !ct.includes('text/html')) {
      return await res.blob();
    }
  } catch {}
  return null;
}

export async function deleteUnifiedSavedLogbook(log: SavedLogBook): Promise<void> {
  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    await fetch(`${piUrl}/api/logbooks?filename=${encodeURIComponent(log.filename)}`, {
      method: 'DELETE',
      headers: getPiHeaders(piUrl),
    }).catch(() => null);
  }
  await safePortalApiFetch(
    `/api/pi/logbooks/${encodeURIComponent(log.id)}`,
    { method: 'DELETE' },
    5000
  );
}

/**
 * Unified Telegram Bot Support (Server / Edge + Direct Browser Fallback to api.telegram.org)
 */
async function readTelegramCreds(overrideToken?: string, overrideChatId?: string) {
  let token = (overrideToken || '').trim();
  let chatId = (overrideChatId || '').trim();
  try {
    if (!token) {
      token =
        localStorage.getItem('pulse_telegram_bot_token') ||
        localStorage.getItem('trash_telegram_bot_token') ||
        '';
    }
    if (!chatId) {
      chatId =
        localStorage.getItem('pulse_telegram_chat_id') ||
        localStorage.getItem('trash_telegram_chat_id') ||
        '';
    }
  } catch {}

  // If browser storage is empty (e.g. resident's phone), check Pi's /api/config
  if ((!token || !chatId) && getStoredPiEndpoint()) {
    try {
      const piUrl = getStoredPiEndpoint();
      const cfgRes = await fetch(`${piUrl}/api/config`, { headers: getPiHeaders(piUrl) });
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        if (!token && cfg?.telegramBotToken) token = String(cfg.telegramBotToken).trim();
        if (!chatId && cfg?.telegramChatId) chatId = String(cfg.telegramChatId).trim();
      }
    } catch {}
  }

  return { token, chatId };
}

async function notifyTelegramFromClient(
  eventType: 'NEW_REPORT' | 'RESOLVED_REPORT',
  report: WasteReport,
  lang: 'tl' | 'en'
): Promise<void> {
  const { token, chatId } = await readTelegramCreds();
  if (!token || !chatId) return;

  const phTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  const mapsUrl = `https://www.google.com/maps?q=${report.coordinates.lat},${report.coordinates.lng}`;

  const formattedTicket = formatTicketNumber(report.ticketNumber);
  const text =
    eventType === 'NEW_REPORT'
      ? lang === 'en'
        ? `🗑 [T.U.G.O.N. NEW WASTE REPORT - ${report.barangay || 'Barangay 40/41'}]\nTicket: #${formattedTicket}\nTime: ${phTime}\nLocation: ${report.realtimeGpsAddress || report.streetAddress || report.purok}\nMaps: ${mapsUrl}\nSeverity: ${report.severityLevel}\nPhotos: ${report.photos?.length || 0} attached`
        : `🗑 [T.U.G.O.N. BAGONG ULAT NG BASURA - ${report.barangay || 'Brgy 40/41'}]\nTicket: #${formattedTicket}\nOras: ${phTime}\nLugar: ${report.realtimeGpsAddress || report.streetAddress || report.purok}\nMaps: ${mapsUrl}\nKalubhaan: ${report.severityLevel}\nLitrato: ${report.photos?.length || 0} nakalakip`
      : lang === 'en'
      ? `✅ [T.U.G.O.N. RESOLVED - ${report.barangay || 'Barangay 40/41'}]\nTicket: #${formattedTicket}\nTime: ${phTime}\nOfficial: ${report.resolvedBy || 'Barangay Official'}\nProof Photos: ${report.proofPhotos?.length || 0}`
      : `✅ [T.U.G.O.N. NA-RESOLBA NA - ${report.barangay || 'Brgy 40/41'}]\nTicket: #${formattedTicket}\nOras: ${phTime}\nKagawad: ${report.resolvedBy || 'Barangay Kagawad'}\nProeba: ${report.proofPhotos?.length || 0} litrato`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => null);
}

export async function getUnifiedTelegramStatus(
  lang: 'tl' | 'en',
  token?: string,
  chatId?: string
): Promise<TelegramBotStatus> {
  const creds = await readTelegramCreds(token, chatId);
  const params = new URLSearchParams({ lang });
  if (creds.token) params.set('token', creds.token);
  if (creds.chatId) params.set('chatId', creds.chatId);

  const apiRes = await safePortalApiFetch(`/api/telegram/status?${params.toString()}`, {}, 5000);
  if (apiRes.ok && apiRes.data && typeof apiRes.data === 'object') {
    return apiRes.data as TelegramBotStatus;
  }

  const nowStr = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());

  if (!creds.token) {
    return {
      online: false,
      status: 'NOT_CONFIGURED',
      botConfigured: false,
      chatId: creds.chatId,
      botUsername: '',
      autoRestartCount: 0,
      reconnectAttempts: 0,
      lastCheckedAt: nowStr,
      watchdogActive: true,
    };
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${creds.token}/getMe`);
    const tgData = await tgRes.json();
    if (tgData?.ok && tgData.result) {
      return {
        online: true,
        status: 'ONLINE',
        botConfigured: Boolean(creds.token && creds.chatId),
        setupComplete: Boolean(creds.token && creds.chatId),
        chatId: creds.chatId,
        botUsername: tgData.result.username || '',
        autoRestartCount: 0,
        reconnectAttempts: 0,
        lastCheckedAt: nowStr,
        watchdogActive: true,
      };
    }
  } catch {}

  return {
    online: false,
    status: 'OFFLINE',
    botConfigured: Boolean(creds.token && creds.chatId),
    chatId: creds.chatId,
    botUsername: '',
    autoRestartCount: 0,
    reconnectAttempts: 0,
    lastCheckedAt: nowStr,
    watchdogActive: true,
  };
}

export async function detectUnifiedTelegramChat(
  botToken: string,
  lang: 'tl' | 'en'
): Promise<{
  success: boolean;
  chatId?: string;
  chatTitle?: string;
  chats?: { id: string; title: string; type: string }[];
  error?: string;
}> {
  const cleanToken = botToken.trim();
  const apiRes = await safePortalApiFetch(
    '/api/telegram/detect-chat',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: cleanToken, lang }),
    },
    6500
  );
  if (!apiRes.isStaticFallback && apiRes.data) {
    return apiRes.data;
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=25`);
    const data = await r.json();
    if (!data?.ok) {
      return {
        success: false,
        error:
          data?.description ||
          (lang === 'en' ? 'Invalid Bot Token.' : 'Invalid ang Bot Token.'),
      };
    }
    const chatsMap = new Map<string, { id: string; title: string; type: string }>();
    for (const upd of (data.result || []).reverse()) {
      const msg = upd.message || upd.channel_post || upd.my_chat_member;
      const chat = msg?.chat;
      if (chat?.id) {
        const idStr = String(chat.id);
        if (!chatsMap.has(idStr)) {
          const title =
            chat.title ||
            [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
            chat.username ||
            `Chat ${idStr}`;
          chatsMap.set(idStr, { id: idStr, title, type: chat.type || 'private' });
        }
      }
    }
    const chats = Array.from(chatsMap.values());
    if (chats.length === 0) {
      return {
        success: false,
        error:
          lang === 'en'
            ? 'Open your bot in Telegram and send /start first, then click Auto-Detect again.'
            : 'Buksan muna ang iyong bot sa Telegram at i-tap ang /start, saka ulitin ang Auto-Detect.',
      };
    }
    return {
      success: true,
      chatId: chats[0].id,
      chatTitle: chats[0].title,
      chats,
    };
  } catch {
    return {
      success: false,
      error:
        lang === 'en'
          ? 'Could not reach Telegram API.'
          : 'Hindi makakonekta sa Telegram API.',
    };
  }
}

export async function configureUnifiedTelegram(
  botToken: string,
  chatId: string,
  lang: 'tl' | 'en'
): Promise<{ online: boolean; botUsername?: string; error?: string; message?: string }> {
  const cleanToken = botToken.trim();
  const cleanChat = chatId.trim();

  // Save to Pi /api/config if Pi is bound so resident phones can trigger Telegram alerts too
  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    fetch(`${piUrl}/api/config`, {
      method: 'POST',
      headers: getPiHeaders(piUrl, true),
      body: JSON.stringify({
        piServerUrl: piUrl,
        telegramBotToken: cleanToken,
        telegramChatId: cleanChat,
        telegramSetupComplete: true,
      }),
    }).catch(() => null);
  }

  const apiRes = await safePortalApiFetch(
    '/api/telegram/configure',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken: cleanToken, chatId: cleanChat, lang }),
    },
    6500
  );
  if (!apiRes.isStaticFallback && apiRes.data) {
    return apiRes.data;
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = await r.json();
    if (data?.ok && data.result) {
      return {
        online: true,
        botUsername: data.result.username || '',
      };
    }
    return {
      online: false,
      error: data?.description || 'Invalid Telegram Bot Token.',
    };
  } catch {
    return {
      online: false,
      error:
        lang === 'en'
          ? 'Could not reach Telegram API.'
          : 'Hindi makakonekta sa Telegram API.',
    };
  }
}

export async function sendUnifiedTelegramTest(
  botToken: string,
  chatId: string,
  lang: 'tl' | 'en'
): Promise<{
  delivered: boolean;
  timestamp: string;
  broadcast: string;
  message?: string;
}> {
  const creds = await readTelegramCreds(botToken, chatId);
  const apiRes = await safePortalApiFetch(
    '/api/telegram/test-notify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        botToken: creds.token || undefined,
        chatId: creds.chatId || undefined,
        lang,
      }),
    },
    7000
  );
  if (!apiRes.isStaticFallback && apiRes.data) {
    return {
      delivered: Boolean(apiRes.data.delivered || apiRes.data.telegramResult?.ok),
      timestamp: apiRes.data.timestamp || new Date().toLocaleTimeString(),
      broadcast: apiRes.data.broadcast || 'T.U.G.O.N. Test Alert',
      message: apiRes.data.message || apiRes.data.telegramResult?.description,
    };
  }

  const phTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());
  const msgText =
    lang === 'en'
      ? `🔔 [T.U.G.O.N. TEST ALERT - BARANGAY 40 & 41]\nStatus: Active & Connected\nTime: ${phTime}`
      : `🔔 [T.U.G.O.N. TEST ALERT - BARANGAY 40 & 41]\nStatus: Aktibo at Konektado\nOras: ${phTime}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${creds.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: creds.chatId, text: msgText }),
    });
    const tgData = await tgRes.json();
    return {
      delivered: Boolean(tgData?.ok),
      timestamp: phTime,
      broadcast: msgText,
      message: tgData?.description,
    };
  } catch {
    return {
      delivered: false,
      timestamp: phTime,
      broadcast: msgText,
      message: lang === 'en' ? 'Network error.' : 'Nagkaroon ng network error.',
    };
  }
}

export async function disconnectUnifiedTelegram(lang: 'tl' | 'en'): Promise<void> {
  await safePortalApiFetch(
    '/api/telegram/disconnect',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang }),
    },
    4000
  );
  const piUrl = getStoredPiEndpoint();
  if (piUrl && !isBareTunnelRootDomain(piUrl)) {
    fetch(`${piUrl}/api/config`, {
      method: 'POST',
      headers: getPiHeaders(piUrl, true),
      body: JSON.stringify({
        telegramBotToken: '',
        telegramChatId: '',
        telegramSetupComplete: false,
      }),
    }).catch(() => null);
  }
}
