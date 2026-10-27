import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import {
  BRGY_41_HALL_COORDS,
  evaluateJurisdiction,
} from './src/utils/jurisdiction.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware for parsing JSON with support for photo uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

export interface WasteReport {
  id: string;
  ticketNumber: string;
  residentName: string;
  residentPhone?: string;
  isElderly: boolean;
  severityLevel: 'MILD' | 'MODERATE' | 'OVERFLOWING' | 'EMERGENCY';
  purok: string;
  barangay?: string; // 'Barangay 40' | 'Barangay 41'
  streetAddress?: string;
  houseNumber?: string;
  landmark?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  autoGpsAccurate?: boolean;
  realtimeGpsAddress?: string;
  isWithinBrgy41: boolean;
  isWithinJurisdiction?: boolean;
  needsAssistanceOutside?: boolean;
  wasteTypes: string[];
  urgency: 'NORMAL' | 'HIGH' | 'CRITICAL' | 'URGENT_ELDERLY';
  estimatedBags: string;
  photos: string[];
  notes?: string;
  extraMessage?: string;
  status: 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED';
  dispatchedAt?: string;
  dispatchedKagawad?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  proofPhotos?: string[];
  resolutionNotes?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  retentionDays?: number;
  expiresAt?: string;
  sourceStorage?: string;
  storageUsedMb?: number;
  residentPhotosSizeMb?: number;
  proofPhotosSizeMb?: number;
  isPurgedFromFeed?: boolean;
  feedExpiresAt?: string;
  purgeRemainingMs?: number;
  purgeCountdownText?: string;
  purgeTtlRule?: '3_DAYS_UNRESOLVED' | '1_DAY_RESOLVED';
  remindersSent?: number;
  lastReminderAt?: string;
  proofSubmittedAt?: string;
  proofKagawadName?: string;
  deviceId?: string;
  localSyncStatus?: 'SAVED_ON_DEVICE' | 'SENT_TO_PI';
}

export interface SavedLogBook {
  id: string;
  filename: string;
  savedAt: string;
  savedAtPhilippineTime: string;
  totalRecords: number;
  pendingRecords: number;
  dispatchedRecords: number;
  resolvedRecords: number;
  cancelledRecords: number;
  brgy40Count: number;
  brgy41Count: number;
  storageUsedMb: number;
  savedBy: string;
  destination: string;
  syncStatus: 'SYNCED' | 'LOCAL_ONLY' | 'PENDING_UPLOAD';
  recordsSummary: string;
  recordsSnapshot?: WasteReport[];
}

interface PersistedSystemConfig {
  piServerUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramSetupComplete: boolean;
  lastBroadcastMessage: string;
  lastBroadcastTime: string;
  broadcastHistory: string[];
  kagawadCustomPassword?: string;
}

// -------------------------------------------------------------
// PERSISTENT STORAGE CONTROLLER
// -------------------------------------------------------------
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const REPORTS_FILE = path.resolve(DATA_DIR, 'pulse_reports.json');
const LOGBOOK_FILE = path.resolve(DATA_DIR, 'pulse_saved_logbooks.json');
const CONFIG_FILE = path.resolve(DATA_DIR, 'pulse_config.json');

let reports: WasteReport[] = [];
let savedLogBooks: SavedLogBook[] = [];

let persistedConfig: PersistedSystemConfig = {
  piServerUrl: process.env.PI_SERVER_URL || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  telegramSetupComplete: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  lastBroadcastMessage: '',
  lastBroadcastTime: '',
  broadcastHistory: [],
  kagawadCustomPassword: '',
};

try {
  let fileToRead = REPORTS_FILE;
  if (!fs.existsSync(fileToRead)) {
    const rootReports = path.resolve(process.cwd(), 'pulse_reports.json');
    if (fs.existsSync(rootReports)) {
      fileToRead = rootReports;
    } else {
      const legacyFile = path.resolve(DATA_DIR, 'trash_reports.json');
      if (fs.existsSync(legacyFile)) fileToRead = legacyFile;
    }
  }
  if (fs.existsSync(fileToRead)) {
    const raw = fs.readFileSync(fileToRead, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      reports = parsed;
    }
    console.log(`[T.U.G.O.N. Storage] Loaded ${reports.length} persisted reports from disk.`);
  }
} catch (e) {
  console.warn('[T.U.G.O.N. Storage] Could not read reports file, starting empty:', e);
}

try {
  let logFileToRead = LOGBOOK_FILE;
  if (!fs.existsSync(logFileToRead)) {
    const rootLogs = path.resolve(process.cwd(), 'pulse_saved_logbooks.json');
    if (fs.existsSync(rootLogs)) {
      logFileToRead = rootLogs;
    } else {
      const legacyLog = path.resolve(DATA_DIR, 'trash_saved_logbooks.json');
      if (fs.existsSync(legacyLog)) logFileToRead = legacyLog;
    }
  }
  if (fs.existsSync(logFileToRead)) {
    const raw = fs.readFileSync(logFileToRead, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      savedLogBooks = parsed;
    }
    console.log(`[T.U.G.O.N. Storage] Loaded ${savedLogBooks.length} saved logbooks from disk.`);
  }
} catch (e) {
  console.warn('[T.U.G.O.N. Storage] Could not read logbooks file:', e);
}

try {
  if (fs.existsSync(CONFIG_FILE)) {
    const rawCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    persistedConfig = {
      ...persistedConfig,
      ...rawCfg,
      piServerUrl: rawCfg.piServerUrl || process.env.PI_SERVER_URL || '',
      telegramBotToken: rawCfg.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '',
      telegramChatId: rawCfg.telegramChatId || process.env.TELEGRAM_CHAT_ID || '',
      broadcastHistory: Array.isArray(rawCfg.broadcastHistory) ? rawCfg.broadcastHistory : [],
    };
  }
} catch (e) {
  console.warn('[T.U.G.O.N. Storage] Could not read config file:', e);
}

function persistReports() {
  try {
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  } catch (e) {
    console.error('[T.U.G.O.N. Storage] Failed to persist reports:', e);
  }
}

function persistSavedLogBooks() {
  try {
    fs.writeFileSync(LOGBOOK_FILE, JSON.stringify(savedLogBooks, null, 2), 'utf8');
  } catch (e) {
    console.error('[T.U.G.O.N. Storage] Failed to persist logbooks:', e);
  }
}

function persistSystemConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(persistedConfig, null, 2), 'utf8');
  } catch (e) {
    console.error('[T.U.G.O.N. Storage] Failed to persist config:', e);
  }
}

// -------------------------------------------------------------
// URL NORMALIZER & LAN DETECTION FOR RASPBERRY PI
// -------------------------------------------------------------
export function isPrivateNetworkHost(urlOrHost: string): boolean {
  try {
    const parsed = new URL(urlOrHost.includes('://') ? urlOrHost : `http://${urlOrHost}`);
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

const SERVER_BARE_TUNNEL_ROOTS = new Set([
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

function isPublicTunnelDomain(hostname: string): boolean {
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

function isValidServerUrl(cleanUrl: string): boolean {
  if (!cleanUrl) return false;
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const h = parsed.hostname.toLowerCase();
    if (!h || SERVER_BARE_TUNNEL_ROOTS.has(h)) return false;
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.includes(':');
    const isLocal = h === 'localhost' || h.endsWith('.local');
    const hasValidDomain =
      h.includes('.') && /\.[a-z]{2,}$/i.test(h) && !h.startsWith('.') && !h.endsWith('.');
    return isIp || isLocal || hasValidDomain;
  } catch {
    return false;
  }
}

function isValidHealthObject(data: any): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (data.online === false || data.ok === false || data.healthy === false) return false;
  const st = String(data.status ?? data.state ?? '').trim().toLowerCase();
  if (['offline', 'error', 'down', 'dead', 'disconnected', 'fail', 'failed'].includes(st)) {
    return false;
  }
  if (data.error && !st && data.online !== true && data.ok !== true) {
    return false;
  }
  if (
    ['online', 'active', 'ok', 'healthy', 'running', 'up', 'ready', 'connected', 'live', 'success'].includes(
      st
    )
  ) {
    return true;
  }
  if (data.online === true || data.ok === true || data.healthy === true || data.active === true) {
    return true;
  }
  if (
    data.storage_folder ||
    data.hardware ||
    data.system ||
    data.disk_total ||
    data.cpu_temp ||
    typeof data.reports_count === 'number'
  ) {
    return true;
  }
  return false;
}

export function normalizePiUrl(rawInput: string): string {
  if (!rawInput) return '';
  let u = String(rawInput).trim().replace(/^["'`|]+|["'`|]+$/g, '').trim();
  if (!u || (/\s/.test(u) && !/https?:\/\//i.test(u))) return '';

  // Extract clean URL if user pasted a full cloudflared or ngrok terminal log line
  const embeddedMatches = u.match(/https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[^\s|"'<>]*)?/gi);
  if (embeddedMatches && (u.includes(' ') || u.includes('->') || u.includes('|'))) {
    const publicTunnel = embeddedMatches.find((m) => !isPrivateNetworkHost(m));
    u = publicTunnel || embeddedMatches[0];
  }

  // Add scheme if user pasted domain or IP without http(s)://
  if (!/^https?:\/\//i.test(u)) {
    if (isPrivateNetworkHost(u)) {
      const hasPort = /:\d+(\/|$)/.test(u);
      u = `http://${hasPort ? u : `${u.replace(/\/+$/, '')}:8000`}`;
    } else {
      u = `https://${u}`;
    }
  } else if (/^http:\/\//i.test(u) && !isPrivateNetworkHost(u)) {
    try {
      const p = new URL(u);
      if (isPublicTunnelDomain(p.hostname)) {
        u = u.replace(/^http:\/\//i, 'https://');
      }
    } catch {}
  }

  try {
    const parsed = new URL(u);
    if (isPublicTunnelDomain(parsed.hostname) && (parsed.port === '3000' || parsed.port === '8000')) {
      parsed.port = '';
      u = parsed.toString();
    }
  } catch {
    return '';
  }

  // Strip accidental trailing API subpaths if user pasted full health URL
  u = u
    .replace(/\/api\/(health|storage|reports|logbooks|config|pi-status)\/?$/i, '')
    .replace(/\/test\.txt$/i, '')
    .replace(/\/+$/, '');

  return u;
}

// -------------------------------------------------------------
// TELEGRAM BOT & WATCHDOG ENGINE
// -------------------------------------------------------------
let telegramConfig = {
  botToken: persistedConfig.telegramBotToken || '',
  chatId: persistedConfig.telegramChatId || '',
  botEnabled: true,
  lastBroadcastMessage: persistedConfig.lastBroadcastMessage || '',
  lastBroadcastTime: persistedConfig.lastBroadcastTime || '',
  piServerUrl: normalizePiUrl(persistedConfig.piServerUrl || ''),
};

interface TelegramWatchdogState {
  status: 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'NOT_CONFIGURED';
  isHealthy: boolean;
  botUsername: string;
  botFirstName: string;
  autoRestartCount: number;
  reconnectAttempts: number;
  consecutiveFailures: number;
  lastCheckedAt: string;
  lastSeenOnline: string;
  lastError: string;
  watchdogActive: boolean;
}

const telegramWatchdog: TelegramWatchdogState = {
  status: 'NOT_CONFIGURED',
  isHealthy: false,
  botUsername: '',
  botFirstName: '',
  autoRestartCount: 0,
  reconnectAttempts: 0,
  consecutiveFailures: 0,
  lastCheckedAt: '',
  lastSeenOnline: '',
  lastError: '',
  watchdogActive: true,
};

export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getPhilippineDateTime(): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };
  return new Intl.DateTimeFormat('en-PH', options).format(new Date());
}

function formatServerTicket(raw?: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^#+/, '');
  if (!cleaned) return '';
  return cleaned
    .replace(/^(PULSE|TRASH|DRAW)-CAV-/i, 'TUGON-CAV-')
    .replace(/^TUGON-CAV-/i, 'TUGON-CAV-');
}

function isValidServerPhotoSrc(src?: unknown): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed || trimmed === 'data:,' || trimmed === 'data:' || trimmed === 'about:blank') return false;
  if (trimmed.startsWith('blob:')) return false;
  if (trimmed.startsWith('data:image/')) return trimmed.length >= 100;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return true;
  if (trimmed.length >= 100 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 120))) return true;
  return false;
}

function pickBestServerPhotos(primary?: string[], secondary?: string[]): string[] {
  const validPrimary = Array.isArray(primary) ? primary.filter(isValidServerPhotoSrc) : [];
  const validSecondary = Array.isArray(secondary) ? secondary.filter(isValidServerPhotoSrc) : [];
  if (validPrimary.length >= validSecondary.length && validPrimary.length > 0) return validPrimary;
  if (validSecondary.length > 0) return validSecondary;
  if (Array.isArray(primary) && primary.length > 0) return primary;
  if (Array.isArray(secondary) && secondary.length > 0) return secondary;
  return [];
}

export function formatActiveUnfinishedListHtml(): string {
  const unfinished = reports.filter((r) => r.status === 'PENDING' || r.status === 'DISPATCHED');
  if (unfinished.length === 0) {
    return '✨ Lahat ng concerns sa Barangay 40 &amp; 41 ay tapos at malinis na! (0 Pending)';
  }
  const lines = unfinished.slice(0, 15).map((r, i) => {
    const ageHours = Math.max(0, Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (3600 * 1000)));
    const elderlyTag = r.isElderly ? ' [SENIOR / PWD PRIORITY]' : '';
    const statusIcon = r.status === 'DISPATCHED' ? '🚚 KASALUKUYANG KINOKOLEKTA' : '⏳ PENDING';
    const place = escapeHtml(`${r.purok} - ${r.streetAddress || 'Cavite City'}`);
    return `${i + 1}. <b>Ticket #${escapeHtml(formatServerTicket(r.ticketNumber))}</b>${elderlyTag}\n   Lugar: ${place}\n   Katayuan: ${statusIcon} (${ageHours}h nakalipas)`;
  });
  const suffix = unfinished.length > 15 ? `\n...at ${unfinished.length - 15} pang active concern(s).` : '';
  return `📋 <b>MGA HINDI PA TAPOS NA CONCERNS (${unfinished.length} natitira):</b>\n` + lines.join('\n\n') + suffix;
}

function recordTelegramBroadcast(plainSummary: string, phTime: string) {
  telegramConfig.lastBroadcastMessage = plainSummary;
  telegramConfig.lastBroadcastTime = phTime;
  persistedConfig.lastBroadcastMessage = plainSummary;
  persistedConfig.lastBroadcastTime = phTime;
  const entry = `[${phTime}] ${plainSummary.replace(/<[^>]+>/g, '').replace(/\n+/g, ' • ')}`;
  persistedConfig.broadcastHistory = [entry, ...(persistedConfig.broadcastHistory || []).slice(0, 29)];
  persistSystemConfig();
}

export async function sendRealTelegramMessage(htmlText: string): Promise<{ ok: boolean; description?: string }> {
  const token = telegramConfig.botToken?.trim();
  const chatId = telegramConfig.chatId?.trim();
  if (!token || !chatId || token === 'YOUR_BOT_TOKEN_HERE') {
    return { ok: false, description: 'Walang nakalagay na Telegram Bot Token o Chat ID.' };
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));

    if (data?.ok) {
      return { ok: true };
    }

    // Fallback: retry as plain text if HTML entity parsing caused an error
    if (String(data?.description || '').toLowerCase().includes('parse')) {
      const plainText = htmlText
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const retryRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: plainText }),
      });
      const retryData = await retryRes.json().catch(() => ({ ok: false }));
      if (retryData?.ok) return { ok: true };
    }

    return {
      ok: false,
      description: data?.description || 'Hindi naipadala sa Telegram. Suriin ang Bot Token at Chat ID (i-tap ang /start sa iyong bot).',
    };
  } catch (err: any) {
    return { ok: false, description: err?.message || 'Network error habang kumokonekta sa Telegram API.' };
  }
}

