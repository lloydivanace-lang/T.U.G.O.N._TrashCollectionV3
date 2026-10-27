import { WasteReport } from '../types';
import { getStoredPiEndpoint, isLocalLanUrl, pushSingleReportDirectToPi } from './piBridge';
import { canonicalTicketKey, formatTicketNumber, isValidPhotoSrc } from './imageCompressor';

const DEVICE_ID_KEY = 'tugon_device_id_v1';
const LEGACY_LOCALSTORAGE_KEY = 'pulse_resident_my_reports';
const MIGRATED_FLAG_KEY = 'tugon_idb_migrated_v1';
const FALLBACK_STORAGE_KEY = 'tugon_device_reports_fallback_v1';

const DB_NAME = 'tugon_resident_device_db';
const DB_VERSION = 1;
const STORE_NAME = 'my_reports';

export function getOrCreateDeviceId(): string {
  try {
    let existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim().length >= 8) {
      return existing.trim();
    }
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    existing = `DEV-${randomPart}`;
    localStorage.setItem(DEVICE_ID_KEY, existing);
    return existing;
  } catch {
    return `DEV-SESSION-${Date.now().toString(36)}`;
  }
}

function openDeviceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

function readFallbackReports(): WasteReport[] {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackReports(reports: WasteReport[]): void {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // If localStorage hits quota with large base64 photos, store lightweight metadata copy
    try {
      const light = reports.map((r) => ({
        ...r,
        photos: r.photos.slice(0, 2),
      }));
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(light));
    } catch {}
  }
}

export async function saveDeviceReport(report: WasteReport): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  const normalized: WasteReport = {
    ...report,
    deviceId: report.deviceId || deviceId,
    localSyncStatus: report.localSyncStatus || 'SAVED_ON_DEVICE',
  };

  try {
    const db = await openDeviceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(normalized);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB write failed'));
      };
    });
  } catch {
    const current = readFallbackReports();
    const idx = current.findIndex((r) => r.id === normalized.id);
    if (idx >= 0) {
      current[idx] = normalized;
    } else {
      current.unshift(normalized);
    }
    writeFallbackReports(current);
  }
}

export async function saveDeviceReportsBulk(reports: WasteReport[]): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  try {
    const db = await openDeviceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const r of reports) {
        store.put({
          ...r,
          deviceId: r.deviceId || deviceId,
          localSyncStatus: r.localSyncStatus || 'SENT_TO_PI',
        });
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB bulk write failed'));
      };
    });
  } catch {
    writeFallbackReports(reports);
  }
}

export async function getAllDeviceReports(): Promise<WasteReport[]> {
  const deviceId = getOrCreateDeviceId();

  // One-time migration from legacy localStorage key if present on this phone
  try {
    if (!localStorage.getItem(MIGRATED_FLAG_KEY)) {
      const legacyRaw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const tagged: WasteReport[] = parsed.map((item: WasteReport) => ({
            ...item,
            deviceId: item.deviceId || deviceId,
            localSyncStatus: item.localSyncStatus || 'SENT_TO_PI',
          }));
          await saveDeviceReportsBulk(tagged);
        }
      }
      localStorage.setItem(MIGRATED_FLAG_KEY, '1');
    }
  } catch {}

  try {
    const db = await openDeviceDb();
    const records = await new Promise<WasteReport[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('IndexedDB read failed'));
      };
    });

    return records
      .filter((r) => !r.deviceId || r.deviceId === deviceId)
      .map((r) => ({ ...r, ticketNumber: formatTicketNumber(r.ticketNumber) }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return readFallbackReports()
      .filter((r) => !r.deviceId || r.deviceId === deviceId)
      .map((r) => ({ ...r, ticketNumber: formatTicketNumber(r.ticketNumber) }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function deleteDeviceReport(reportId: string): Promise<WasteReport[]> {
  try {
    const db = await openDeviceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(reportId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB delete failed'));
      };
    });
  } catch {}

  try {
    const fallback = readFallbackReports().filter((r) => r.id !== reportId);
    writeFallbackReports(fallback);
    const legacyRaw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          LEGACY_LOCALSTORAGE_KEY,
          JSON.stringify(parsed.filter((r: WasteReport) => r.id !== reportId))
        );
      }
    }
  } catch {}

  return getAllDeviceReports();
}

export async function clearAllDeviceReports(): Promise<void> {
  try {
    const db = await openDeviceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('IndexedDB clear failed'));
      };
    });
  } catch {}

  try {
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
    localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
    localStorage.setItem(MIGRATED_FLAG_KEY, '1');
  } catch {}
}


