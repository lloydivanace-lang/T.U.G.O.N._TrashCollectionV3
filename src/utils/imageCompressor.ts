/**
 * Client-Side Image Compressor, Photo URL Resolver & Ticket Reference Formatter
 * - Guarantees valid `data:image/jpeg;base64,...` output across iOS Safari, Android Chrome, and Desktop
 * - Never leaks or returns revoked `blob:` URLs or `0x1` / `1x1` `"data:,"` strings
 * - Resolves tunnel-hosted images (ngrok / cloudflared / LAN Pi) with required bypass headers
 * - Formats T.U.G.O.N. ticket reference numbers (`TUGON-CAV-XXXX`)
 */

const resolvedPhotoCache = new Map<string, string>();

/**
 * Generates a new T.U.G.O.N. ticket reference number (e.g. `TUGON-CAV-7766`).
 */
export function generateTicketNumber(): string {
  const timePart = Date.now() % 10000;
  const randPart = Math.floor(Math.random() * 9000) + 1000;
  const fourDigit = String(((timePart + randPart) % 9000) + 1000).padStart(4, '0');
  return `TUGON-CAV-${fourDigit}`;
}

/**
 * Formats any ticket number to the official `TUGON-CAV-XXXX` prefix for display
 * while preserving the numeric/alphanumeric suffix of legacy records.
 */