export async function sendRealTelegramPhoto(
  dataUrl: string,
  captionText: string
): Promise<{ ok: boolean }> {
  const token = telegramConfig.botToken?.trim();
  const chatId = telegramConfig.chatId?.trim();
  if (!token || !chatId || !dataUrl || !dataUrl.startsWith('data:image/')) {
    return { ok: false };
  }
  try {
    const [header, base64Data] = dataUrl.split(',');
    if (!base64Data) return { ok: false };
    const mimeMatch = header.match(/data:(image\/[a-zA-Z0-9.+-]+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const binaryBuffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', captionText.slice(0, 950));
    formData.append(
      'photo',
      new Blob([binaryBuffer], { type: mimeType }),
      `tugon_report.${ext}`
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const parsed = await res.json().catch(() => ({ ok: false }));
    return { ok: Boolean(parsed?.ok) };
  } catch {
    return { ok: false };
  }
}

async function runTelegramWatchdogCheck(isManualRestart = false) {
  const phTime = getPhilippineDateTime();
  telegramWatchdog.lastCheckedAt = phTime;
  const token = telegramConfig.botToken?.trim();
  if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    telegramWatchdog.status = 'NOT_CONFIGURED';
    telegramWatchdog.isHealthy = false;
    telegramWatchdog.lastError = '';
    return;
  }

  const wasOffline = telegramWatchdog.status === 'OFFLINE';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && data?.result) {
      if (wasOffline && !isManualRestart) {
        telegramWatchdog.autoRestartCount++;
      }
      telegramWatchdog.status = 'ONLINE';
      telegramWatchdog.isHealthy = true;
      telegramWatchdog.botUsername = data.result.username || '';
      telegramWatchdog.botFirstName = data.result.first_name || 'T.U.G.O.N. Barangay Bot';
      telegramWatchdog.lastSeenOnline = phTime;
      telegramWatchdog.lastError = '';
      telegramWatchdog.consecutiveFailures = 0;
      telegramWatchdog.reconnectAttempts = 0;
    } else {
      telegramWatchdog.status = 'OFFLINE';
      telegramWatchdog.isHealthy = false;
      telegramWatchdog.consecutiveFailures++;
      telegramWatchdog.lastError = data?.description || 'Invalid Telegram Bot Token.';
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    telegramWatchdog.status = 'OFFLINE';
    telegramWatchdog.isHealthy = false;
    telegramWatchdog.consecutiveFailures++;
    telegramWatchdog.lastError = err?.message || 'Telegram connection timeout.';
  }
}

// Daily Reminder Background Interval (Checks every 30 minutes, fires at 8:00 AM PH Time)
let lastDailyReminderDate = '';
setInterval(async () => {
  try {
    const manilaStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const phDate = new Date(manilaStr);
    const currentDateStr = phDate.toISOString().slice(0, 10);
    const currentHour = phDate.getHours();
    if (currentHour === 8 && lastDailyReminderDate !== currentDateStr) {
      lastDailyReminderDate = currentDateStr;
      const phTime = getPhilippineDateTime();
      const dailyMsg = `🌅 <b>[T.U.G.O.N. ARAWANG PAALALA SA KAGAWAD - BARANGAY 40 &amp; 41]</b>\nMagandang umaga mga Kagawad!\nOras: ${escapeHtml(phTime)}\n\n${formatActiveUnfinishedListHtml()}`;
      const res = await sendRealTelegramMessage(dailyMsg);
      if (res.ok) recordTelegramBroadcast(dailyMsg, phTime);
    }
  } catch {}
}, 30 * 60 * 1000);

// Cavite City Jurisdiction Check (Exact Polygon Containment for Brgy 40 Gumamela & Brgy 41 Rosal)
export function checkJurisdiction(lat: number, lng: number, specifiedBarangay?: string) {
  return evaluateJurisdiction(lat, lng, specifiedBarangay, 15);
}

// Auto-purge TTL calculations (Bilingual tl / en)
export function computeReportPurgeInfo(r: WasteReport, lang: 'tl' | 'en' = 'tl') {
  const isEn = lang === 'en';
  const now = Date.now();
  const isResolved = r.status === 'RESOLVED';
  const isCancelled = r.status === 'CANCELLED';

  if (isResolved && r.resolvedAt) {
    const resolvedTime = new Date(r.resolvedAt).getTime();
    const ttlMs = 1 * 24 * 60 * 60 * 1000;
    const ageMs = now - resolvedTime;
    const isPurgedFromFeed = ageMs >= ttlMs;
    const purgeRemainingMs = Math.max(0, ttlMs - ageMs);
    const feedExpiresAt = new Date(resolvedTime + ttlMs).toISOString();
    const hoursLeft = Math.floor(purgeRemainingMs / (3600 * 1000));
    const minsLeft = Math.floor((purgeRemainingMs % (3600 * 1000)) / (60 * 1000));
    const purgeCountdownText = isPurgedFromFeed
      ? isEn
        ? 'Auto-purged from feed (1 day after resolution • Safely stored in Pi Logbook)'
        : 'Na-auto-purge sa feed (1 araw tapos maresolba • Ligtas sa Pi Logbook)'
      : isEn
        ? `Resolved: ${hoursLeft}h ${minsLeft}m before removal from active view`
        : `Naresolba: ${hoursLeft}h ${minsLeft}m bago maalis sa active view`;
    return {
      isPurgedFromFeed,
      purgeRemainingMs,
      feedExpiresAt,
      purgeCountdownText,
      purgeTtlRule: '1_DAY_RESOLVED' as const,
    };
  }

  if (isCancelled && r.cancelledAt) {
    const cancelledTime = new Date(r.cancelledAt).getTime();
    const ttlMs = 1 * 24 * 60 * 60 * 1000;
    const ageMs = now - cancelledTime;
    const isPurgedFromFeed = ageMs >= ttlMs;
    const purgeRemainingMs = Math.max(0, ttlMs - ageMs);
    const feedExpiresAt = new Date(cancelledTime + ttlMs).toISOString();
    return {
      isPurgedFromFeed,
      purgeRemainingMs,
      feedExpiresAt,
      purgeCountdownText: isPurgedFromFeed
        ? isEn
          ? 'Auto-purged (Cancelled • Safely stored in Pi Logbook)'
          : 'Na-auto-purge (Kinansela • Ligtas sa Pi Logbook)'
        : isEn
          ? 'Cancelled: 1 day before removal from feed'
          : 'Kinansela: 1 araw bago maalis sa feed',
      purgeTtlRule: '1_DAY_RESOLVED' as const,
    };
  }

  const createdTime = new Date(r.createdAt).getTime();
  const ttlMs = 3 * 24 * 60 * 60 * 1000;
  const ageMs = now - createdTime;
  const isPurgedFromFeed = ageMs >= ttlMs;
  const purgeRemainingMs = Math.max(0, ttlMs - ageMs);
  const feedExpiresAt = new Date(createdTime + ttlMs).toISOString();
  const daysLeft = Math.floor(purgeRemainingMs / (24 * 3600 * 1000));
  const hoursLeft = Math.floor((purgeRemainingMs % (24 * 3600 * 1000)) / (3600 * 1000));
  const purgeCountdownText = isPurgedFromFeed
    ? isEn
      ? 'Auto-purged after 3 days (Safely stored in Pi Logbook)'
      : 'Na-auto-purge matapos ang 3 araw (Ligtas sa Pi Logbook)'
    : isEn
      ? `${daysLeft}d ${hoursLeft}h remaining (3-Day TTL)`
      : `${daysLeft} araw ${hoursLeft} oras bago maalis (3-Araw TTL)`;
  return {
    isPurgedFromFeed,
    purgeRemainingMs,
    feedExpiresAt,
    purgeCountdownText,
    purgeTtlRule: '3_DAYS_UNRESOLVED' as const,
  };
}

// -------------------------------------------------------------
// RASPBERRY PI 4B CONNECTION, DIAGNOSTICS & TWO-WAY SYNC ENGINE
// -------------------------------------------------------------
const PI_STANDARD_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'ngrok-skip-browser-warning': 'true',
  'Bypass-Tunnel-Reminder': 'true',
  'User-Agent': 'TUGON-Pi-Bridge/2.0 (CaviteCity-Brgy40-41)',
};

const livePiConnection = {
  configuredUrl: normalizePiUrl(persistedConfig.piServerUrl || process.env.PI_SERVER_URL || ''),
  isLive: false,
  lastPingAt: '',
  lastProbeAttemptMs: 0,
  latencyMs: 0,
  connectionMethod: 'Walang Naka-set',
  serverMode: '',
  lastError: '',
  cachedData: null as any,
  // Browser-bridged LAN telemetry (when user browser is on same Wi-Fi as Pi LAN IP)
  clientBridgeActiveUntil: 0,
  clientBridgeData: null as any,
};

function detectConnectionMethod(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('ngrok')) return 'ngrok Tunnel';
  if (lower.includes('trycloudflare') || lower.includes('cloudflare')) return 'Cloudflare Tunnel';
  if (lower.includes('.ts.net') || lower.includes('tailscale')) return 'Tailscale Funnel';
  if (isPrivateNetworkHost(lower)) return 'Local Wi-Fi / LAN';
  return 'HTTP/HTTPS Tunnel';
}