/**
 * Merges status / proof updates from the Barangay server into this phone's private records.
 * Never deletes any personal report from the resident's phone storage even if purged from the server queue.
 */
export async function mergeServerUpdatesIntoDeviceReports(
  serverReports: WasteReport[]
): Promise<WasteReport[]> {
  const localReports = await getAllDeviceReports();
  if (localReports.length === 0 || serverReports.length === 0) {
    return localReports;
  }

  const serverById = new Map<string, WasteReport>();
  const serverByTicket = new Map<string, WasteReport>();
  for (const sr of serverReports) {
    if (sr.id) serverById.set(sr.id, sr);
    if (sr.ticketNumber) {
      serverByTicket.set(sr.ticketNumber, sr);
      const canon = canonicalTicketKey(sr.ticketNumber);
      if (canon) serverByTicket.set(canon, sr);
    }
  }

  let hasChanges = false;
  const updated = localReports.map((local) => {
    const localCanon = local.ticketNumber ? canonicalTicketKey(local.ticketNumber) : '';
    const match =
      serverById.get(local.id) ||
      (local.ticketNumber ? serverByTicket.get(local.ticketNumber) : undefined) ||
      (localCanon ? serverByTicket.get(localCanon) : undefined);
    if (!match) return local;

    const validLocalPhotos = Array.isArray(local.photos) ? local.photos.filter(isValidPhotoSrc) : [];
    const validServerPhotos = Array.isArray(match.photos) ? match.photos.filter(isValidPhotoSrc) : [];
    const validServerProofs = Array.isArray(match.proofPhotos) ? match.proofPhotos.filter(isValidPhotoSrc) : [];
    const validLocalProofs = Array.isArray(local.proofPhotos) ? local.proofPhotos.filter(isValidPhotoSrc) : [];

    const merged: WasteReport = {
      ...local,
      ticketNumber: formatTicketNumber(match.ticketNumber || local.ticketNumber),
      status: match.status || local.status,
      dispatchedAt: match.dispatchedAt || local.dispatchedAt,
      resolvedAt: match.resolvedAt || local.resolvedAt,
      resolvedBy: match.resolvedBy || local.resolvedBy,
      resolutionNotes: match.resolutionNotes || local.resolutionNotes,
      proofPhotos:
        validServerProofs.length > 0
          ? validServerProofs
          : validLocalProofs.length > 0
          ? validLocalProofs
          : Array.isArray(match.proofPhotos) && match.proofPhotos.length > 0
          ? match.proofPhotos
          : local.proofPhotos,
      proofSubmittedAt: match.proofSubmittedAt || local.proofSubmittedAt,
      proofKagawadName: match.proofKagawadName || local.proofKagawadName,
      cancellationReason: match.cancellationReason || local.cancellationReason,
      cancelledAt: match.cancelledAt || local.cancelledAt,
      sourceStorage: match.sourceStorage || local.sourceStorage,
      localSyncStatus: 'SENT_TO_PI',
      // Always keep the resident's own high-res photos on their device if valid
      photos:
        validLocalPhotos.length > 0
          ? validLocalPhotos
          : validServerPhotos.length > 0
          ? validServerPhotos
          : Array.isArray(local.photos) && local.photos.length > 0
          ? local.photos
          : match.photos || [],
    };

    if (
      merged.ticketNumber !== local.ticketNumber ||
      merged.status !== local.status ||
      merged.proofPhotos.length !== (local.proofPhotos?.length || 0) ||
      merged.localSyncStatus !== local.localSyncStatus ||
      merged.cancellationReason !== local.cancellationReason ||
      merged.dispatchedAt !== local.dispatchedAt ||
      merged.resolvedAt !== local.resolvedAt
    ) {
      hasChanges = true;
    }

    return merged;
  });

  if (hasChanges) {
    await saveDeviceReportsBulk(updated);
  }

  return updated;
}

/**
 * If the Raspberry Pi is running on the same local Wi-Fi LAN (e.g. 192.168.x.x:8000),
 * pushes a single report non-destructively from the phone browser to the Pi Server.
 */
export async function tryPushReportToLanPi(report: WasteReport): Promise<boolean> {
  const endpoint = getStoredPiEndpoint();
  if (!endpoint || !isLocalLanUrl(endpoint)) return false;
  return pushSingleReportDirectToPi(endpoint, report);
}