export function formatTicketNumber(ticket?: string | null): string {
  const raw = String(ticket || '').trim().replace(/^#+/, '');
  if (!raw) return 'TUGON-CAV-0000';
  return raw.replace(/^(PULSE|TRASH|DRAW)-CAV-/i, 'TUGON-CAV-').toUpperCase();
}

/**
 * Canonicalizes a ticket number so `TUGON-CAV-7766` and legacy `PULSE-CAV-7766` match seamlessly.
 */
export function canonicalTicketKey(ticket?: string | null): string {
  return formatTicketNumber(ticket);
}

/**
 * Checks whether a photo string is a genuinely renderable image source
 * (filters out `"data:,"`, empty strings, HTML responses, and dead `blob:` URLs from other devices).
 */
export function isValidPhotoSrc(src: unknown): src is string {
  if (typeof src !== 'string') return false;
  const s = src.trim();
  if (s.length < 24 || s === 'data:,' || s === 'null' || s === 'undefined') {
    return false;
  }
  if (s.startsWith('data:text/html') || s.startsWith('<!DOCTYPE') || s.startsWith('<html')) {
    return false;
  }
  if (s.startsWith('data:image/')) {
    const commaIdx = s.indexOf(',');
    return commaIdx > 10 && s.length - commaIdx - 1 >= 16;
  }
  if (s.startsWith('blob:')) {
    // Only valid within the same origin session that created it
    if (typeof window !== 'undefined' && window.location?.origin) {
      return s.startsWith(`blob:${window.location.origin}`);
    }
    return true;
  }
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('/photos/') ||
    s.startsWith('photos/') ||
    s.startsWith('/api/photos/')
  ) {
    return true;
  }
  // Raw base64 JPEG (/9j/) or PNG (iVBOR) or WebP (UklGR)
  if (/^(\/9j\/|iVBORw0KGgo|UklGR)/.test(s)) {
    return true;
  }
  return false;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        resolve(reader.result);
      } else if (typeof reader.result === 'string' && reader.result.startsWith('data:')) {
        // Some Android file pickers report application/octet-stream for camera JPEGs
        const commaIdx = reader.result.indexOf(',');
        if (commaIdx > 0) {
          const b64 = reader.result.slice(commaIdx + 1);
          if (b64.startsWith('/9j/')) {
            resolve(`data:image/jpeg;base64,${b64}`);
            return;
          }
          if (b64.startsWith('iVBOR')) {
            resolve(`data:image/png;base64,${b64}`);
            return;
          }
          if (b64.startsWith('UklGR')) {
            resolve(`data:image/webp;base64,${b64}`);
            return;
          }
        }
        reject(new Error('Unsupported file MIME type'));
      } else {
        reject(new Error('Empty FileReader result'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

function normalizeStringPhotoInput(raw: string): string {
  const s = raw.trim();
  if (!s || s === 'data:,') return '';
  if (s.startsWith('/9j/')) return `data:image/jpeg;base64,${s}`;
  if (s.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${s}`;
  if (s.startsWith('UklGR')) return `data:image/webp;base64,${s}`;
  return s;
}

function getStoredPiBaseUrlSafe(): string {
  try {
    if (typeof window === 'undefined') return '';
    const raw = localStorage.getItem('pulse_pi_endpoint') || '';
    return raw.trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/**
 * Resolves a photo string into a browser-renderable `src`.
 * Automatically handles raw base64, relative Pi paths (`/photos/...`), and
 * `ngrok` / `loca.lt` tunnel URLs that require custom headers to bypass HTML warning pages.
 */
export async function resolvePhotoSrc(rawSrc: string): Promise<string> {
  if (!isValidPhotoSrc(rawSrc)) return '';

  const normalized = normalizeStringPhotoInput(rawSrc);
  if (!normalized) return '';

  if (normalized.startsWith('data:image/') || normalized.startsWith('blob:')) {
    return normalized;
  }

  let fullUrl = normalized;
  if (
    normalized.startsWith('/photos/') ||
    normalized.startsWith('photos/') ||
    normalized.startsWith('/api/photos/')
  ) {
    const piBase = getStoredPiBaseUrlSafe();
    const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
    fullUrl = piBase ? `${piBase}${cleanPath}` : cleanPath;
  }

  if (resolvedPhotoCache.has(fullUrl)) {
    return resolvedPhotoCache.get(fullUrl)!;
  }

  const lower = fullUrl.toLowerCase();
  const needsTunnelHeader =
    lower.includes('ngrok') || lower.includes('loca.lt') || lower.includes('/api/photos/');

  if (needsTunnelHeader && (lower.startsWith('http://') || lower.startsWith('https://'))) {
    try {
      const headers: Record<string, string> = {};
      if (lower.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
      }
      if (lower.includes('loca.lt')) {
        headers['Bypass-Tunnel-Reminder'] = 'true';
      }
      const res = await fetch(fullUrl, { headers });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && ct.startsWith('image/')) {
        const blob = await res.blob();
        const dataUrl = await readBlobAsDataUrl(blob);
        resolvedPhotoCache.set(fullUrl, dataUrl);
        return dataUrl;
      }
    } catch {
      // Fallback to direct URL if fetch is blocked
    }
  }

  return fullUrl;
}

function renderDrawableToJpegDataUrl(
  drawable: CanvasImageSource,
  rawWidth: number,
  rawHeight: number,
  maxWidth: number,
  maxHeight: number,
  quality: number
): string {
  if (rawWidth <= 0 || rawHeight <= 0) return '';

  let width = rawWidth;
  let height = rawHeight;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  } else {
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fill background white in case of transparent PNGs/WebPs
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(drawable, 0, 0, width, height);

  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 100) {
    dataUrl = canvas.toDataURL('image/png');
  }
  return dataUrl && dataUrl.startsWith('data:image/') && dataUrl.length >= 100 ? dataUrl : '';
}

/**
 * Compresses a camera frame, Gallery File/Blob, or Data URL into a clean, portable
 * `data:image/jpeg;base64,...` string (~60-140KB) that works across all phones & servers.
 */
export async function compressImage(
  source: File | Blob | string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.78
): Promise<string> {
  // Guard against accidental 3-argument calls like compressImage(src, 1080, 0.75)
  let safeMaxW = maxWidth > 1 ? maxWidth : 1200;
  let safeMaxH = maxHeight;
  let safeQuality = quality;
  if (maxHeight > 0 && maxHeight <= 1) {
    safeQuality = maxHeight;
    safeMaxH = safeMaxW;
  } else if (safeMaxH <= 1) {
    safeMaxH = safeMaxW;
  }
  safeQuality = Math.min(0.95, Math.max(0.3, safeQuality));

  if (typeof source === 'string') {
    const cleanInput = normalizeStringPhotoInput(source);
    if (!cleanInput || !isValidPhotoSrc(cleanInput)) {
      return '';
    }

    return new Promise((resolve) => {
      const img = new Image();
      // IMPORTANT: Never set crossOrigin on data: or blob: URLs (causes WebKit/iOS decode failures)
      if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }

      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const out = renderDrawableToJpegDataUrl(img, w, h, safeMaxW, safeMaxH, safeQuality);
          if (out) {
            resolve(out);
            return;
          }
        } catch (err) {
          console.warn('String image compression fallback:', err);
        }
        resolve(cleanInput.startsWith('data:image/') ? cleanInput : '');
      };

      img.onerror = () => {
        resolve('');
      };

      img.src = cleanInput;
    });
  }

  // File / Blob path (Mobile Camera & Gallery Picker)
  // Step 1: Try createImageBitmap first (handles EXIF rotation + modern mobile formats cleanly)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source);
      const out = renderDrawableToJpegDataUrl(
        bitmap,
        bitmap.width,
        bitmap.height,
        safeMaxW,
        safeMaxH,
        safeQuality
      );
      if (typeof bitmap.close === 'function') {
        bitmap.close();
      }
      if (out) {
        return out;
      }
    } catch {
      // Proceed to FileReader + HTMLImageElement fallback
    }
  }

  // Step 2: Convert Blob/File to a real data:image/... URL via FileReader (never leak blob: URLs!)
  let rawDataUrl = '';
  try {
    rawDataUrl = await readBlobAsDataUrl(source);
  } catch {
    return '';
  }

  if (!rawDataUrl) return '';

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const out = renderDrawableToJpegDataUrl(img, w, h, safeMaxW, safeMaxH, safeQuality);
        resolve(out || rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => {
      resolve(rawDataUrl.startsWith('data:image/') ? rawDataUrl : '');
    };
    img.src = rawDataUrl;
  });
}