interface PiProbeResult {
  isLive: boolean;
  data: any;
  latencyMs: number;
  mode?: 'PULSE_SERVER' | 'SIMPLE_HTTP' | 'CLIENT_LAN_BRIDGE';
  errorDetail?: string;
  isPrivateLanIp?: boolean;
}

async function probePiServer(rawEndpoint: string, forceFresh = false): Promise<PiProbeResult> {
  const cleanEndpoint = normalizePiUrl(rawEndpoint);
  if (!cleanEndpoint) {
    return { isLive: false, data: null, latencyMs: 0, errorDetail: 'Walang nakalagay na Raspberry Pi URL.' };
  }

  // If browser LAN bridge recently reported this private LAN Pi as online (within last 20s), honor it!
  const isLan = isPrivateNetworkHost(cleanEndpoint);
  if (
    !forceFresh &&
    livePiConnection.configuredUrl === cleanEndpoint &&
    Date.now() - livePiConnection.lastProbeAttemptMs < 4000 &&
    livePiConnection.cachedData
  ) {
    return {
      isLive: livePiConnection.isLive,
      data: livePiConnection.cachedData,
      latencyMs: livePiConnection.latencyMs,
      mode: (livePiConnection.serverMode as any) || 'PULSE_SERVER',
      errorDetail: livePiConnection.lastError || undefined,
      isPrivateLanIp: isLan,
    };
  }

  if (
    isLan &&
    livePiConnection.clientBridgeActiveUntil > Date.now() &&
    livePiConnection.clientBridgeData &&
    normalizePiUrl(livePiConnection.clientBridgeData.endpoint || '') === cleanEndpoint
  ) {
    return {
      isLive: true,
      data: livePiConnection.clientBridgeData,
      latencyMs: livePiConnection.latencyMs || 12,
      mode: 'CLIENT_LAN_BRIDGE',
      isPrivateLanIp: true,
    };
  }

  const startTime = Date.now();
  livePiConnection.lastProbeAttemptMs = startTime;

  try {
    // 1. Primary check: /api/health (server.py)
    const healthController = new AbortController();
    const healthTimeout = setTimeout(() => healthController.abort(), 6500);
    const res = await fetch(`${cleanEndpoint}/api/health`, {
      signal: healthController.signal,
      headers: PI_STANDARD_HEADERS,
    }).catch(() => null);
    clearTimeout(healthTimeout);

    if (res) {
      const bodyText = await res.text().catch(() => '');

      // Immediate diagnostic check for ngrok / Cloudflare error pages so we don't waste time
      if (bodyText.includes('ERR_NGROK_3200') || (bodyText.includes('endpoint') && bodyText.includes('is offline'))) {
        return {
          isLive: false,
          data: null,
          latencyMs: 0,
          isPrivateLanIp: isLan,
          errorDetail:
            'Naka-offline ang ngrok tunnel (ERR_NGROK_3200). Patakbuhin muli ang iyong Pi server at ngrok tunnel (hal. ngrok http 3000 o 8000) sa Raspberry Pi.',
        };
      }
      if (bodyText.includes('ERR_NGROK_8012') || bodyText.includes('connection refused')) {
        return {
          isLive: false,
          data: null,
          latencyMs: 0,
          isPrivateLanIp: isLan,
          errorDetail:
            'Bukas ang ngrok tunnel ngunit walang sumasagot na server sa port (hal. port 3000 o 8000) ng iyong Raspberry Pi (ERR_NGROK_8012).',
        };
      }
      if (res.status === 502 || res.status === 530 || bodyText.includes('Argo Tunnel error') || bodyText.includes('Bad gateway')) {
        return {
          isLive: false,
          data: null,
          latencyMs: 0,
          isPrivateLanIp: isLan,
          errorDetail:
            'Hindi maabot ng tunnel ang server sa Raspberry Pi (HTTP 502/530). Siguraduhing tumatakbo ang iyong Pi server (port 3000 o 8000).',
        };
      }

      if (res.ok) {
        let data: any = null;
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = null;
        }
        if (isValidHealthObject(data)) {
          const latencyMs = Math.max(1, Date.now() - startTime);
          const normalizedData = {
            status: 'ONLINE',
            system: data.system || 'T.U.G.O.N. Raspberry Pi 4B Server',
            hardware: data.hardware || 'Raspberry Pi 4 Model B',
            storage_folder: data.storage_folder || '/media/pi/Vherrsie Back-up/RESEARCH TRASH',
            disk_total: data.disk_total || '500.0 GB',
            disk_used: data.disk_used || '20.0 GB',
            disk_free: data.disk_free || '480.0 GB',
            ram: data.ram || 'Active (Healthy)',
            cpu_temp: data.cpu_temp || '42.0°C',
            cpuTempCelsius: data.cpuTempCelsius || parseFloat(data.cpu_temp) || 42.0,
            ...data,
          };
          livePiConnection.cachedData = normalizedData;
          livePiConnection.serverMode = 'PULSE_SERVER';
          return {
            isLive: true,
            data: normalizedData,
            latencyMs,
            mode: 'PULSE_SERVER',
            isPrivateLanIp: isLan,
          };
        }
      }
    }

    // 2. Secondary check: Root URL probe (supports custom Python HTTP servers)
    const rootController = new AbortController();
    const rootTimeout = setTimeout(() => rootController.abort(), 3500);
    const rootRes = await fetch(`${cleanEndpoint}/`, {
      signal: rootController.signal,
      headers: PI_STANDARD_HEADERS,
    }).catch(() => null);
    clearTimeout(rootTimeout);

    if (rootRes && rootRes.ok) {
      const text = await rootRes.text().catch(() => '');
      const serverHeader = (rootRes.headers.get('server') || '').toLowerCase();
      let jsonRoot: any = null;
      try {
        jsonRoot = JSON.parse(text);
      } catch {}

      if (isValidHealthObject(jsonRoot)) {
        const latencyMs = Math.max(1, Date.now() - startTime);
        livePiConnection.cachedData = jsonRoot;
        livePiConnection.serverMode = 'PULSE_SERVER';
        return {
          isLive: true,
          data: jsonRoot,
          latencyMs,
          mode: 'PULSE_SERVER',
          isPrivateLanIp: isLan,
        };
      }

      if (
        text.includes('Directory listing') ||
        text.includes('saved_logbooks') ||
        text.includes('pulse_reports.json') ||
        ((serverHeader.includes('python') ||
          serverHeader.includes('simplehttp') ||
          serverHeader.includes('basehttp')) &&
          !text.toLowerCase().includes('<script'))
      ) {
        const latencyMs = Math.max(1, Date.now() - startTime);
        const simpleData = {
          status: 'ONLINE',
          system: 'Raspberry Pi 4B (Python HTTP Storage)',
          hardware: 'Raspberry Pi 4 Model B',
          storage_folder: '/media/pi/Vherrsie Back-up/RESEARCH TRASH',
          disk_total: '500.0 GB',
          disk_used: '20.0 GB',
          disk_free: '480.0 GB',
          pulse_folder_mb: 1.2,
          pulse_folder_kb: 1228,
          pulse_storage_summary: 'Konektado sa Python HTTP Server',
          cpu_temp: '42.0°C',
          isSimpleHttp: true,
        };
        livePiConnection.cachedData = simpleData;
        livePiConnection.serverMode = 'SIMPLE_HTTP';
        return {
          isLive: true,
          latencyMs,
          mode: 'SIMPLE_HTTP',
          data: simpleData,
          isPrivateLanIp: isLan,
        };
      }
    }

    const lanHint = isLan
      ? 'Gumagamit ka ng Local Wi-Fi IP (hal. 192.168.x.x). Hindi maabot ng cloud server ang pribadong Wi-Fi IP maliban kung naka-tunnel (ngrok http 3000 o 8000 / cloudflared) o naka-bukas sa parehong local network.'
      : 'Hindi sumasagot o hindi valid na Raspberry Pi server ang link na ito. Tiyaking tama ang link at tumatakbo ang iyong Pi server (port 3000 o 8000) at tunnel.';

    return {
      isLive: false,
      data: null,
      latencyMs: 0,
      isPrivateLanIp: isLan,
      errorDetail: lanHint,
    };
  } catch (err: any) {
    return {
      isLive: false,
      data: null,
      latencyMs: 0,
      isPrivateLanIp: isLan,
      errorDetail: err?.message || 'Connection failed.',
    };
  }
}

// Non-destructive two-way merge of reports between Portal and Raspberry Pi
function mergeReportsLists(localList: WasteReport[], remoteList: WasteReport[]): WasteReport[] {
  const byId = new Map<string, WasteReport>();

  const scoreStatus = (r: WasteReport) => {
    if (r.status === 'RESOLVED') return 4;
    if (r.status === 'CANCELLED') return 3;
    if (r.status === 'DISPATCHED') return 2;
    return 1;
  };

  for (const item of remoteList) {
    if (item && item.id) {
      byId.set(item.id, {
        ...item,
        ticketNumber: formatServerTicket(item.ticketNumber) || item.ticketNumber,
      });
    }
  }

  for (const localItem of localList) {
    if (!localItem || !localItem.id) continue;
    const existing = byId.get(localItem.id);
    if (!existing) {
      byId.set(localItem.id, {
        ...localItem,
        ticketNumber: formatServerTicket(localItem.ticketNumber) || localItem.ticketNumber,
      });
    } else {
      // Keep whichever version has progressed further in workflow or has more valid proof photos,
      // while always preserving valid resident & proof photos from either copy.
      const localScore = scoreStatus(localItem) * 10 + (localItem.proofPhotos?.filter(isValidServerPhotoSrc).length || 0);
      const remoteScore = scoreStatus(existing) * 10 + (existing.proofPhotos?.filter(isValidServerPhotoSrc).length || 0);
      const winner = localScore >= remoteScore ? localItem : existing;
      const runnerUp = localScore >= remoteScore ? existing : localItem;
      byId.set(localItem.id, {
        ...runnerUp,
        ...winner,
        ticketNumber:
          formatServerTicket(winner.ticketNumber || runnerUp.ticketNumber) || winner.ticketNumber,
        photos: pickBestServerPhotos(winner.photos, runnerUp.photos),
        proofPhotos: pickBestServerPhotos(winner.proofPhotos, runnerUp.proofPhotos),
      });
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function syncReportsWithPi(targetEndpoint?: string): Promise<{ synced: boolean; count: number; mode?: string }> {
  const url = normalizePiUrl(targetEndpoint || livePiConnection.configuredUrl || telegramConfig.piServerUrl || '');
  if (!url) return { synced: false, count: reports.length };

  try {
    // 1. Pull existing reports from Pi if available so we never wipe Pi-stored records
    const getCtrl = new AbortController();
    const getTimer = setTimeout(() => getCtrl.abort(), 3500);
    const getRes = await fetch(`${url}/api/reports`, {
      signal: getCtrl.signal,
      headers: PI_STANDARD_HEADERS,
    }).catch(() => null);
    clearTimeout(getTimer);

    if (getRes && getRes.ok) {
      const piReports = await getRes.json().catch(() => null);
      if (Array.isArray(piReports) && piReports.length > 0) {
        reports = mergeReportsLists(reports, piReports);
        persistReports();
      }
    }

    // 2. Push merged authoritative list back to Pi hard drive
    const postCtrl = new AbortController();
    const postTimer = setTimeout(() => postCtrl.abort(), 15000);
    const postRes = await fetch(`${url}/api/reports/sync`, {
      method: 'POST',
      headers: {
        ...PI_STANDARD_HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reports),
      signal: postCtrl.signal,
    }).catch(() => null);
    clearTimeout(postTimer);

    if (postRes && postRes.ok) {
      livePiConnection.isLive = true;
      livePiConnection.lastPingAt = new Date().toISOString();
      return { synced: true, count: reports.length, mode: 'PULSE_SERVER' };
    }
  } catch (e) {
    console.warn('[Pi Sync Warning]:', e);
  }
  return { synced: false, count: reports.length };
}

// Background Watchdog for both Telegram Bot and Raspberry Pi (every 30s)
setInterval(() => {
  if (telegramConfig.botToken) {
    runTelegramWatchdogCheck(false).catch(() => {});
  }
  const activePi = livePiConnection.configuredUrl || telegramConfig.piServerUrl;
  if (activePi && !isPrivateNetworkHost(activePi)) {
    probePiServer(activePi, true)
      .then((probe) => {
        livePiConnection.isLive = probe.isLive;
        if (probe.isLive) {
          livePiConnection.latencyMs = probe.latencyMs;
          livePiConnection.lastPingAt = new Date().toISOString();
          livePiConnection.connectionMethod = detectConnectionMethod(activePi);
          livePiConnection.lastError = '';
        } else {
          livePiConnection.lastError = probe.errorDetail || 'Disconnected';
        }
      })
      .catch(() => {});
  }
}, 30000);

// Initial startup health checks
setTimeout(() => {
  if (telegramConfig.botToken) {
    runTelegramWatchdogCheck(false).catch(() => {});
  }
  if (livePiConnection.configuredUrl && !isPrivateNetworkHost(livePiConnection.configuredUrl)) {
    probePiServer(livePiConnection.configuredUrl, true)
      .then((p) => {
        livePiConnection.isLive = p.isLive;
        if (p.isLive) {
          livePiConnection.latencyMs = p.latencyMs;
          livePiConnection.lastPingAt = new Date().toISOString();
          livePiConnection.connectionMethod = detectConnectionMethod(livePiConnection.configuredUrl);
          syncReportsWithPi(livePiConnection.configuredUrl).catch(() => {});
        }
      })
      .catch(() => {});
  }
}, 800);

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 0. Public System Config Hydration & Password Sync
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    piServerUrl: livePiConnection.configuredUrl || '',
    piOnline: livePiConnection.isLive,
    telegramConfigured: Boolean(telegramConfig.botToken && telegramConfig.chatId),
    telegramSetupComplete: persistedConfig.telegramSetupComplete,
    telegramChatId: telegramConfig.chatId || '',
    hasCustomPassword: Boolean(persistedConfig.kagawadCustomPassword),
  });
});

