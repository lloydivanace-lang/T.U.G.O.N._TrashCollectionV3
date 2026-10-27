import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  BRGY_40_HALL_COORDS,
  BRGY_41_HALL_COORDS,
  evaluateJurisdiction,
  haversineDistanceMeters,
  resolveLocalCaviteStreet,
} from '../utils/jurisdiction';

export type UiScalePreset = 'compact' | 'normal' | 'large';

export interface ScreenCalibrationSettings {
  mode: 'auto' | 'custom';
  scalePercent: number;
  safePaddingX: number;
  safePaddingTop: number;
  safePaddingBottom: number;
  compactCards: boolean;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  dpr: number;
  orientation: 'portrait' | 'landscape';
  effectiveScalePercent: number;
}

const SCREEN_CALIBRATION_STORAGE_KEY = 'tugon_screen_calibration_v2';
const LEGACY_GPS_CALIBRATION_KEY = 'tugon_gps_calibration_v1';
const GPS_SESSION_CACHE_KEY = 'tugon_live_gps_cache_v3';
const GPS_MANUAL_OFF_KEY = 'tugon_gps_manual_off_v1';

interface CachedGpsFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  address: string;
  detectedStreet: string;
  detectedHouseNumber?: string;
  timestamp: number;
}

interface GpsSample {
  lat: number;
  lng: number;
  acc: number;
  ts: number;
  highAcc: boolean;
}

const DEFAULT_SCREEN_CALIBRATION: ScreenCalibrationSettings = {
  mode: 'auto',
  scalePercent: 100,
  safePaddingX: 0,
  safePaddingTop: 0,
  safePaddingBottom: 0,
  compactCards: false,
};

function clampNum(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, Math.round(val)));
}

function computeAdaptiveScaleForWidth(width: number, height: number): {
  scalePercent: number;
  compactCards: boolean;
} {
  const shortestSide = Math.min(width, height);
  if (width <= 335) {
    return { scalePercent: 82, compactCards: true };
  }
  if (width <= 360) {
    return { scalePercent: 88, compactCards: height < 680 };
  }
  if (width <= 384) {
    return { scalePercent: 94, compactCards: height < 650 };
  }
  if (shortestSide <= 360 && width > height) {
    return { scalePercent: 90, compactCards: true };
  }
  return { scalePercent: 100, compactCards: false };
}

function readLiveViewportDimensions(): {
  width: number;
  height: number;
  dpr: number;
  orientation: 'portrait' | 'landscape';
} {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844, dpr: 2, orientation: 'portrait' };
  }
  const vv = window.visualViewport;
  const rawW = vv && vv.width > 0 ? Math.min(window.innerWidth, vv.width) : window.innerWidth;
  const rawH = vv && vv.height > 0 ? vv.height : window.innerHeight;
  const width = Math.max(240, Math.round(rawW || 390));
  const height = Math.max(320, Math.round(rawH || 844));
  const dpr = Number((window.devicePixelRatio || 1).toFixed(2));
  const orientation = width > height ? 'landscape' : 'portrait';
  return { width, height, dpr, orientation };
}

function loadStoredScreenCalibration(): ScreenCalibrationSettings {
  try {
    localStorage.removeItem(LEGACY_GPS_CALIBRATION_KEY);

    const raw = localStorage.getItem(SCREEN_CALIBRATION_STORAGE_KEY);
    if (!raw) return DEFAULT_SCREEN_CALIBRATION;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.mode === 'auto' || parsed.mode === 'custom')) {
      return {
        mode: parsed.mode,
        scalePercent: clampNum(Number(parsed.scalePercent ?? 100), 75, 115),
        safePaddingX: clampNum(Number(parsed.safePaddingX ?? 0), 0, 24),
        safePaddingTop: clampNum(Number(parsed.safePaddingTop ?? 0), 0, 32),
        safePaddingBottom: clampNum(Number(parsed.safePaddingBottom ?? 0), 0, 48),
        compactCards: Boolean(parsed.compactCards),
      };
    }
  } catch {}
  return DEFAULT_SCREEN_CALIBRATION;
}