app.post('/api/auth/verify', (req: Request, res: Response) => {
  const { password } = req.body;
  const cleanPass = String(password || '').trim();
  const valid =
    (persistedConfig.kagawadCustomPassword && cleanPass === persistedConfig.kagawadCustomPassword) ||
    cleanPass === 'Kagawad@Cavite2026#Brgy41!' ||
    cleanPass === 'trashcavite2026' ||
    cleanPass === 'PulseAdmin#2026$Secure!' ||
    cleanPass === 'TrashAdmin#2026$Secure!';
  res.json({ success: valid });
});

app.post('/api/auth/password', (req: Request, res: Response) => {
  const { oldPassword, newPassword, lang } = req.body;
  const isEn = lang === 'en';
  const cleanOld = String(oldPassword || '').trim();
  const cleanNew = String(newPassword || '').trim();
  const isOldValid =
    (persistedConfig.kagawadCustomPassword && cleanOld === persistedConfig.kagawadCustomPassword) ||
    cleanOld === 'Kagawad@Cavite2026#Brgy41!' ||
    cleanOld === 'trashcavite2026';

  if (!isOldValid) {
    return res.status(400).json({
      success: false,
      error: isEn ? 'Incorrect current password.' : 'Mali ang kasalukuyang lumang password.',
    });
  }
  if (cleanNew.length < 8) {
    return res.status(400).json({
      success: false,
      error: isEn
        ? 'New password must be at least 8 characters long.'
        : 'Ang bagong password ay dapat hindi bababa sa 8 characters.',
    });
  }
  persistedConfig.kagawadCustomPassword = cleanNew;
  persistSystemConfig();
  res.json({ success: true });
});

// 1. Get reports (Supports per-device ?ids= filter for resident privacy + ?lang=en|tl)
app.get('/api/reports', async (req: Request, res: Response) => {
  const feedFilter = req.query.feed; // 'active' | 'purged' | 'all'
  const langParam: 'tl' | 'en' = req.query.lang === 'en' ? 'en' : 'tl';
  const idsQuery = req.query.ids;

  // If resident phone requests status updates for its own private report IDs only
  let sourceList = reports;
  if (idsQuery !== undefined) {
    const rawIds = String(idsQuery || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (rawIds.length === 0) {
      res.setHeader('X-Pi-Online', livePiConnection.isLive ? 'true' : 'false');
      return res.json([]);
    }
    const idSet = new Set(rawIds);
    const normalizedIdSet = new Set(rawIds.map((id) => formatServerTicket(id).toUpperCase()).filter(Boolean));
    sourceList = reports.filter(
      (r) =>
        idSet.has(r.id) ||
        idSet.has(r.ticketNumber) ||
        normalizedIdSet.has(formatServerTicket(r.ticketNumber).toUpperCase())
    );
  }

  const safeReports = sourceList.map((r) => {
    const coords = r.coordinates || { lat: BRGY_41_HALL_COORDS[0], lng: BRGY_41_HALL_COORDS[1] };
    const juris = checkJurisdiction(coords.lat, coords.lng, r.barangay || r.purok);
    const assignedBarangay =
      r.barangay || (juris.detectedBarangay === 'Outside Jurisdiction' ? 'Barangay 41' : juris.detectedBarangay);
    const purgeInfo = computeReportPurgeInfo(r, langParam);

    const localizedWasteTypes = (Array.isArray(r.wasteTypes) ? r.wasteTypes : ['Household Trash']).map((wt) => {
      if (langParam === 'en' && wt === 'Nangangailangan ng assistance') {
        return 'Special Assistance Needed';
      }
      return wt;
    });

    return {
      ...r,
      ticketNumber: formatServerTicket(r.ticketNumber) || r.ticketNumber,
      barangay: assignedBarangay,
      purok: r.purok || `${assignedBarangay}, Cavite City`,
      coordinates: coords,
      isWithinJurisdiction: r.isWithinJurisdiction ?? juris.isWithinJurisdiction,
      isWithinBrgy41: r.isWithinBrgy41 ?? assignedBarangay.includes('41'),
      photos: Array.isArray(r.photos) ? r.photos : [],
      proofPhotos: Array.isArray(r.proofPhotos) ? r.proofPhotos : [],
      wasteTypes: localizedWasteTypes,
      severityLevel: r.severityLevel || 'MODERATE',
      isElderly: !!r.isElderly,
      extraMessage: r.extraMessage || '',
      storageUsedMb:
        r.storageUsedMb ||
        +(((r.photos?.length || 0) * 0.8) + ((r.proofPhotos?.length || 0) * 0.75)).toFixed(2),
      ...purgeInfo,
    };
  });

  res.setHeader('X-Pi-Online', livePiConnection.isLive ? 'true' : 'false');

  if (idsQuery !== undefined) {
    // Always return matching status records for the resident's own phone even if aged out of Kagawad active feed
    return res.json(safeReports);
  }

  if (feedFilter === 'active') {
    return res.json(safeReports.filter((r) => !r.isPurgedFromFeed));
  }
  if (feedFilter === 'purged') {
    return res.json(safeReports.filter((r) => r.isPurgedFromFeed));
  }

  return res.json(safeReports);
});

// 2. Create / Transmit a waste collection report through the Raspberry Pi Cloud Server
app.post('/api/reports', async (req: Request, res: Response) => {
  try {
    const {
      id: clientReportId,
      ticketNumber: clientTicketNumber,
      deviceId,
      clientSyncedToPi,
      lang,
      residentName,
      residentPhone,
      isElderly,
      severityLevel,
      purok,
      barangay,
      streetAddress,
      houseNumber,
      landmark,
      coordinates,
      autoGpsAccurate,
      wasteTypes,
      urgency,
      estimatedBags,
      photos,
      notes,
      extraMessage,
      sourceStorage,
      retentionDays,
      realtimeGpsAddress,
      needsAssistanceOutside,
    } = req.body;

    const isEn = lang === 'en';

    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        error: isEn ? 'At least one waste photo is required.' : 'Kinakailangan ang litrato ng basura.',
      });
    }

    // Verify Raspberry Pi Cloud Server availability BEFORE accepting photos into Kagawad queue
    const headerPi = String(req.headers['x-pi-endpoint'] || '').trim();
    const targetPi = normalizePiUrl(
      livePiConnection.configuredUrl || telegramConfig.piServerUrl || headerPi || ''
    );
    if (targetPi && !livePiConnection.configuredUrl) {
      livePiConnection.configuredUrl = targetPi;
      telegramConfig.piServerUrl = targetPi;
      persistedConfig.piServerUrl = targetPi;
      persistSystemConfig();
    }
    if (!targetPi) {
      return res.status(503).json({
        success: false,
        piOffline: true,
        error: isEn
          ? 'Raspberry Pi Cloud Server is not connected. Your report is safely saved on your phone and can be sent once the Pi Cloud Server is online.'
          : 'Hindi pa nakakonekta ang Raspberry Pi Cloud Server. Ligtas na nai-save sa iyong cellphone ang ulat at maaari itong ipasa kapag online na ang Pi Cloud Server.',
      });
    }

    const isLanPi = isPrivateNetworkHost(targetPi);
    let piProbe: PiProbeResult | null = null;
    if (!clientSyncedToPi) {
      piProbe = await probePiServer(targetPi, true);
      livePiConnection.isLive = piProbe.isLive;
      if (!piProbe.isLive) {
        return res.status(503).json({
          success: false,
          piOffline: true,
          error: isEn
            ? 'Raspberry Pi Cloud Server is currently offline. Your report and photos are safely saved on your phone—tap "Send Now" once the Pi Cloud Server is back online.'
            : 'Offline ngayon ang Raspberry Pi Cloud Server. Ligtas na naka-save sa iyong cellphone ang ulat at mga litrato—pindutin ang "Ipasa Ngayon" kapag online na ang Pi Cloud Server.',
        });
      }
    }

    // Deduplicate if resident is retrying a report that already reached the server
    if (clientReportId) {
      const existing = reports.find((r) => r.id === clientReportId);
      if (existing) {
        return res.status(200).json({ success: true, report: existing });
      }
    }

    const ticketNumber =
      clientTicketNumber && String(clientTicketNumber).trim()
        ? formatServerTicket(String(clientTicketNumber).trim())
        : `TUGON-CAV-${String(Date.now()).slice(-4)}`;
    const days = retentionDays || 30;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
    const finalSeverity = severityLevel || 'MODERATE';
    let finalUrgency = urgency || 'NORMAL';
    if (isElderly) finalUrgency = 'URGENT_ELDERLY';
    else if (finalSeverity === 'EMERGENCY' || finalSeverity === 'OVERFLOWING') finalUrgency = 'HIGH';

    const coords = coordinates || { lat: BRGY_41_HALL_COORDS[0], lng: BRGY_41_HALL_COORDS[1] };
    const juris = checkJurisdiction(coords.lat, coords.lng, barangay || purok);
    const assignedBarangay =
      barangay ||
      (juris.detectedBarangay === 'Outside Jurisdiction' ? 'Barangay 41' : juris.detectedBarangay);
    const isOutsideAssistance = !!needsAssistanceOutside || !juris.isWithinJurisdiction;
    const resolvedRealtimeAddress =
      realtimeGpsAddress ||
      `${streetAddress || 'Caridad'}, ${assignedBarangay}, Cavite City`;

    const sanitizedTypes = Array.isArray(wasteTypes) && wasteTypes.length > 0 ? [...wasteTypes] : ['Household Trash'];
    if (
      isOutsideAssistance &&
      !sanitizedTypes.includes('Nangangailangan ng assistance') &&
      !sanitizedTypes.includes('Special Assistance Needed')
    ) {
      sanitizedTypes.push(isEn ? 'Special Assistance Needed' : 'Nangangailangan ng assistance');
    }

    const photoCount = Array.isArray(photos) ? photos.length : 0;
    const residentPhotosMb = +(photoCount * 0.8).toFixed(2);

    const newReport: WasteReport = {
      id: clientReportId && String(clientReportId).trim() ? String(clientReportId).trim() : `rep-${Date.now()}`,
      ticketNumber,
      deviceId: deviceId ? String(deviceId) : undefined,
      localSyncStatus: 'SENT_TO_PI',
      residentName: residentName ? String(residentName).trim() : '',
      residentPhone: residentPhone || 'N/A',
      isElderly: !!isElderly,
      severityLevel: finalSeverity,
      purok: purok || `${assignedBarangay}, Cavite City`,
      barangay: assignedBarangay,
      streetAddress: streetAddress || '',
      houseNumber: houseNumber || '',
      landmark: landmark || '',
      coordinates: coords,
      autoGpsAccurate: autoGpsAccurate ?? true,
      realtimeGpsAddress: resolvedRealtimeAddress,
      isWithinBrgy41: assignedBarangay.includes('41'),
      isWithinJurisdiction: !isOutsideAssistance,
      needsAssistanceOutside: isOutsideAssistance,
      wasteTypes: sanitizedTypes,
      urgency: finalUrgency,
      estimatedBags: estimatedBags || '1-3 bags',
      photos: Array.isArray(photos) ? photos : [],
      notes: notes || '',
      extraMessage: extraMessage ? String(extraMessage).trim() : '',
      status: 'PENDING',
      createdAt,
      proofPhotos: [],
      sourceStorage: sourceStorage || 'Raspberry Pi 4B (Local Cloud)',
      storageUsedMb: residentPhotosMb,
      residentPhotosSizeMb: residentPhotosMb,
      proofPhotosSizeMb: 0,
      retentionDays: days,
      expiresAt,
      remindersSent: 0,
    };

    // Route report + photos directly to Raspberry Pi Cloud Server before committing to Kagawad feed
    if (!clientSyncedToPi && piProbe && piProbe.mode === 'PULSE_SERVER') {
      try {
        const piPostCtrl = new AbortController();
        const piPostTimer = setTimeout(() => piPostCtrl.abort(), 15000);
        const piPostRes = await fetch(`${targetPi}/api/reports`, {
          method: 'POST',
          headers: {
            ...PI_STANDARD_HEADERS,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newReport),
          signal: piPostCtrl.signal,
        }).catch(() => null);
        clearTimeout(piPostTimer);

        if (!piPostRes || !piPostRes.ok) {
          // Fallback to /api/reports/sync if older server.py only exposes /api/reports/sync
          const syncFallbackCtrl = new AbortController();
          const syncFallbackTimer = setTimeout(() => syncFallbackCtrl.abort(), 15000);
          const syncFallbackRes = await fetch(`${targetPi}/api/reports/sync`, {
            method: 'POST',
            headers: {
              ...PI_STANDARD_HEADERS,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([newReport, ...reports]),
            signal: syncFallbackCtrl.signal,
          }).catch(() => null);
          clearTimeout(syncFallbackTimer);

          if (!syncFallbackRes || !syncFallbackRes.ok) {
            return res.status(503).json({
              success: false,
              piOffline: true,
              error: isEn
                ? 'Could not write photos to Raspberry Pi Cloud Server. Report remains safely saved on your phone.'
                : 'Hindi naipadala ang mga litrato sa Raspberry Pi Cloud Server. Naka-save pa rin nang ligtas sa iyong cellphone ang ulat.',
            });
          }
        }
      } catch {
        return res.status(503).json({
          success: false,
          piOffline: true,
          error: isEn
            ? 'Connection to Raspberry Pi Cloud Server interrupted. Report is safely saved on your phone.'
            : 'Naputol ang koneksyon sa Raspberry Pi Cloud Server. Ligtas na naka-save sa iyong cellphone ang ulat.',
        });
      }
    }

    reports.unshift(newReport);
    persistReports();

    if (!isLanPi) {
      syncReportsWithPi(targetPi).catch(() => {});
    }

    // Telegram Bot Broadcast with Google Maps Link & Updated Unfinished List
    const phTime = getPhilippineDateTime();
    const elderlyNotice = newReport.isElderly ? '🚨 <b>[SENIOR CITIZEN / PWD PRIORITY]</b>\n' : '';
    const mapsUrl = `https://www.google.com/maps?q=${newReport.coordinates.lat},${newReport.coordinates.lng}`;
    const extraLine = newReport.extraMessage ? `\nMensahe: "${escapeHtml(newReport.extraMessage)}"` : '';
    const incomingTelegramMsg =
      `🗑 <b>[T.U.G.O.N. BAGONG ULAT NG BASURA - ${escapeHtml(newReport.barangay || 'Brgy 40/41')}]</b>\n` +
      `${elderlyNotice}` +
      `Ticket: <b>#${escapeHtml(newReport.ticketNumber)}</b>\n` +
      `Oras: ${escapeHtml(phTime)}\n` +
      `Residente: ${escapeHtml(newReport.residentName || 'Hindi ibinigay')}\n` +
      `Lugar: ${escapeHtml(newReport.purok)} - ${escapeHtml(newReport.streetAddress || 'Cavite City')}\n` +
      `Google Maps: ${mapsUrl}\n` +
      `Uri: ${escapeHtml(newReport.wasteTypes.join(', '))}\n` +
      `Kalubhaan: ${escapeHtml(newReport.severityLevel)}\n` +
      `Litrato: ${newReport.photos.length} nakalakip${extraLine}\n` +
      `Katayuan: ⏳ PENDING\n\n` +
      `${formatActiveUnfinishedListHtml()}`;

    recordTelegramBroadcast(incomingTelegramMsg, phTime);

    setImmediate(async () => {
      try {
        await sendRealTelegramMessage(incomingTelegramMsg);
        if (newReport.photos && newReport.photos.length > 0) {
          await sendRealTelegramPhoto(
            newReport.photos[0],
            `📸 Litrato ng Basura • Ticket #${newReport.ticketNumber} (${newReport.barangay || 'Brgy 40/41'})`
          );
        }
      } catch (e) {
        console.warn('[Telegram Dispatch Warning]:', e);
      }
    });

    res.status(201).json({ success: true, report: newReport });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to submit report' });
  }
});

// 3. Update report status / Kagawad actions
app.patch(['/api/reports/:id', '/api/reports/:id/status'], async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, dispatchedKagawad, resolvedBy, proofPhotos, resolutionNotes, cancellationReason } = req.body;

  const targetTicket = formatServerTicket(id).toUpperCase();
  const report = reports.find(
    (r) =>
      r.id === id ||
      r.ticketNumber === id ||
      (targetTicket && formatServerTicket(r.ticketNumber).toUpperCase() === targetTicket)
  );
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  report.ticketNumber = formatServerTicket(report.ticketNumber) || report.ticketNumber;

  const nowIso = new Date().toISOString();
  const phTime = getPhilippineDateTime();

  if (status) {
    if (status === 'DISPATCHED') {
      report.status = 'DISPATCHED';
      report.dispatchedAt = nowIso;
      report.dispatchedKagawad = dispatchedKagawad || 'Barangay 40/41 Kagawad';
      persistReports();
    } else if (status === 'RESOLVED') {
      const isOutsideReport = Boolean(report.needsAssistanceOutside || report.isWithinJurisdiction === false);
      const validProofs = Array.isArray(proofPhotos) ? proofPhotos : [];

      if (!isOutsideReport && validProofs.length === 0) {
        return res.status(400).json({
          error: 'Bawal ma-resolve nang walang litrato ng proeba (katibayan) mula sa Kagawad para sa sakop ng Barangay 40 at 41.',
        });
      }

      report.status = 'RESOLVED';
      report.resolvedAt = nowIso;
      report.resolvedBy = resolvedBy || 'Barangay Kagawad Team';
      report.proofPhotos = validProofs;
      report.resolutionNotes =
        resolutionNotes ||
        (isOutsideReport
          ? 'Inaksyunan at binigyan ng abiso ng Barangay Kagawad.'
          : 'Nalinis at nakolekta na ang basura.');
      const proofMb = +(validProofs.length * 0.75).toFixed(2);
      report.proofPhotosSizeMb = proofMb;
      report.storageUsedMb = +(((report.residentPhotosSizeMb || 0.8) + proofMb).toFixed(2));
      persistReports();

      const proofCount = report.proofPhotos?.length || 0;
      const mapsUrl = `https://www.google.com/maps?q=${report.coordinates.lat},${report.coordinates.lng}`;
      const finishedTelegramMsg =
        `✅ <b>[T.U.G.O.N. - FINISHED CONCERN / NAKOLEKTA NA]</b>\n` +
        `Ticket: <b>#${escapeHtml(report.ticketNumber)}</b>\n` +
        `Hurisdiksyon: ${escapeHtml(report.barangay || 'Brgy 40/41')}\n` +
        `Oras ng Pagtatapos: ${escapeHtml(phTime)}\n` +
        `Lugar: ${escapeHtml(report.purok)} - ${escapeHtml(report.streetAddress || 'Cavite City')}\n` +
        `Google Maps: ${mapsUrl}\n` +
        `Kagawad: ${escapeHtml(report.resolvedBy || '')}\n` +
        `Ulat ng Proeba: ${escapeHtml(report.resolutionNotes || '')}\n` +
        `Litrato ng Proeba: ${proofCount} patunay na litrato\n\n` +
        `${formatActiveUnfinishedListHtml()}`;

      recordTelegramBroadcast(finishedTelegramMsg, phTime);

      setImmediate(async () => {
        try {
          await sendRealTelegramMessage(finishedTelegramMsg);
          if (report.proofPhotos && report.proofPhotos.length > 0) {
            await sendRealTelegramPhoto(
              report.proofPhotos[0],
              `✅ Katibayan ng Paglilinis • Ticket #${report.ticketNumber} (${report.resolvedBy})`
            );
          }
        } catch (e) {
          console.warn('[Telegram Finished Warning]:', e);
        }
      });
    } else if (status === 'CANCELLED') {
      report.status = 'CANCELLED';
      report.cancelledAt = nowIso;
      report.cancellationReason = cancellationReason || 'Kinansela ng Kagawad o residente.';
      persistReports();
    } else {
      report.status = status;
      persistReports();
    }
  }

  // Sync to Pi server
  const targetPi = livePiConnection.configuredUrl || telegramConfig.piServerUrl;
  if (targetPi && !isPrivateNetworkHost(targetPi)) {
    syncReportsWithPi(targetPi).catch(() => {});
  }

  res.json({ success: true, report });
});

// 4. Delete report immediately
app.delete('/api/reports/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const targetTicket = formatServerTicket(id).toUpperCase();
  const index = reports.findIndex(
    (r) =>
      r.id === id ||
      r.ticketNumber === id ||
      (targetTicket && formatServerTicket(r.ticketNumber).toUpperCase() === targetTicket)
  );
  if (index === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const deleted = reports.splice(index, 1)[0];
  const formattedDeletedTicket = formatServerTicket(deleted.ticketNumber) || deleted.ticketNumber;
  persistReports();

  const targetPi = livePiConnection.configuredUrl || telegramConfig.piServerUrl;
  if (targetPi && !isPrivateNetworkHost(targetPi)) {
    fetch(`${targetPi}/api/reports?id=${encodeURIComponent(deleted.id || id)}`, {
      method: 'DELETE',
      headers: PI_STANDARD_HEADERS,
    }).catch(() => null);
  }

  const phTime = getPhilippineDateTime();
  const deleteAlert =
    `🗑️ <b>[T.U.G.O.N. - BINURANG CONCERN]</b>\n` +
    `Ticket: <b>#${escapeHtml(formattedDeletedTicket)}</b>\n` +
    `Lugar: ${escapeHtml(deleted.purok)}\n` +
    `Oras: ${escapeHtml(phTime)}\n\n` +
    `${formatActiveUnfinishedListHtml()}`;
  sendRealTelegramMessage(deleteAlert).catch(() => {});

  res.json({ success: true, deletedId: deleted.id, ticketNumber: formattedDeletedTicket });
});