function readWarmGpsCache(): CachedGpsFix | null {
  try {
    if (sessionStorage.getItem(GPS_MANUAL_OFF_KEY) === '1') return null;
    const raw = sessionStorage.getItem(GPS_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedGpsFix = JSON.parse(raw);
    if (
      parsed &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng) &&
      Date.now() - parsed.timestamp < 180000
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

function saveWarmGpsCache(fix: CachedGpsFix): void {
  try {
    sessionStorage.setItem(GPS_SESSION_CACHE_KEY, JSON.stringify(fix));
  } catch {}
}

export interface LocationState {
  coords: { lat: number; lng: number } | null;
  rawGpsCoords: { lat: number; lng: number } | null;
  address: string;
  detectedStreet: string;
  detectedHouseNumber: string;
  accuracy: number | null;
  isRefining: boolean;
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  isEnabled: boolean;
  isWithinJurisdiction: boolean;
  isWithinBrgy40: boolean;
  isWithinBrgy41: boolean;
  detectedBarangay: 'Barangay 40' | 'Barangay 41' | null;
  errorMessage: string | null;
  lastUpdated: Date | null;
  // Screen Calibration & Adaptive Display API
  isCalibrated: boolean;
  isScreenCalibrated: boolean;
  isCalibrationOpen: boolean;
  openCalibration: () => void;
  closeCalibration: () => void;
  screenCalibration: ScreenCalibrationSettings;
  viewportMetrics: ViewportMetrics;
  updateScreenCalibration: (patch: Partial<ScreenCalibrationSettings>) => void;
  autoFixScreenDisplay: () => { width: number; height: number; appliedScale: number };
  resetScreenCalibration: () => void;
  uiScale: UiScalePreset;
  setUiScale: (scale: UiScalePreset) => void;
  // Live Satellite GPS API
  requestLocation: () => Promise<boolean>;
  refreshLocation: () => Promise<boolean>;
  resetLocation: () => void;
  setManualLocation: (targetBarangay: 'Barangay 40' | 'Barangay 41') => boolean;
  setPinpointLocation: (lat: number, lng: number, customStreet?: string) => boolean;
}

const LocationContext = createContext<LocationState | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialWarm = readWarmGpsCache();
  const initialJuris = initialWarm
    ? evaluateJurisdiction(initialWarm.lat, initialWarm.lng)
    : null;

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialWarm ? { lat: initialWarm.lat, lng: initialWarm.lng } : null
  );
  const [rawGpsCoords, setRawGpsCoords] = useState<{ lat: number; lng: number } | null>(
    initialWarm ? { lat: initialWarm.lat, lng: initialWarm.lng } : null
  );
  const [address, setAddress] = useState<string>(initialWarm?.address || '');
  const [detectedStreet, setDetectedStreet] = useState<string>(initialWarm?.detectedStreet || '');
  const [detectedHouseNumber, setDetectedHouseNumber] = useState<string>(
    initialWarm?.detectedHouseNumber || ''
  );
  const [accuracy, setAccuracy] = useState<number | null>(initialWarm?.accuracy ?? null);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>(
    initialWarm ? 'granted' : 'idle'
  );
  const [isEnabled, setIsEnabled] = useState<boolean>(Boolean(initialWarm));
  const [isWithinJurisdiction, setIsWithinJurisdiction] = useState<boolean>(
    initialJuris ? initialJuris.isWithinJurisdiction : false
  );
  const [isWithinBrgy40, setIsWithinBrgy40] = useState<boolean>(
    initialJuris ? initialJuris.isWithinBrgy40 : false
  );
  const [isWithinBrgy41, setIsWithinBrgy41] = useState<boolean>(
    initialJuris ? initialJuris.isWithinBrgy41 : false
  );
  const [detectedBarangay, setDetectedBarangay] = useState<'Barangay 40' | 'Barangay 41' | null>(
    initialJuris?.isWithinBrgy40
      ? 'Barangay 40'
      : initialJuris?.isWithinBrgy41
      ? 'Barangay 41'
      : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialWarm ? new Date(initialWarm.timestamp) : null
  );

  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [screenCalibration, setScreenCalibration] = useState<ScreenCalibrationSettings>(() =>
    loadStoredScreenCalibration()
  );
  const [viewportMetrics, setViewportMetrics] = useState<ViewportMetrics>(() => {
    const dim = readLiveViewportDimensions();
    const autoCfg = computeAdaptiveScaleForWidth(dim.width, dim.height);
    return {
      ...dim,
      effectiveScalePercent: autoCfg.scalePercent,
    };
  });

  const watchIdRef = useRef<number | null>(null);
  const refineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentSamplesRef = useRef<GpsSample[]>([]);
  const currentFilteredRef = useRef<{ lat: number; lng: number; acc: number; ts: number } | null>(
    initialWarm
      ? {
          lat: initialWarm.lat,
          lng: initialWarm.lng,
          acc: initialWarm.accuracy ?? 25,
          ts: initialWarm.timestamp,
        }
      : null
  );
  const lastGeocodeRef = useRef<{
    lat: number;
    lng: number;
    acc: number;
    time: number;
  } | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  // Apply CSS custom properties & root rem scaling whenever screenCalibration or viewport changes
  const syncAdaptiveDomStyles = useCallback((settings: ScreenCalibrationSettings) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const dim = readLiveViewportDimensions();
    const autoDecision = computeAdaptiveScaleForWidth(dim.width, dim.height);

    const effectiveScale =
      settings.mode === 'custom' ? settings.scalePercent : autoDecision.scalePercent;
    const effectiveCompact =
      settings.mode === 'custom' ? settings.compactCards : autoDecision.compactCards;

    const root = document.documentElement;
    const computedPx = Number(((16 * effectiveScale) / 100).toFixed(2));
    root.style.fontSize = `${computedPx}px`;
    root.style.setProperty('--app-safe-x', `${settings.safePaddingX}px`);
    root.style.setProperty('--app-safe-top', `${settings.safePaddingTop}px`);
    root.style.setProperty('--app-safe-bottom', `${settings.safePaddingBottom}px`);
    root.style.setProperty('--app-vh', `${dim.height}px`);

    if (effectiveCompact) {
      root.setAttribute('data-compact-ui', 'true');
    } else {
      root.removeAttribute('data-compact-ui');
    }

    if (window.scrollX !== 0) {
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' as ScrollBehavior });
    }

    setViewportMetrics({
      ...dim,
      effectiveScalePercent: effectiveScale,
    });
  }, []);

  useEffect(() => {
    syncAdaptiveDomStyles(screenCalibration);
    try {
      localStorage.setItem(SCREEN_CALIBRATION_STORAGE_KEY, JSON.stringify(screenCalibration));
    } catch {}
  }, [screenCalibration, syncAdaptiveDomStyles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;
    const handleViewportChange = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        syncAdaptiveDomStyles(screenCalibration);
      });
    };

    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('orientationchange', handleViewportChange, { passive: true });
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleViewportChange, { passive: true });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      if (vv) {
        vv.removeEventListener('resize', handleViewportChange);
      }
    };
  }, [screenCalibration, syncAdaptiveDomStyles]);

  const triggerGlobalLayoutReflow = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 280);
  }, []);

  const updateScreenCalibration = useCallback(
    (patch: Partial<ScreenCalibrationSettings>) => {
      setScreenCalibration((prev) => ({
        mode: patch.mode ?? 'custom',
        scalePercent: clampNum(patch.scalePercent ?? prev.scalePercent, 75, 115),
        safePaddingX: clampNum(patch.safePaddingX ?? prev.safePaddingX, 0, 24),
        safePaddingTop: clampNum(patch.safePaddingTop ?? prev.safePaddingTop, 0, 32),
        safePaddingBottom: clampNum(patch.safePaddingBottom ?? prev.safePaddingBottom, 0, 48),
        compactCards: patch.compactCards ?? prev.compactCards,
      }));
      triggerGlobalLayoutReflow();
    },
    [triggerGlobalLayoutReflow]
  );

  const autoFixScreenDisplay = useCallback(() => {
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.setAttribute('name', 'viewport');
        document.head.appendChild(viewportMeta);
      }
      viewportMeta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, viewport-fit=cover'
      );

      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' as ScrollBehavior });
    }

    const dim = readLiveViewportDimensions();
    const ideal = computeAdaptiveScaleForWidth(dim.width, dim.height);
    const recommendedPaddingX = dim.width <= 360 ? 4 : 0;
    const nextSettings: ScreenCalibrationSettings = {
      mode: 'custom',
      scalePercent: ideal.scalePercent,
      safePaddingX: recommendedPaddingX,
      safePaddingTop: 0,
      safePaddingBottom: 0,
      compactCards: ideal.compactCards || dim.width < 380,
    };

    setScreenCalibration(nextSettings);
    syncAdaptiveDomStyles(nextSettings);
    triggerGlobalLayoutReflow();

    return {
      width: dim.width,
      height: dim.height,
      appliedScale: nextSettings.scalePercent,
    };
  }, [syncAdaptiveDomStyles, triggerGlobalLayoutReflow]);

  const resetScreenCalibration = useCallback(() => {
    setScreenCalibration(DEFAULT_SCREEN_CALIBRATION);
    try {
      localStorage.removeItem(SCREEN_CALIBRATION_STORAGE_KEY);
    } catch {}
    syncAdaptiveDomStyles(DEFAULT_SCREEN_CALIBRATION);
    triggerGlobalLayoutReflow();
  }, [syncAdaptiveDomStyles, triggerGlobalLayoutReflow]);

  const uiScale: UiScalePreset =
    viewportMetrics.effectiveScalePercent <= 94
      ? 'compact'
      : viewportMetrics.effectiveScalePercent >= 104
      ? 'large'
      : 'normal';

  const setUiScale = useCallback(
    (scale: UiScalePreset) => {
      const targetPercent = scale === 'compact' ? 90 : scale === 'large' ? 105 : 100;
      updateScreenCalibration({ mode: 'custom', scalePercent: targetPercent });
    },
    [updateScreenCalibration]
  );

  // Instant (<1ms) local cadastral street match + high-detail zoom=18 exact doorstep reverse geocoding
  const resolveFastAddress = useCallback(
    async (lat: number, lng: number, acc: number | null, force = false) => {
      const localMatch = resolveLocalCaviteStreet(lat, lng);
      const effectiveAcc = acc ?? 25;

      // Only seed provisional address from localMatch if we don't already have a richer cloud address at this spot
      if (localMatch && !address) {
        setAddress(localMatch.fullAddress);
        if (localMatch.streetName) {
          setDetectedStreet(localMatch.streetName);
        }
      }

      const now = Date.now();
      if (!force && lastGeocodeRef.current) {
        const movedMeters = haversineDistanceMeters(
          lastGeocodeRef.current.lat,
          lastGeocodeRef.current.lng,
          lat,
          lng
        );
        const accuracyImprovedBy = lastGeocodeRef.current.acc - effectiveAcc;
        if (
          movedMeters < 3 &&
          accuracyImprovedBy < 5 &&
          now - lastGeocodeRef.current.time < 15000
        ) {
          return;
        }
      }
      lastGeocodeRef.current = { lat, lng, acc: effectiveAcc, time: now };

      if (geocodeAbortRef.current) {
        geocodeAbortRef.current.abort();
      }
      const controller = new AbortController();
      geocodeAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 3800);

      const dedupeAddressParts = (parts: (string | undefined | null)[]): string => {
        const seen = new Set<string>();
        const clean: string[] = [];
        for (const raw of parts) {
          const trimmed = (raw || '').trim().replace(/^,+|,+$/g, '').trim();
          if (!trimmed) continue;
          const key = trimmed.toLowerCase();
          if (seen.has(key)) continue;
          // Skip if an existing part already contains this exact substring (e.g. "Barangay 41" inside "Barangay 41 (Rosal)")
          const alreadyCovered = clean.some(
            (existing) =>
              existing.toLowerCase().includes(key) && existing.length > trimmed.length
          );
          if (alreadyCovered) continue;
          seen.add(key);
          clean.push(trimmed);
        }
        return clean.join(', ');
      };

      interface ParsedGeoDetail {
        houseNumber: string;
        premise: string;
        street: string;
        neighbourhood: string;
        barangayOrSuburb: string;
        city: string;
        postcode: string;
        province: string;
      }

      const fetchNominatimExact = async (): Promise<ParsedGeoDetail | null> => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1&accept-language=en`,
            { signal: controller.signal }
          );
          if (!r.ok) return null;
          const data = await r.json();
          const a = data?.address || {};
          const premise =
            data?.name ||
            a.building ||
            a.amenity ||
            a.shop ||
            a.office ||
            a.historic ||
            a.tourism ||
            '';
          const road =
            a.road ||
            a.pedestrian ||
            a.residential ||
            a.footway ||
            a.path ||
            a.street ||
            a.cycleway ||
            '';
          const cleanPremise =
            premise && road && premise.toLowerCase() === road.toLowerCase() ? '' : premise;

          return {
            houseNumber: a.house_number || '',
            premise: cleanPremise,
            street: road,
            neighbourhood: a.neighbourhood || a.quarter || a.allotments || '',
            barangayOrSuburb: a.suburb || a.village || a.hamlet || a.city_district || '',
            city: a.city || a.town || a.municipality || '',
            postcode: a.postcode || '',
            province: a.state || a.province || a.region || '',
          };
        } catch {
          return null;
        }
      };

      const fetchPhotonExact = async (): Promise<ParsedGeoDetail | null> => {
        try {
          const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
            signal: controller.signal,
          });
          if (!r.ok) return null;
          const json = await r.json();
          const p = json?.features?.[0]?.properties;
          if (!p) return null;
          const street = p.street || '';
          const name = p.name && p.name !== street ? p.name : '';
          return {
            houseNumber: p.housenumber || '',
            premise: name,
            street,
            neighbourhood: p.district || '',
            barangayOrSuburb: p.locality || '',
            city: p.city || p.county || '',
            postcode: p.postcode || '',
            province: p.state || '',
          };
        } catch {
          return null;
        }
      };

      try {
        const [nom, pho] = await Promise.all([fetchNominatimExact(), fetchPhotonExact()]);

        let finalFull = '';
        let finalStreet = '';
        let finalHouse = '';

        if (nom || pho || localMatch) {
          const houseNum = nom?.houseNumber || pho?.houseNumber || '';
          const premise = nom?.premise || pho?.premise || '';
          const rawStreet = nom?.street || pho?.street || localMatch?.streetName || '';
          const streetLine =
            houseNum && rawStreet
              ? `${houseNum} ${rawStreet}`
              : rawStreet || houseNum;

          const barangayPart = localMatch
            ? localMatch.barangayLabel
            : nom?.barangayOrSuburb || pho?.barangayOrSuburb || '';
          const zoneOrSubd = localMatch
            ? 'Zone 5, Caridad'
            : nom?.neighbourhood || pho?.neighbourhood || '';
          const cityPart = localMatch
            ? 'Cavite City'
            : nom?.city || pho?.city || '';
          const postcode = nom?.postcode || pho?.postcode || (localMatch ? '4100' : '');
          const province = nom?.province || pho?.province || (localMatch ? 'Cavite' : '');
          const postalProvince = [postcode, province].filter(Boolean).join(' ');

          finalFull = dedupeAddressParts([
            premise,
            streetLine,
            barangayPart,
            zoneOrSubd,
            cityPart,
            postalProvince,
          ]);
          finalStreet = streetLine || localMatch?.streetName || '';
          finalHouse = houseNum || premise || '';
        }

        if (!finalFull) {
          const bdcRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
            { signal: controller.signal }
          );
          if (bdcRes.ok) {
            const bdc = await bdcRes.json();
            finalFull = dedupeAddressParts([
              bdc?.locality,
              bdc?.city,
              bdc?.principalSubdivision,
            ]);
          }
        }

        if (finalFull && !controller.signal.aborted) {
          setAddress(finalFull);
          if (finalStreet) {
            setDetectedStreet(finalStreet);
          }
          if (finalHouse) {
            setDetectedHouseNumber(finalHouse);
          }
          saveWarmGpsCache({
            lat,
            lng,
            accuracy: acc,
            address: finalFull,
            detectedStreet: finalStreet,
            detectedHouseNumber: finalHouse,
            timestamp: Date.now(),
          });
        }
      } catch {
        if (localMatch && !controller.signal.aborted) {
          setAddress(localMatch.fullAddress);
          setDetectedStreet(localMatch.streetName);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [address]
  );

  const applyEffectiveCoords = useCallback(
    (
      lat: number,
      lng: number,
      acc: number | null,
      customAddress?: string,
      customStreet?: string,
      forceGeocode = false
    ) => {
      const roundedLat = +lat.toFixed(7);
      const roundedLng = +lng.toFixed(7);
      const adaptiveBuffer = acc !== null ? Math.min(26, Math.max(15, acc * 0.55)) : 18;
      const juris = evaluateJurisdiction(roundedLat, roundedLng, undefined, adaptiveBuffer);

      setCoords({ lat: roundedLat, lng: roundedLng });
      setAccuracy(acc);
      setIsEnabled(true);
      setStatus('granted');
      setErrorMessage(null);
      setLastUpdated(new Date());

      setIsWithinBrgy40(juris.isWithinBrgy40);
      setIsWithinBrgy41(juris.isWithinBrgy41);
      setIsWithinJurisdiction(juris.isWithinJurisdiction);
      if (juris.isWithinBrgy40) {
        setDetectedBarangay('Barangay 40');
      } else if (juris.isWithinBrgy41) {
        setDetectedBarangay('Barangay 41');
      } else {
        setDetectedBarangay(null);
      }

      if (customStreet !== undefined) {
        setDetectedStreet(customStreet);
      }

      if (customAddress) {
        setAddress(customAddress);
        saveWarmGpsCache({
          lat: roundedLat,
          lng: roundedLng,
          accuracy: acc,
          address: customAddress,
          detectedStreet: customStreet || '',
          detectedHouseNumber: '',
          timestamp: Date.now(),
        });
      } else {
        resolveFastAddress(roundedLat, roundedLng, acc, forceGeocode);
      }
    },
    [resolveFastAddress]
  );

  // Inverse-Variance (1/acc^2) Optimal GNSS Filter: evicts coarse Wi-Fi seeds as soon as true satellite GNSS locks
  const handleHardwarePosition = useCallback(
    (pos: GeolocationPosition, isForcedRefresh = false, fromHighAcc = true) => {
      const rawLat = +pos.coords.latitude.toFixed(7);
      const rawLng = +pos.coords.longitude.toFixed(7);
      const rawAcc =
        pos.coords.accuracy && Number.isFinite(pos.coords.accuracy)
          ? Math.max(2, Math.round(pos.coords.accuracy))
          : 25;
      const now = Date.now();

      setRawGpsCoords({ lat: rawLat, lng: rawLng });

      const prev = currentFilteredRef.current;

      // Reject coarse cell-tower / IP bounce (>45m) if we already hold a fresh sharp GNSS fix (<=28m within last 30s)
      if (
        !isForcedRefresh &&
        prev &&
        now - prev.ts < 30000 &&
        prev.acc <= 28 &&
        (!fromHighAcc || rawAcc > Math.max(45, prev.acc * 1.9))
      ) {
        return;
      }

      // Prune samples older than 6 seconds
      let samples = recentSamplesRef.current.filter((s) => now - s.ts <= 6000);

      // Evict coarse non-GNSS seed samples immediately when a true High-Accuracy fix arrives
      if (fromHighAcc) {
        samples = samples.filter((s) => s.highAcc && s.acc <= Math.max(30, rawAcc * 1.6));
      }

      // Motion detection: if user moved beyond uncertainty radius, reset stationary window for zero lag
      if (prev) {
        const movedDist = haversineDistanceMeters(prev.lat, prev.lng, rawLat, rawLng);
        const moveThreshold = Math.max(10, Math.min(40, (rawAcc + prev.acc) * 0.5));
        if (movedDist > moveThreshold && rawAcc <= Math.max(45, prev.acc * 1.5)) {
          samples = [];
        }
      }

      if (rawAcc <= 20) {
        samples = samples.filter((s) => s.acc <= 28);
      }

      samples.push({ lat: rawLat, lng: rawLng, acc: rawAcc, ts: now, highAcc: fromHighAcc });
      if (samples.length > 6) {
        samples = samples.slice(-6);
      }
      recentSamplesRef.current = samples;

      let weightSum = 0;
      let latWeighted = 0;
      let lngWeighted = 0;
      let minSampleAcc = rawAcc;

      for (const s of samples) {
        const sigma = Math.max(3, s.acc);
        const w = 1 / (sigma * sigma);
        weightSum += w;
        latWeighted += s.lat * w;
        lngWeighted += s.lng * w;
        if (s.acc < minSampleAcc) minSampleAcc = s.acc;
      }

      const finalLat = weightSum > 0 ? latWeighted / weightSum : rawLat;
      const finalLng = weightSum > 0 ? lngWeighted / weightSum : rawLng;
      const combinedSigma =
        weightSum > 0
          ? Math.max(2, Math.min(minSampleAcc, Math.round(1 / Math.sqrt(weightSum))))
          : rawAcc;
      const effectiveAcc = samples.length >= 2 ? Math.max(minSampleAcc - 1, combinedSigma) : rawAcc;

      const accuracyUpgradedSignificantly = Boolean(prev && prev.acc - effectiveAcc >= 6);

      currentFilteredRef.current = {
        lat: finalLat,
        lng: finalLng,
        acc: effectiveAcc,
        ts: now,
      };

      if (fromHighAcc && effectiveAcc <= 18) {
        setIsRefining(false);
      }

      applyEffectiveCoords(
        finalLat,
        finalLng,
        effectiveAcc,
        undefined,
        undefined,
        isForcedRefresh || (fromHighAcc && accuracyUpgradedSignificantly)
      );
    },
    [applyEffectiveCoords]
  );

  const stopWatching = useCallback(() => {
    if (refineTimerRef.current) {
      clearTimeout(refineTimerRef.current);
      refineTimerRef.current = null;
    }
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    }
  }, []);

  const startPrecisionWatch = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    if (watchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    }

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          handleHardwarePosition(pos, false, true);
        },
        () => {
          // Keep last valid fix if watch encounters a transient indoor pause
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 12000,
        }
      );
    } catch {}
  }, [handleHardwarePosition]);

  const setManualLocation = useCallback(
    (targetBarangay: 'Barangay 40' | 'Barangay 41') => {
      try {
        sessionStorage.removeItem(GPS_MANUAL_OFF_KEY);
      } catch {}
      setIsRefining(false);
      if (targetBarangay === 'Barangay 40') {
        setDetectedHouseNumber('Barangay 40 Hall');
        applyEffectiveCoords(
          BRGY_40_HALL_COORDS[0],
          BRGY_40_HALL_COORDS[1],
          4,
          'Barangay 40 (Gumamela) Hall & Outpost, Cruz Herrera St., Zone 5, Caridad, Cavite City, 4100 Cavite',
          'Cruz Herrera St.',
          true
        );
      } else {
        setDetectedHouseNumber('Barangay 41 Hall');
        applyEffectiveCoords(
          BRGY_41_HALL_COORDS[0],
          BRGY_41_HALL_COORDS[1],
          4,
          'Barangay 41 (Rosal) Hall, Garcia St., Zone 5, Caridad, Cavite City, 4100 Cavite',
          'Garcia St.',
          true
        );
      }
      return true;
    },
    [applyEffectiveCoords]
  );

  const setPinpointLocation = useCallback(
    (lat: number, lng: number, customStreet?: string) => {
      try {
        sessionStorage.removeItem(GPS_MANUAL_OFF_KEY);
      } catch {}
      stopWatching();
      setIsRefining(false);
      recentSamplesRef.current = [{ lat, lng, acc: 2, ts: Date.now(), highAcc: true }];
      currentFilteredRef.current = { lat, lng, acc: 2, ts: Date.now() };
      applyEffectiveCoords(lat, lng, 2, undefined, customStreet, true);
      return true;
    },
    [applyEffectiveCoords, stopWatching]
  );

  /**
   * Parallel Dual-Track Acquisition:
   * - Track A (Fast Fused Seed): enableHighAccuracy: false -> resolves in ~100ms-600ms so UI NEVER hangs
   * - Track B (True Satellite GNSS): enableHighAccuracy: true, maximumAge: 0 -> sharpens to sub-10m precision
   * - Track C (Continuous Watch): live 1Hz GNSS updates
   */
  const acquireLocationParallel = useCallback(
    async (isRefresh: boolean): Promise<boolean> => {
      if (typeof window === 'undefined') return false;

      try {
        sessionStorage.removeItem(GPS_MANUAL_OFF_KEY);
      } catch {}

      if (!('geolocation' in navigator)) {
        setStatus('unavailable');
        setIsEnabled(false);
        setIsRefining(false);
        setErrorMessage('GPS sensor is not supported on this browser/device.');
        return false;
      }

      if (!coords) {
        setStatus('requesting');
      }
      setErrorMessage(null);
      setIsRefining(true);

      if (isRefresh) {
        recentSamplesRef.current = [];
      }

      if (refineTimerRef.current) clearTimeout(refineTimerRef.current);
      refineTimerRef.current = setTimeout(() => {
        setIsRefining(false);
      }, 6500);

      // Start continuous high-accuracy GNSS satellite stream right away at t = 0
      startPrecisionWatch();

      return new Promise<boolean>((resolve) => {
        let settled = false;
        let pendingCalls = 2;
        let sawPermissionDenied = false;
        let receivedHighAccuracy = false;

        const finishSuccess = (pos: GeolocationPosition, fromHighAcc: boolean) => {
          if (fromHighAcc) {
            receivedHighAccuracy = true;
            handleHardwarePosition(pos, true, true);
          } else if (!receivedHighAccuracy) {
            // Apply fast fused seed ONLY if satellite GNSS hasn't beaten it yet
            handleHardwarePosition(pos, false, false);
          }

          if (!settled) {
            settled = true;
            resolve(true);
          }
        };

        const finishFailure = (err: GeolocationPositionError) => {
          if (err && err.code === 1) {
            sawPermissionDenied = true;
          }
          pendingCalls -= 1;

          // If permission is explicitly denied, fail immediately without waiting for second timeout
          if (sawPermissionDenied && !settled) {
            settled = true;
            stopWatching();
            setIsRefining(false);
            setStatus('denied');
            setIsEnabled(false);
            setErrorMessage(
              'GPS permission denied. Please allow Location access in your browser or phone settings.'
            );
            resolve(false);
            return;
          }

          if (pendingCalls <= 0 && !settled) {
            settled = true;
            setIsRefining(false);
            if (currentFilteredRef.current) {
              setStatus('granted');
              setIsEnabled(true);
              resolve(true);
            } else {
              setStatus('unavailable');
              setIsEnabled(false);
              setErrorMessage(
                'Unable to lock GPS signal right now. Please ensure Location/GPS is turned on.'
              );
              resolve(false);
            }
          }
        };

        // Track 1: Ultra-Fast Fused / Wi-Fi / Cached Seed (<0.5s response)
        navigator.geolocation.getCurrentPosition(
          (pos) => finishSuccess(pos, false),
          (err) => finishFailure(err),
          {
            enableHighAccuracy: false,
            maximumAge: isRefresh ? 5000 : 45000,
            timeout: 2400,
          }
        );

        // Track 2: Dedicated Fresh Satellite GNSS Hardware Lock (runs in parallel at t = 0)
        navigator.geolocation.getCurrentPosition(
          (pos) => finishSuccess(pos, true),
          (err) => finishFailure(err),
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 7000,
          }
        );
      });
    },
    [coords, handleHardwarePosition, startPrecisionWatch, stopWatching]
  );

  const requestLocation = useCallback(async (): Promise<boolean> => {
    return acquireLocationParallel(false);
  }, [acquireLocationParallel]);

  const refreshLocation = useCallback(async (): Promise<boolean> => {
    return acquireLocationParallel(true);
  }, [acquireLocationParallel]);

  const resetLocation = useCallback(() => {
    try {
      sessionStorage.setItem(GPS_MANUAL_OFF_KEY, '1');
      sessionStorage.removeItem(GPS_SESSION_CACHE_KEY);
    } catch {}
    stopWatching();
    recentSamplesRef.current = [];
    currentFilteredRef.current = null;
    setIsRefining(false);
    setCoords(null);
    setRawGpsCoords(null);
    setAddress('');
    setDetectedStreet('');
    setDetectedHouseNumber('');
    setAccuracy(null);
    setStatus('idle');
    setIsEnabled(false);
    setIsWithinJurisdiction(false);
    setIsWithinBrgy40(false);
    setIsWithinBrgy41(false);
    setDetectedBarangay(null);
    setErrorMessage(null);
    setLastUpdated(null);
  }, [stopWatching]);

  // Proactively warm up and lock hardware GPS on mount unless user manually turned it off
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    let cancelled = false;
    const isManualOff = (() => {
      try {
        return sessionStorage.getItem(GPS_MANUAL_OFF_KEY) === '1';
      } catch {
        return false;
      }
    })();

    if (isManualOff) return;

    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((perm) => {
          if (cancelled) return;
          if (perm.state === 'denied') {
            setStatus('denied');
            setIsEnabled(false);
          } else {
            // Start fast parallel acquisition immediately for both 'granted' and 'prompt'
            acquireLocationParallel(false);
          }

          perm.onchange = () => {
            if (perm.state === 'granted') {
              acquireLocationParallel(false);
            } else if (perm.state === 'denied') {
              resetLocation();
              setStatus('denied');
            }
          };
        })
        .catch(() => {
          if (!cancelled) {
            acquireLocationParallel(false);
          }
        });
    } else {
      acquireLocationParallel(false);
    }

    return () => {
      cancelled = true;
      stopWatching();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isScreenCalibrated = screenCalibration.mode === 'custom';

  return (
    <LocationContext.Provider
      value={{
        coords,
        rawGpsCoords,
        address,
        detectedStreet,
        detectedHouseNumber,
        accuracy,
        isRefining,
        status,
        isEnabled,
        isWithinJurisdiction,
        isWithinBrgy40,
        isWithinBrgy41,
        detectedBarangay,
        errorMessage,
        lastUpdated,
        isCalibrated: isScreenCalibrated,
        isScreenCalibrated,
        isCalibrationOpen,
        openCalibration: () => setIsCalibrationOpen(true),
        closeCalibration: () => setIsCalibrationOpen(false),
        screenCalibration,
        viewportMetrics,
        updateScreenCalibration,
        autoFixScreenDisplay,
        resetScreenCalibration,
        uiScale,
        setUiScale,
        requestLocation,
        refreshLocation,
        resetLocation,
        setManualLocation,
        setPinpointLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationState => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