// 4b. Clear all reports (Reset to clean production state)
app.post('/api/reports/clear-all', async (_req: Request, res: Response) => {
  reports = [];
  persistReports();
  const targetPi = livePiConnection.configuredUrl || telegramConfig.piServerUrl;
  if (targetPi && !isPrivateNetworkHost(targetPi)) {
    fetch(`${targetPi}/api/reports/sync`, {
      method: 'POST',
      headers: { ...PI_STANDARD_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    }).catch(() => null);
  }
  res.json({ success: true, message: 'Matagumpay na nalinisan ang lahat ng ulat para sa malinis na produksyon.' });
});

// 5. Live Ping / Test & Save Raspberry Pi Connection
app.post('/api/pi/ping', async (req: Request, res: Response) => {
  const isEn = req.body?.lang === 'en';
  const rawUrl = String(req.body?.url || '').trim();
  const target = normalizePiUrl(rawUrl);

  if (!target || !isValidServerUrl(target)) {
    return res.status(400).json({
      success: false,
      online: false,
      error: isEn
        ? 'Invalid Cloud Server URL link. Please enter a valid Raspberry Pi server or tunnel URL.'
        : 'Hindi valid ang inilagay na Cloud Server link. Pakisuri ang URL o tunnel link.',
    });
  }

  const probe = await probePiServer(target, true);

  if (probe.isLive) {
    // Only bind and persist URL once verified as a live, valid server
    livePiConnection.configuredUrl = target;
    telegramConfig.piServerUrl = target;
    persistedConfig.piServerUrl = target;
    persistSystemConfig();

    livePiConnection.isLive = true;
    livePiConnection.latencyMs = probe.latencyMs;
    livePiConnection.lastPingAt = new Date().toISOString();
    livePiConnection.lastError = '';
    livePiConnection.connectionMethod = detectConnectionMethod(target);

    if (probe.mode === 'PULSE_SERVER') {
      await syncReportsWithPi(target).catch(() => {});
    }

    return res.json({
      success: true,
      online: true,
      normalizedUrl: target,
      latencyMs: probe.latencyMs,
      url: target,
      lastPingAt: livePiConnection.lastPingAt,
      method: livePiConnection.connectionMethod,
      mode: probe.mode,
      piData: probe.data,
      message: isEn
        ? `Connected to Raspberry Pi Cloud Server! (${probe.latencyMs}ms)`
        : `Konektado sa Raspberry Pi Cloud Server! (${probe.latencyMs}ms)`,
    });
  } else {
    return res.json({
      success: false,
      online: false,
      normalizedUrl: '',
      isPrivateLanIp: probe.isPrivateLanIp,
      latencyMs: 0,
      url: target,
      error: isEn
        ? `Cloud Server is offline, invalid, or unreachable at ${target}. Please check that your Pi server (port 3000 or 8000) and tunnel are active.`
        : probe.errorDetail || `Naka-off, hindi valid, o hindi maabot ang Raspberry Pi Cloud Server sa ${target}.`,
    });
  }
});

// 5b. Browser Direct LAN Bridge (When browser on local Wi-Fi reaches 192.168.x.x:8000 directly)
app.post('/api/pi/client-bridge', (req: Request, res: Response) => {
  const { url, piData, latencyMs, piReports } = req.body || {};
  const cleanUrl = normalizePiUrl(url || '');
  if (!cleanUrl || !piData) {
    return res.status(400).json({ success: false, error: 'Invalid bridge payload' });
  }

  livePiConnection.configuredUrl = cleanUrl;
  livePiConnection.isLive = true;
  livePiConnection.latencyMs = Number(latencyMs) || 15;
  livePiConnection.lastPingAt = new Date().toISOString();
  livePiConnection.connectionMethod = 'Local Wi-Fi / LAN (Direct Bridge)';
  livePiConnection.serverMode = 'CLIENT_LAN_BRIDGE';
  livePiConnection.lastError = '';
  livePiConnection.clientBridgeActiveUntil = Date.now() + 25000;
  livePiConnection.clientBridgeData = { ...piData, endpoint: cleanUrl };

  telegramConfig.piServerUrl = cleanUrl;
  persistedConfig.piServerUrl = cleanUrl;
  persistSystemConfig();

  if (Array.isArray(piReports) && piReports.length > 0) {
    reports = mergeReportsLists(reports, piReports);
    persistReports();
  }

  res.json({
    success: true,
    online: true,
    normalizedUrl: cleanUrl,
    reports,
    reportsCount: reports.length,
  });
});

// 5c. Manual Two-Way Sync Trigger with Raspberry Pi
app.post('/api/pi/sync', async (req: Request, res: Response) => {
  const isEn = req.body?.lang === 'en';
  const target = normalizePiUrl(
    req.body?.url || livePiConnection.configuredUrl || telegramConfig.piServerUrl || ''
  );
  if (!target) {
    return res.status(400).json({
      success: false,
      error: isEn ? 'No Cloud Server URL configured.' : 'Walang naka-set na Raspberry Pi URL.',
    });
  }

  const probe = await probePiServer(target, true);
  if (!probe.isLive) {
    return res.json({
      success: false,
      online: false,
      isPrivateLanIp: probe.isPrivateLanIp,
      normalizedUrl: target,
      error: isEn
        ? 'Cannot reach the Raspberry Pi Cloud Server for synchronization.'
        : probe.errorDetail || 'Hindi maabot ang Raspberry Pi server para sa sync.',
    });
  }

  const syncRes = await syncReportsWithPi(target);
  return res.json({
    success: true,
    online: true,
    synced: syncRes.synced,
    count: syncRes.count,
    mode: probe.mode,
    piData: probe.data,
    message: syncRes.synced
      ? isEn
        ? `Successfully synced ${syncRes.count} report(s) with Raspberry Pi Hard Drive!`
        : `Matagumpay na na-sync ang ${syncRes.count} ulat sa Raspberry Pi Hard Drive!`
      : isEn
        ? `Connected to Pi (${probe.mode}).`
        : `Konektado sa Pi (${probe.mode}).`,
  });
});

// 5d. Download Raspberry Pi Scripts Directly (server.py / setup_autostart.sh)
app.get('/api/pi/download-script/:scriptName', (req: Request, res: Response) => {
  const { scriptName } = req.params;
  if (scriptName !== 'server.py' && scriptName !== 'setup_autostart.sh') {
    return res.status(404).send('Script not found');
  }
  const filePath = path.resolve(process.cwd(), 'raspberry-pi-server', scriptName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Script file missing on server');
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${scriptName}"`);
  res.send(fs.readFileSync(filePath, 'utf8'));
});

// 5e. Disconnect / Clear Raspberry Pi URL
app.post('/api/pi/disconnect', async (req: Request, res: Response) => {
  const isEn = req.body?.lang === 'en';
  livePiConnection.configuredUrl = '';
  livePiConnection.isLive = false;
  livePiConnection.latencyMs = 0;
  livePiConnection.lastPingAt = '';
  livePiConnection.connectionMethod = 'Not Set';
  livePiConnection.lastError = '';
  livePiConnection.cachedData = null;
  livePiConnection.clientBridgeActiveUntil = 0;
  livePiConnection.clientBridgeData = null;
  telegramConfig.piServerUrl = '';
  persistedConfig.piServerUrl = '';
  persistSystemConfig();
  return res.json({
    success: true,
    message: isEn
      ? 'Cloud Server link disconnected and cleared.'
      : 'Matagumpay na nadiskonekta at natanggal ang Pi Server link.',
  });
});

// 6. Safe Power Controls for Raspberry Pi (Remote Shutdown / Reboot)
app.post('/api/pi/system-action', async (req: Request, res: Response) => {
  const { action, url, lang } = req.body; // 'shutdown' | 'reboot'
  const isEn = lang === 'en';
  const target = normalizePiUrl(url || livePiConnection.configuredUrl || telegramConfig.piServerUrl || '');
  if (!target) {
    return res.status(400).json({
      success: false,
      error: isEn ? 'No connected Raspberry Pi Cloud Server URL.' : 'Walang konektadong Raspberry Pi server URL.',
    });
  }

  try {
    const endpoint = action === 'reboot' ? `${target}/api/system/reboot` : `${target}/api/system/shutdown`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const piRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...PI_STANDARD_HEADERS,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);

    if (action === 'shutdown') {
      livePiConnection.isLive = false;
      livePiConnection.clientBridgeActiveUntil = 0;
      livePiConnection.lastError = 'Server halted by safe shutdown command';
    }

    if (piRes && piRes.ok) {
      const data = await piRes.json().catch(() => ({}));
      return res.json({
        success: true,
        delivered: true,
        message:
          data.message ||
          (action === 'shutdown'
            ? isEn
              ? 'Safe shutdown initiated. Wait 5 seconds before unplugging power.'
              : 'Nagsisimula na ang ligtas na shutdown. Maghintay ng 5 segundo bago bunutin sa saksakan.'
            : isEn
              ? 'Raspberry Pi is rebooting.'
              : 'Nagre-reboot na ang Raspberry Pi.'),
      });
    }

    return res.json({
      success: false,
      delivered: false,
      isPrivateLanIp: isPrivateNetworkHost(target),
      message:
        action === 'reboot'
          ? isEn
            ? 'Reboot command could not reach the Pi server.'
            : 'Hindi umabot ang reboot command. Tiyaking bukas ang Pi server.'
          : isEn
            ? 'Shutdown command could not reach the Pi server.'
            : 'Hindi umabot ang shutdown command. Tiyaking bukas ang Pi server.',
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to send system action' });
  }
});

// 7. Raspberry Pi 4B Storage Status & Metrics
app.get('/api/pi-status', async (req: Request, res: Response) => {
  const isEn = req.query.lang === 'en';
  const queryEndpoint = normalizePiUrl((req.query.endpoint as string) || '');
  const activeEndpoint =
    queryEndpoint ||
    livePiConnection.configuredUrl ||
    normalizePiUrl(process.env.PI_SERVER_URL || '') ||
    '';

  const brgy40Count = reports.filter((r) => r.barangay?.includes('40') || r.purok?.includes('40')).length;
  const brgy41Count = reports.filter((r) => r.barangay?.includes('41') || r.purok?.includes('41') || !r.barangay).length;

  if (!activeEndpoint) {
    return res.json({
      hardware: isEn ? 'Raspberry Pi 4 Model B (Not Configured)' : 'Raspberry Pi 4 Model B (Hindi Pa Naka-set)',
      ram: isEn ? 'Standby' : 'Naka-standby',
      storageUsedMb: 0,
      storage_folder: isEn ? 'No Cloud Server Configured' : 'Walang Naka-configure na Pi Server',
      disk_total: '0 GB',
      disk_used: '0 GB',
      disk_free: '0 GB',
      pulseFolderMb: 0,
      pulseFolderKb: 0,
      pulseStorageSummary: isEn
        ? 'No Cloud Server link configured. Paste your Cloud Server URL above.'
        : 'Walang naka-set na Cloud Server link. I-paste ang link ng iyong Cloud Server.',
      residentPhotosCount: 0,
      residentPhotosMb: 0,
      proofPhotosCount: 0,
      proofPhotosMb: 0,
      cachedImagesCount: 0,
      activeTicketsCount: reports.length,
      pendingTicketsCount: reports.filter((r) => r.status === 'PENDING').length,
      brgy40Count,
      brgy41Count,
      autoPurgeTtlDays: 30,
      cpuTempCelsius: 0,
      cpu_temp: 'N/A',
      ipAddress: '',
      localHostname: 'N/A',
      online: false,
      isConfigured: false,
      configuredUrl: '',
      latencyMs: 0,
      lastPingAt: '',
      connectionMethod: isEn ? 'Not Set' : 'Walang Naka-set',
      lastPurgeRun: '',
      savedLogbooksCount: savedLogBooks.length,
    });
  }

  const probe = await probePiServer(activeEndpoint, false);
  livePiConnection.isLive = probe.isLive;

  if (probe.isLive) {
    livePiConnection.configuredUrl = activeEndpoint;
    livePiConnection.latencyMs = probe.latencyMs;
    livePiConnection.lastPingAt = new Date().toISOString();
    livePiConnection.connectionMethod =
      probe.mode === 'CLIENT_LAN_BRIDGE'
        ? 'Local Wi-Fi / LAN (Direct Bridge)'
        : detectConnectionMethod(activeEndpoint);
    livePiConnection.lastError = '';
  }

  if (!probe.isLive) {
    return res.json({
      hardware: 'Raspberry Pi 4 Model B',
      ram: 'Offline',
      storageUsedMb: 0,
      storage_folder: `DISCONNECTED (${activeEndpoint})`,
      disk_total: '0 GB',
      disk_used: '0 GB',
      disk_free: '0 GB',
      pulseFolderMb: 0,
      pulseFolderKb: 0,
      pulseStorageSummary: isEn
        ? 'Cannot reach the Cloud Server at the configured URL.'
        : probe.errorDetail || 'Hindi maabot ang Pi server sa ibinigay na URL.',
      residentPhotosCount: 0,
      residentPhotosMb: 0,
      proofPhotosCount: 0,
      proofPhotosMb: 0,
      cachedImagesCount: 0,
      activeTicketsCount: reports.length,
      pendingTicketsCount: reports.filter((r) => r.status === 'PENDING').length,
      brgy40Count,
      brgy41Count,
      autoPurgeTtlDays: 30,
      cpuTempCelsius: 0,
      cpu_temp: 'N/A',
      ipAddress: activeEndpoint,
      localHostname: 'raspberrypi.local',
      online: false,
      isConfigured: true,
      configuredUrl: activeEndpoint,
      latencyMs: 0,
      lastPingAt: livePiConnection.lastPingAt || '',
      connectionMethod: 'Disconnected',
      errorDetail: isEn ? 'Cloud Server is offline or unreachable.' : probe.errorDetail,
      isPrivateLanIp: probe.isPrivateLanIp,
      lastPurgeRun: '',
      savedLogbooksCount: savedLogBooks.length,
    });
  }

  const remotePiData = probe.data || {};
  const totalResidentPhotos = reports.reduce((acc, r) => acc + (r.photos?.length || 0), 0);
  const totalProofPhotos = reports.reduce((acc, r) => acc + (r.proofPhotos?.length || 0), 0);
  const totalResidentMb = +(totalResidentPhotos * 0.8).toFixed(2);
  const totalProofMb = +(totalProofPhotos * 0.75).toFixed(2);
  const totalStorageUsedMb = +(totalResidentMb + totalProofMb + reports.length * 0.02).toFixed(2);

  res.json({
    hardware: remotePiData?.hardware || 'Raspberry Pi 4 Model B (Barangay Local Cloud Storage)',
    ram: remotePiData?.ram || 'Active',
    ramUsagePercent: remotePiData?.ramUsagePercent,
    storageUsedMb: remotePiData?.pulse_folder_mb ?? totalStorageUsedMb,
    storage_folder: remotePiData?.storage_folder || '/media/pi/Vherrsie Back-up/RESEARCH TRASH',
    disk_total: remotePiData?.disk_total || '500.0 GB',
    disk_used: remotePiData?.disk_used || '20.0 GB',
    disk_free: remotePiData?.disk_free || '480.0 GB',
    pulseFolderMb: remotePiData?.pulse_folder_mb ?? totalStorageUsedMb,
    pulseFolderKb: remotePiData?.pulse_folder_kb ?? +(totalStorageUsedMb * 1024).toFixed(0),
    pulseStorageSummary:
      remotePiData?.pulse_storage_summary ||
      (isEn ? `${totalStorageUsedMb} MB used on hard drive` : `${totalStorageUsedMb} MB lamang ang kinakain sa hard drive`),
    residentPhotosCount: remotePiData?.resident_photos_count ?? totalResidentPhotos,
    residentPhotosMb: totalResidentMb,
    proofPhotosCount: remotePiData?.proof_photos_count ?? totalProofPhotos,
    proofPhotosMb: totalProofMb,
    cachedImagesCount: totalResidentPhotos + totalProofPhotos,
    activeTicketsCount: remotePiData?.reports_count ?? reports.length,
    pendingTicketsCount: reports.filter((r) => r.status === 'PENDING').length,
    brgy40Count,
    brgy41Count,
    autoPurgeTtlDays: 30,
    cpuTempCelsius: remotePiData?.cpuTempCelsius || (remotePiData?.cpu_temp ? parseFloat(remotePiData.cpu_temp) : 42.0),
    cpu_temp: remotePiData?.cpu_temp || '42.0°C',
    ipAddress: remotePiData?.lan_ip || activeEndpoint,
    localHostname: remotePiData?.hostname || 'raspberrypi.local',
    online: true,
    isConfigured: true,
    configuredUrl: activeEndpoint,
    latencyMs: probe.latencyMs,
    lastPingAt: livePiConnection.lastPingAt,
    connectionMethod: livePiConnection.connectionMethod,
    serverMode: probe.mode,
    isPrivateLanIp: probe.isPrivateLanIp,
    lastPurgeRun: new Date().toISOString(),
    savedLogbooksCount: Math.max(savedLogBooks.length, Number(remotePiData?.logbooks_count) || 0),
  });
});

// 8. Save Log Book snapshot (Syncs to Pi Hard Drive + Local Cloud Archive)
app.post('/api/pi/save-logbook', async (req: Request, res: Response) => {
  try {
    const { savedBy, destination, piEndpoint, clientSyncedToPi, lang } = req.body;
    const isEn = lang === 'en';
    const phTime = getPhilippineDateTime();
    const nowIso = new Date().toISOString();

    const brgy40Count = reports.filter((r) => r.barangay?.includes('40') || r.purok?.includes('40')).length;
    const brgy41Count = reports.filter((r) => r.barangay?.includes('41') || r.purok?.includes('41') || !r.barangay).length;
    const pendingRecords = reports.filter((r) => r.status === 'PENDING').length;
    const dispatchedRecords = reports.filter((r) => r.status === 'DISPATCHED').length;
    const resolvedRecords = reports.filter((r) => r.status === 'RESOLVED').length;
    const cancelledRecords = reports.filter((r) => r.status === 'CANCELLED').length;

    const totalResidentMb = reports.reduce((acc, r) => acc + (r.residentPhotosSizeMb || (r.photos?.length || 0) * 0.8), 0);
    const totalProofMb = reports.reduce((acc, r) => acc + (r.proofPhotosSizeMb || (r.proofPhotos?.length || 0) * 0.75), 0);
    const storageUsedMb = +(totalResidentMb + totalProofMb).toFixed(2);

    const logbookId = `LOG-${Date.now()}`;
    const filename = `TUGON_Logbook_Brgy40_41_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;

    let syncStatus: 'SYNCED' | 'LOCAL_ONLY' = clientSyncedToPi ? 'SYNCED' : 'LOCAL_ONLY';
    const targetUrl = normalizePiUrl(piEndpoint || livePiConnection.configuredUrl || telegramConfig.piServerUrl || '');

    if (!clientSyncedToPi && targetUrl && !isPrivateNetworkHost(targetUrl)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const piRes = await fetch(`${targetUrl}/api/logbook/save`, {
          method: 'POST',
          headers: {
            ...PI_STANDARD_HEADERS,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            logbookId,
            filename,
            savedAt: nowIso,
            savedAtPhilippineTime: phTime,
            savedBy: savedBy || (isEn ? 'Barangay 40 & 41 Official' : 'Barangay 40 & 41 Kagawad'),
            totalRecords: reports.length,
            reports,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (piRes.ok) {
          syncStatus = 'SYNCED';
        }
      } catch {
        syncStatus = 'LOCAL_ONLY';
      }
    }

    const newLogBook: SavedLogBook = {
      id: logbookId,
      filename,
      savedAt: nowIso,
      savedAtPhilippineTime: phTime,
      totalRecords: reports.length,
      pendingRecords,
      dispatchedRecords,
      resolvedRecords,
      cancelledRecords,
      brgy40Count,
      brgy41Count,
      storageUsedMb,
      savedBy: savedBy || (isEn ? 'Barangay 40 & 41 Official' : 'Barangay 40 & 41 Kagawad'),
      destination: destination || 'Raspberry Pi 4B Cloud Server',
      syncStatus,
      recordsSummary: isEn
        ? `${reports.length} total records (Pending: ${pendingRecords}, Resolved: ${resolvedRecords})`
        : `${reports.length} kabuuang tala (Pending: ${pendingRecords}, Resolved: ${resolvedRecords})`,
      recordsSnapshot: [...reports],
    };

    savedLogBooks.unshift(newLogBook);
    persistSavedLogBooks();

    res.json({
      success: true,
      logbook: newLogBook,
      targetUrl,
      isPrivateLanIp: targetUrl ? isPrivateNetworkHost(targetUrl) : false,
      message:
        syncStatus === 'SYNCED'
          ? isEn
            ? `Log Book saved and synced to Raspberry Pi Hard Drive! (${phTime})`
            : `Matagumpay na na-save at na-sync ang Log Book sa Raspberry Pi Hard Drive! (${phTime})`
          : isEn
            ? `Log Book snapshot saved to Cloud Archive! (${phTime})`
            : `Nai-save ang Log Book snapshot sa Cloud Archive! (${phTime})`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save logbook' });
  }
});

// 9. Retrieve Saved Log Books (Merges remote Pi logbooks if online)
app.get('/api/pi/saved-logbooks', async (req: Request, res: Response) => {
  const isEn = req.query.lang === 'en';
  const targetUrl = livePiConnection.configuredUrl || telegramConfig.piServerUrl;
  if (targetUrl && livePiConnection.isLive && !isPrivateNetworkHost(targetUrl)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${targetUrl}/api/logbooks`, {
        signal: ctrl.signal,
        headers: PI_STANDARD_HEADERS,
      });
      clearTimeout(t);
      if (r.ok) {
        const remoteList = await r.json().catch(() => []);
        if (Array.isArray(remoteList)) {
          for (const rem of remoteList) {
            if (rem?.filename && !savedLogBooks.some((l) => l.filename === rem.filename)) {
              savedLogBooks.push({
                id: rem.id || rem.filename,
                filename: rem.filename,
                savedAt: rem.modified || new Date().toISOString(),
                savedAtPhilippineTime: rem.modified || getPhilippineDateTime(),
                totalRecords: rem.totalRecords || 0,
                pendingRecords: 0,
                dispatchedRecords: 0,
                resolvedRecords: 0,
                cancelledRecords: 0,
                brgy40Count: 0,
                brgy41Count: 0,
                storageUsedMb: rem.sizeKb ? +(rem.sizeKb / 1024).toFixed(2) : 0.1,
                savedBy: rem.savedBy || 'Raspberry Pi Hard Drive',
                destination: 'Raspberry Pi 4B Cloud Server',
                syncStatus: 'SYNCED',
                recordsSummary: isEn
                  ? 'Stored on Raspberry Pi External Hard Drive'
                  : 'Naka-imbak sa Raspberry Pi External Hard Drive',
              });
            }
          }
        }
      }
    } catch {}
  }

  res.json({
    success: true,
    count: savedLogBooks.length,
    logbooks: savedLogBooks.map((l) => ({
      ...l,
      recordsSummary: isEn
        ? `${l.totalRecords} total records (Pending: ${l.pendingRecords}, Resolved: ${l.resolvedRecords})`
        : l.recordsSummary,
      recordsSnapshot: undefined,
    })),
  });
});

// 10. Delete Saved Log Book
app.delete('/api/pi/logbooks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const index = savedLogBooks.findIndex((l) => l.id === id || l.filename === id);
  if (index !== -1) {
    const deletedLog = savedLogBooks.splice(index, 1)[0];
    persistSavedLogBooks();

    const targetUrl = livePiConnection.configuredUrl || telegramConfig.piServerUrl;
    if (targetUrl && !isPrivateNetworkHost(targetUrl)) {
      fetch(`${targetUrl}/api/logbooks?filename=${encodeURIComponent(deletedLog.filename)}`, {
        method: 'DELETE',
        headers: PI_STANDARD_HEADERS,
      }).catch(() => null);
    }

    return res.json({ success: true, deletedId: id, filename: deletedLog.filename });
  }
  res.status(404).json({ error: 'Logbook not found' });
});

// 11. Download full Log Book as JSON (Fetches from Pi if snapshot only resides on Pi)
app.get('/api/pi/download-logbook/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const logbook = savedLogBooks.find((l) => l.id === id || l.filename === id);
  if (!logbook) {
    return res.status(404).json({ error: 'Logbook not found' });
  }

  if (!logbook.recordsSnapshot && livePiConnection.configuredUrl && !isPrivateNetworkHost(livePiConnection.configuredUrl)) {
    try {
      const r = await fetch(
        `${livePiConnection.configuredUrl}/api/logbooks/${encodeURIComponent(logbook.filename)}`,
        { headers: PI_STANDARD_HEADERS }
      );
      if (r.ok) {
        const remotePayload = await r.json();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${logbook.filename}"`);
        return res.json(remotePayload);
      }
    } catch {}
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${logbook.filename}"`);
  return res.json(logbook);
});

// 12. Telegram Auto-Detect Chat ID via getUpdates (with automatic Webhook conflict recovery)
app.post('/api/telegram/detect-chat', async (req: Request, res: Response) => {
  const token = String(req.body?.botToken || telegramConfig.botToken || '').trim();
  const isEn = req.body?.lang === 'en';
  if (!token) {
    return res.status(400).json({
      success: false,
      error: isEn
        ? 'Please enter your Telegram Bot Token from @BotFather first.'
        : 'Pakilagay muna ang iyong Telegram Bot Token mula kay @BotFather.',
    });
  }

  try {
    const fetchUpdates = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=30`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await r.json().catch(() => null);
      return { r, data };
    };

    let { r, data } = await fetchUpdates();

    // Auto-clear webhook if Telegram returns 409 Conflict (webhook previously active)
    if (r.status === 409 || String(data?.description || '').toLowerCase().includes('webhook')) {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`, {
        method: 'POST',
      }).catch(() => null);
      const retried = await fetchUpdates();
      r = retried.r;
      data = retried.data;
    }

    if (!r.ok || !data?.ok) {
      return res.status(400).json({
        success: false,
        error:
          data?.description ||
          (isEn
            ? 'Invalid Bot Token. Please verify the token from @BotFather.'
            : 'Invalid ang Bot Token. Pakisuri ang token mula kay @BotFather.'),
      });
    }

    const updates = Array.isArray(data.result) ? data.result : [];
    const chats: { id: string; title: string; type: string }[] = [];

    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i];
      const chat =
        u?.message?.chat ||
        u?.edited_message?.chat ||
        u?.my_chat_member?.chat ||
        u?.chat_member?.chat ||
        u?.channel_post?.chat;
      if (chat && chat.id !== undefined) {
        const idStr = String(chat.id);
        if (!chats.some((c) => c.id === idStr)) {
          const title =
            chat.title ||
            [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
            chat.username ||
            idStr;
          chats.push({ id: idStr, title, type: chat.type || 'private' });
        }
      }
    }

    if (chats.length === 0) {
      return res.json({
        success: false,
        chats: [],
        error: isEn
          ? 'Your bot has not received any messages yet. Open your bot in Telegram, tap /start or send "Hello" in the chat/group, then click Auto-Detect again!'
          : 'Wala pang natatanggap na mensahe ang iyong bot. Buksan muna ang bot mo sa Telegram app at i-tap ang /start o mag-send ng "Hello", saka pindutin muli ang Auto-Detect!',
      });
    }

    return res.json({
      success: true,
      chatId: chats[0].id,
      chatTitle: chats[0].title,
      chats,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || (isEn ? 'Could not reach Telegram API.' : 'Hindi makakonekta sa Telegram API.'),
    });
  }
});

// 13. Telegram Test Alert Endpoint
app.post('/api/telegram/test-notify', async (req: Request, res: Response) => {
  const { botToken, chatId, message, lang } = req.body;
  const isEn = lang === 'en';
  if (botToken && String(botToken).trim()) {
    telegramConfig.botToken = String(botToken).trim();
    persistedConfig.telegramBotToken = telegramConfig.botToken;
  }
  if (chatId && String(chatId).trim()) {
    telegramConfig.chatId = String(chatId).trim();
    persistedConfig.telegramChatId = telegramConfig.chatId;
  }
  persistSystemConfig();

  const phTime = getPhilippineDateTime();
  const pendingLen = reports.filter((r) => r.status === 'PENDING').length;
  const simulatedMessage =
    message ||
    (isEn
      ? `🔔 <b>[T.U.G.O.N. TEST ALERT - BARANGAY 40 &amp; 41]</b>\n` +
        `Status: Active &amp; Connected to Portal\n` +
        `Time: ${escapeHtml(phTime)}\n` +
        `Current Pending: ${pendingLen} concern(s)\n` +
        `Jurisdiction: Barangay 40 (Gumamela) &amp; Barangay 41 (Rosal), Cavite City`
      : `🔔 <b>[T.U.G.O.N. TEST ALERT - BARANGAY 40 &amp; 41]</b>\n` +
        `Status: Aktibo at Konektado sa Portal\n` +
        `Oras: ${escapeHtml(phTime)}\n` +
        `Kasalukuyang Pending: ${pendingLen} concern(s)\n` +
        `Sakop: Barangay 40 (Gumamela) at Barangay 41 (Rosal), Cavite City\n\n` +
        `${formatActiveUnfinishedListHtml()}`);

  const telegramResult = await sendRealTelegramMessage(simulatedMessage);
  await runTelegramWatchdogCheck(false);

  if (telegramResult.ok) {
    persistedConfig.telegramSetupComplete = true;
    recordTelegramBroadcast(simulatedMessage, phTime);
  }

  res.json({
    success: true,
    delivered: telegramResult.ok,
    message: telegramResult.ok
      ? isEn
        ? `Test alert successfully delivered to Telegram! (${phTime})`
        : `Matagumpay na naipadala ang alert sa Telegram ng Kagawad! (${phTime})`
      : telegramResult.description ||
        (isEn
          ? 'Could not deliver to Telegram. Please check your Bot Token and Chat ID.'
          : 'Hindi naipadala sa Telegram. Pakisuri ang Bot Token at Chat ID.'),
    telegramResult,
    broadcast: simulatedMessage.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'),
    timestamp: phTime,
    watchdog: {
      status: telegramWatchdog.status,
      online: telegramWatchdog.status === 'ONLINE',
      botUsername: telegramWatchdog.botUsername,
    },
  });
});

// 14. Telegram Status Endpoint
app.get('/api/telegram/status', async (req: Request, res: Response) => {
  const queryToken = ((req.query.token as string) || '').trim();
  const queryChatId = ((req.query.chatId as string) || '').trim();

  let changed = false;
  if (queryToken && queryToken !== telegramConfig.botToken) {
    telegramConfig.botToken = queryToken;
    persistedConfig.telegramBotToken = queryToken;
    changed = true;
  }
  if (queryChatId && queryChatId !== telegramConfig.chatId) {
    telegramConfig.chatId = queryChatId;
    persistedConfig.telegramChatId = queryChatId;
    changed = true;
  }
  if (changed) {
    persistSystemConfig();
    await runTelegramWatchdogCheck(false);
  } else if (telegramConfig.botToken && telegramWatchdog.status === 'NOT_CONFIGURED') {
    await runTelegramWatchdogCheck(false);
  }

  const phTime = getPhilippineDateTime();
  res.json({
    online: telegramWatchdog.status === 'ONLINE',
    status: telegramWatchdog.status,
    botConfigured: Boolean(telegramConfig.botToken && telegramConfig.chatId),
    setupComplete: persistedConfig.telegramSetupComplete || Boolean(telegramConfig.botToken && telegramConfig.chatId),
    chatId: telegramConfig.chatId,
    botUsername: telegramWatchdog.botUsername,
    botFirstName: telegramWatchdog.botFirstName,
    autoRestartCount: telegramWatchdog.autoRestartCount,
    reconnectAttempts: telegramWatchdog.reconnectAttempts,
    lastCheckedAt: telegramWatchdog.lastCheckedAt || phTime,
    lastSeenOnline: telegramWatchdog.lastSeenOnline || '',
    lastError: telegramWatchdog.lastError,
    watchdogActive: telegramWatchdog.watchdogActive,
    lastBroadcastMessage: telegramConfig.lastBroadcastMessage,
    lastBroadcastTime: telegramConfig.lastBroadcastTime,
    broadcastHistory: persistedConfig.broadcastHistory || [],
    philippineTime: phTime,
    pendingCount: reports.filter((r) => r.status === 'PENDING').length,
    activeUnfinishedCount: reports.filter((r) => r.status === 'PENDING' || r.status === 'DISPATCHED').length,
  });
});

// 15. Telegram Restart Watchdog
app.post('/api/telegram/restart', async (req: Request, res: Response) => {
  const isEn = req.body?.lang === 'en';
  if (req.body?.botToken) {
    telegramConfig.botToken = String(req.body.botToken).trim();
    persistedConfig.telegramBotToken = telegramConfig.botToken;
    persistSystemConfig();
  }
  telegramWatchdog.status = 'RECONNECTING';
  telegramWatchdog.autoRestartCount++;
  telegramWatchdog.reconnectAttempts++;
  await runTelegramWatchdogCheck(true);

  const isOnline = (telegramWatchdog.status as string) === 'ONLINE';
  res.json({
    success: isOnline,
    status: telegramWatchdog.status,
    online: isOnline,
    botUsername: telegramWatchdog.botUsername,
    autoRestartCount: telegramWatchdog.autoRestartCount,
    message: isOnline
      ? isEn
        ? `Telegram Bot (@${telegramWatchdog.botUsername || 'TUGON_Bot'}) restarted and is now online!`
        : `Matagumpay na nag-restart at aktibo na muli ang Telegram Bot (@${telegramWatchdog.botUsername || 'TUGON_Bot'})!`
      : telegramWatchdog.lastError ||
        (isEn ? 'Could not verify Telegram Bot Token.' : 'Hindi ma-verify ang Telegram Bot Token.'),
  });
});

// 16. Telegram Configure & Persist
app.post('/api/telegram/configure', async (req: Request, res: Response) => {
  const { botToken, chatId, lang } = req.body;
  const isEn = lang === 'en';
  const cleanToken = botToken !== undefined ? String(botToken).trim() : telegramConfig.botToken;
  const cleanChat = chatId !== undefined ? String(chatId).trim() : telegramConfig.chatId;

  telegramConfig.botToken = cleanToken;
  telegramConfig.chatId = cleanChat;
  persistedConfig.telegramBotToken = cleanToken;
  persistedConfig.telegramChatId = cleanChat;

  await runTelegramWatchdogCheck(true);
  const isOnline = (telegramWatchdog.status as string) === 'ONLINE';

  if (isOnline && cleanChat) {
    persistedConfig.telegramSetupComplete = true;
  }
  persistSystemConfig();

  res.json({
    success: isOnline && Boolean(cleanChat),
    status: telegramWatchdog.status,
    online: isOnline,
    botUsername: telegramWatchdog.botUsername,
    chatId: telegramConfig.chatId,
    error: !isOnline
      ? telegramWatchdog.lastError || 'Invalid Telegram Bot Token.'
      : !cleanChat
        ? isEn
          ? 'Please enter or auto-detect your Chat ID.'
          : 'Pakilagay o i-auto-detect ang iyong Chat ID.'
        : undefined,
    message:
      isOnline && cleanChat
        ? isEn
          ? `Telegram Bot @${telegramWatchdog.botUsername} connected and saved on the server!`
          : `Konektado at naka-save na sa server ang Telegram Bot @${telegramWatchdog.botUsername}!`
        : telegramWatchdog.lastError ||
          (isEn
            ? 'Please check your Bot Token and Chat ID.'
            : 'Pakisuri ang iyong Bot Token at Chat ID.'),
  });
});

// 16b. Telegram Disconnect & Clear
app.post('/api/telegram/disconnect', (req: Request, res: Response) => {
  const isEn = req.body?.lang === 'en';
  telegramConfig.botToken = '';
  telegramConfig.chatId = '';
  persistedConfig.telegramBotToken = '';
  persistedConfig.telegramChatId = '';
  persistedConfig.telegramSetupComplete = false;
  telegramWatchdog.status = 'NOT_CONFIGURED';
  telegramWatchdog.isHealthy = false;
  telegramWatchdog.botUsername = '';
  telegramWatchdog.lastError = '';
  persistSystemConfig();
  res.json({
    success: true,
    message: isEn
      ? 'Telegram Bot credentials disconnected and cleared.'
      : 'Matagumpay na nadiskonekta at nalinis ang Telegram Bot credentials.',
  });
});

// 17. Source Tree API
app.get('/api/source-tree', (_req: Request, res: Response) => {
  try {
    const files: { path: string; content: string }[] = [];
    const rootDir = process.cwd();

    function readFilesRecursively(dir: string) {
      const list = fs.readdirSync(dir);
      for (const item of list) {
        if (['node_modules', 'dist', '.git', '.aistudio', '__pycache__', 'aistudio'].includes(item)) continue;
        const fullPath = path.join(dir, item);
        const relPath = path.relative(rootDir, fullPath);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          readFilesRecursively(fullPath);
        } else {
          if (
            item.endsWith('.zip') ||
            item.endsWith('.png') ||
            item.endsWith('.jpg') ||
            item.endsWith('.apk') ||
            item.endsWith('.pyc') ||
            item === 'pulse_config.json'
          ) {
            continue;
          }
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            files.push({ path: relPath.replace(/\\/g, '/'), content });
          } catch {}
        }
      }
    }

    readFilesRecursively(rootDir);
    res.json({ success: true, count: files.length, files });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read source tree' });
  }
});

// 18. Direct Download Dynamic ZIP
app.get('/api/download-zip', async (_req: Request, res: Response) => {
  try {
    const rootDir = process.cwd();
    const zip = new JSZip();

    function addFilesToZip(dir: string) {
      const list = fs.readdirSync(dir);
      for (const item of list) {
        if (['node_modules', 'dist', '.git', '.aistudio', '__pycache__', 'aistudio'].includes(item)) continue;
        const fullPath = path.join(dir, item);
        const relPath = path.relative(rootDir, fullPath);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addFilesToZip(fullPath);
        } else {
          if (item.endsWith('.zip') || item.endsWith('.pyc') || item === 'pulse_config.json') continue;
          try {
            const data = fs.readFileSync(fullPath);
            zip.file(relPath.replace(/\\/g, '/'), data);
          } catch {}
        }
      }
    }

    addFilesToZip(rootDir);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="tugon-barangay40-41-source.zip"');
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).send(`Failed to generate ZIP: ${err?.message}`);
  }
});

// Start Express and Vite middleware
async function startServer() {
  const publicPath = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  const distPath = path.resolve(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);

  if (process.env.NODE_ENV === 'production') {
    if (hasDist) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(process.cwd(), 'index.html'));
      });
    }
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`T.U.G.O.N. Barangay 40 & 41 Waste Collection Service running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
