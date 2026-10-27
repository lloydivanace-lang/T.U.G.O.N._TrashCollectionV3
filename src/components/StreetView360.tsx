import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Compass,
  RotateCcw,
  Maximize2,
  ExternalLink,
  MapPin,
  Building2,
  Navigation,
  Sparkles,
  Camera,
  Layers,
  Globe,
  Radio,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Minimize2,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  BRGY_40_POLYGON,
  BRGY_41_POLYGON,
  BRGY_40_HALL_COORDS,
  BRGY_41_HALL_COORDS,
  evaluateJurisdiction,
  resolveLocalCaviteStreet,
} from '../utils/jurisdiction';

export interface StreetViewTarget {
  id: 'brgy40' | 'brgy41' | string;
  lat: number;
  lng: number;
  title: string;
  barangay: 'Barangay 40' | 'Barangay 41';
  street: string;
  landmark: string;
  googleMapsUrl?: string;
  panoid?: string;
  yaw?: number;
  pitch?: number;
  thumbnailUrl?: string;
}

// User-specified exact Google Maps coordinates & Photosphere for Barangay 40 (Gumamela):
export const BRGY_40_HALL: StreetViewTarget = {
  id: 'brgy40',
  lat: BRGY_40_HALL_COORDS[0],
  lng: BRGY_40_HALL_COORDS[1],
  title: 'Barangay 40 (Gumamela)',
  barangay: 'Barangay 40',
  street: 'Cruz Herrera St., Caridad, Cavite City',
  landmark: 'Barangay 40 (Gumamela) Hall & Tanod Outpost',
  panoid: 'YGeTkMoM4-P3ggaA5NRMZg',
  yaw: 325.74,
  pitch: 0,
  thumbnailUrl:
    'https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=YGeTkMoM4-P3ggaA5NRMZg&cb_client=lu.gallery.gps&w=900&h=600&yaw=325.73825&pitch=0&thumbfov=100',
  googleMapsUrl:
    'https://www.google.com/local/place/fid/0x3397cd34cbca4d83:0x8888fc9149ced057/photosphere?iu=https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid%3DYGeTkMoM4-P3ggaA5NRMZg%26cb_client%3Dlu.gallery.gps%26w%3D160%26h%3D106%26yaw%3D325.73825%26pitch%3D0%26thumbfov%3D100&ik=CAISFllHZVRrTW9NNC1QM2dnYUE1TlJNWmc%3D',
};

// User-specified exact Google Maps coordinates & Photosphere for Barangay 41 (Rosal):
export const BRGY_41_HALL: StreetViewTarget = {
  id: 'brgy41',
  lat: BRGY_41_HALL_COORDS[0],
  lng: BRGY_41_HALL_COORDS[1],
  title: 'Barangay 41 (Rosal)',
  barangay: 'Barangay 41',
  street: 'Garcia St. (Rosal), Caridad, Cavite City',
  landmark: 'Barangay 41 (Rosal) Community Center & Hall',
  panoid: '3pUtoZV_sGsfRV3sSsBTow',
  yaw: 136.05,
  pitch: -3.49,
  thumbnailUrl:
    'https://streetviewpixels-pa.clients6.google.com/v1/thumbnail?cb_client=maps_sv.tactile&w=900&h=600&pitch=-3.486806411405553&panoid=3pUtoZV_sGsfRV3sSsBTow&yaw=136.05136869911968',
  googleMapsUrl:
    'https://www.google.com/maps/place/Barangay+41+(Rosal),+Caridad,+Cavite/@14.483031,120.8977309,4a,72.2y,136.05h,93.49t/data=!3m7!1e1!3m5!1s3pUtoZV_sGsfRV3sSsBTow!2e0!6shttps:%2F%2Fstreetviewpixels-pa.clients6.google.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-3.486806411405553%26panoid%3D3pUtoZV_sGsfRV3sSsBTow%26yaw%3D136.05136869911968!7i16384!8i8192!4m6!3m5!1s0x3397cd34c418d2b7:0x4707dfab50861b20!2sBarangay+41+(Rosal),+Caridad,+Cavite!3b1!8m2!3d14.4826057!4d120.8965417!16s%2Fg%2F11gbf876w1?entry=ttu&g_ep=EgoyMDI2MTAyMC4wIKXMDSoASAFQAw%3D%3D',
};

// Alias for backwards compatibility
export const BRGY_41_CNHS_HALL: StreetViewTarget = BRGY_41_HALL;

interface StreetView360Props {
  target?: StreetViewTarget;
  onSwitchTarget?: (target: StreetViewTarget) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
  hideCoordinates?: boolean;
}

type ViewMode = 'streetview' | 'satellite' | 'roadmap';

export const StreetView360: React.FC<StreetView360Props> = ({
  target = BRGY_40_HALL,
  onSwitchTarget,
  onClose,
  hideCoordinates = false,
}) => {
  const { language } = useLanguage();
  const [currentTarget, setCurrentTarget] = useState<StreetViewTarget>(target);
  const [viewMode, setViewMode] = useState<ViewMode>('streetview');
  const [iframeKey, setIframeKey] = useState(0);
  const [showEmbedIframe] = useState(true);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);

  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);
  const miniMapTileLayerRef = useRef<L.TileLayer | null>(null);
  const miniMapMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      miniMapInstanceRef.current?.invalidateSize();
    }, 120);
    return () => clearTimeout(t);
  }, [isMobileFullscreen, viewMode]);

  // Synchronize when parent prop changes
  useEffect(() => {
    if (target && target.id !== currentTarget.id) {
      setCurrentTarget(target);
    }
  }, [target]);

  const handleSelectTarget = (newTarget: StreetViewTarget) => {
    setCurrentTarget(newTarget);
    setIframeKey((prev) => prev + 1);
    if (onSwitchTarget) onSwitchTarget(newTarget);
  };

  // Create Google Tile Layer (Satellite vs Street)
  const getGoogleTileUrl = (mode: 'satellite' | 'roadmap') => {
    if (mode === 'satellite') {
      return 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    }
    return 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
  };

  // Big, prominent 3D pinpoint for Satelayt (Satellite) & Kalsada (Roadmap)
  const createBigPinIcon = (target: StreetViewTarget) => {
    const isB40 = target.id === 'brgy40' || target.barangay?.includes('40');
    const primaryColor = isB40 ? '#06b6d4' : '#10b981';
    const glowColor = isB40 ? 'rgba(6, 182, 212, 0.45)' : 'rgba(16, 185, 129, 0.45)';
    const labelText = isB40 ? 'Barangay 40 (Gumamela)' : 'Barangay 41 (Rosal)';

    return L.divIcon({
      className: 'custom-street-big-pin',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto;">
          <!-- Pulsing Big Radar Wave (76px) -->
          <div style="position: absolute; bottom: 8px; width: 76px; height: 76px; border-radius: 9999px; background: ${glowColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>

          <!-- Big Floating High-Contrast Label Pill -->
          <div style="
            margin-bottom: 6px; 
            background: rgba(15, 23, 42, 0.95); 
            border: 2.5px solid #ffffff; 
            color: #ffffff; 
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            font-size: 13px; 
            font-weight: 900; 
            padding: 5px 12px; 
            border-radius: 14px; 
            box-shadow: 0 8px 24px rgba(0,0,0,0.7); 
            white-space: nowrap; 
            display: flex; 
            align-items: center; 
            gap: 6px;
            z-index: 10;
          ">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${primaryColor}; box-shadow: 0 0 10px ${primaryColor};"></span>
            <span>${labelText}</span>
          </div>

          <!-- Large 3D Pin Head & Stem -->
          <div style="
            position: relative; 
            width: 56px; 
            height: 56px; 
            border-radius: 50% 50% 50% 0; 
            transform: rotate(-45deg); 
            background: linear-gradient(135deg, ${primaryColor} 0%, #0f172a 100%); 
            border: 4px solid #ffffff; 
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7), 0 0 20px ${glowColor}; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            z-index: 5;
          ">
            <div style="
              transform: rotate(45deg); 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              color: #ffffff; 
              font-size: 26px; 
              filter: drop-shadow(0 2px 5px rgba(0,0,0,0.6));
            ">
              📍
            </div>
          </div>

          <!-- Ground Contact Target -->
          <div style="
            width: 26px; 
            height: 8px; 
            background: rgba(0,0,0,0.65); 
            border-radius: 50%; 
            filter: blur(2px); 
            margin-top: 3px;
          "></div>
        </div>
      `,
      iconSize: [210, 120],
      iconAnchor: [105, 116],
    });
  };

  // Interactive Leaflet Map for 100% Reliable Rendering
  useEffect(() => {
    if (!miniMapContainerRef.current) return;

    if (!miniMapInstanceRef.current) {
      const map = L.map(miniMapContainerRef.current, {
        center: [currentTarget.lat, currentTarget.lng],
        zoom: 18,
        minZoom: 14,
        maxZoom: 21,
        zoomControl: false,
        attributionControl: false,
      });

      miniMapInstanceRef.current = map;

      const tileLayer = L.tileLayer(
        getGoogleTileUrl(viewMode === 'roadmap' ? 'roadmap' : 'satellite'),
        {
          subdomains: ['0', '1', '2', '3'],
          attribution: '&copy; Google Maps',
          maxZoom: 21,
          crossOrigin: true,
        }
      ).addTo(map);

      miniMapTileLayerRef.current = tileLayer;

      // Render accurate Barangay 41 (Rosal) & Barangay 40 (Gumamela) borders on the Satelayt/Kalsada view
      L.polygon(BRGY_41_POLYGON, {
        color: '#10b981',
        weight: 2.5,
        fillColor: '#10b981',
        fillOpacity: 0.14,
        dashArray: '6, 6',
      }).addTo(map);

      L.polygon(BRGY_40_POLYGON, {
        color: '#06b6d4',
        weight: 2.5,
        fillColor: '#06b6d4',
        fillOpacity: 0.18,
        dashArray: '6, 6',
      }).addTo(map);

      const marker = L.marker([currentTarget.lat, currentTarget.lng], {
        icon: createBigPinIcon(currentTarget),
      }).addTo(map);
      miniMapMarkerRef.current = marker;

      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const juris = evaluateJurisdiction(lat, lng);
        const localSt = resolveLocalCaviteStreet(lat, lng);
        const isB40 = juris.detectedBarangay === 'Barangay 40';
        const newTarget: StreetViewTarget = {
          id: `point-${Date.now()}`,
          lat,
          lng,
          title: isB40 ? 'Barangay 40 (Gumamela)' : 'Barangay 41 (Rosal)',
          barangay: isB40 ? 'Barangay 40' : 'Barangay 41',
          street:
            localSt?.fullAddress ||
            (isB40
              ? 'Barangay 40 (Gumamela), Caridad, Cavite City'
              : 'Barangay 41 (Rosal), Caridad, Cavite City'),
          landmark: localSt?.streetName
            ? `${localSt.streetName} Pinpoint`
            : `${isB40 ? 'Brgy 40 (Gumamela)' : 'Brgy 41 (Rosal)'} Pinpoint`,
        };
        handleSelectTarget(newTarget);
      });
    } else {
      const map = miniMapInstanceRef.current;
      map.setView([currentTarget.lat, currentTarget.lng], 18, { animate: true });

      // Update layer
      if (miniMapTileLayerRef.current) {
        miniMapTileLayerRef.current.setUrl(
          getGoogleTileUrl(viewMode === 'roadmap' ? 'roadmap' : 'satellite')
        );
      }

      if (miniMapMarkerRef.current) {
        miniMapMarkerRef.current.setLatLng([currentTarget.lat, currentTarget.lng]);
        miniMapMarkerRef.current.setIcon(createBigPinIcon(currentTarget));
      }
    }
  }, [currentTarget, viewMode]);

  const directGoogleMapsUrl =
    currentTarget.googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${currentTarget.lat},${currentTarget.lng}`;

  const getEmbedUrl = () => {
    const { lat, lng } = currentTarget;
    if (viewMode === 'satellite') {
      return `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed`;
    }
    if (viewMode === 'roadmap') {
      return `https://maps.google.com/maps?q=${lat},${lng}&t=m&z=18&ie=UTF8&iwloc=&output=embed`;
    }
    // Street View Embed URL
    if (currentTarget.panoid) {
      return `https://www.google.com/maps/embed?pb=!4v1!6m8!1m7!1s${currentTarget.panoid}!2m2!1d${lat}!2d${lng}!3f${currentTarget.yaw || 0}!4f${currentTarget.pitch || 0}!5f0.7820865974627469`;
    }
    return `https://maps.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}&cbp=11,${currentTarget.yaw || 0},0,0,0&output=svembed`;
  };

  return (
    <div
      className={`${
        isMobileFullscreen
          ? 'fixed inset-0 z-[90] w-screen h-[100dvh]'
          : 'relative w-full h-full'
      } flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden`}
    >
      {/* Top Header Bar - Compact & Mobile Touch Scrollable */}
      <div className="p-2 sm:p-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs shrink-0">
        {/* Location & Title + Mobile Fullscreen/Close */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs sm:text-sm text-white truncate">
                  {currentTarget.title}
                </span>
                <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 items-center gap-1">
                  <Globe className="w-2.5 h-2.5" />
                  <span>360° Street View</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {currentTarget.street}
                {!hideCoordinates &&
                  ` • (${currentTarget.lat.toFixed(5)}, ${currentTarget.lng.toFixed(5)})`}
              </p>
            </div>
          </div>

          {/* Mobile Quick Fullscreen & Close Buttons */}
          <div className="flex sm:hidden items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileFullscreen((v) => !v)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer"
              title={
                isMobileFullscreen
                  ? language === 'tl'
                    ? 'Paliitin'
                    : 'Exit Fullscreen'
                  : language === 'tl'
                    ? 'Buong Screen'
                    : 'Fullscreen'
              }
            >
              {isMobileFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileFullscreen(false);
                  onClose();
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 cursor-pointer"
                title={language === 'tl' ? 'Isara' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* View Mode & Actions - Horizontally Swipeable on Mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pb-0.5 sm:pb-0">
          {/* Mode Selector */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700/80 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('streetview')}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                viewMode === 'streetview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Google Maps Street View"
            >
              <Camera className="w-3 h-3" />
              <span>Street View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('satellite')}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                viewMode === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={language === 'tl' ? 'Google Maps Satelayt' : 'Google Maps Satellite'}
            >
              <Layers className="w-3 h-3" />
              <span>{language === 'tl' ? 'Satelayt' : 'Satellite'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('roadmap')}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                viewMode === 'roadmap'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={language === 'tl' ? 'Google Maps Kalsada' : 'Google Maps Street'}
            >
              <Navigation className="w-3 h-3" />
              <span>{language === 'tl' ? 'Kalsada' : 'Street'}</span>
            </button>
          </div>

          {/* Quick Target Switcher: Brgy 40 vs Brgy 41 */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleSelectTarget(BRGY_40_HALL)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black border transition-all cursor-pointer whitespace-nowrap ${
                currentTarget.id === 'brgy40' || currentTarget.barangay === 'Barangay 40'
                  ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              📍 Brgy 40
            </button>
            <button
              type="button"
              onClick={() => handleSelectTarget(BRGY_41_HALL)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-black border transition-all cursor-pointer whitespace-nowrap ${
                currentTarget.id === 'brgy41' || currentTarget.barangay === 'Barangay 41'
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              📍 Brgy 41
            </button>
          </div>

          {/* Desktop Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsMobileFullscreen((v) => !v)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
            title={isMobileFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isMobileFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>
              {isMobileFullscreen
                ? language === 'tl'
                  ? 'Paliitin'
                  : 'Collapse'
                : language === 'tl'
                  ? 'Palakihin'
                  : 'Expand'}
            </span>
          </button>

          {/* Direct 1-Click Open in Real Google Maps App / Web */}
          <a
            href={directGoogleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-black transition-all shadow-md active:scale-95 shrink-0 whitespace-nowrap"
            title="Open in Google Maps"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Google Maps</span>
          </a>

          {onClose && (
            <button
              type="button"
              onClick={() => {
                setIsMobileFullscreen(false);
                onClose();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
              title={language === 'tl' ? 'Bumalik sa Mapa' : 'Back to Map'}
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>{language === 'tl' ? 'Bumalik sa Mapa' : 'Back to Map'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="relative flex-1 w-full h-full bg-slate-900 overflow-hidden touch-manipulation">
        {/* Interactive Google Satellite / Road Map Layer */}
        <div
          ref={miniMapContainerRef}
          className={`w-full h-full absolute inset-0 z-0 ${
            viewMode === 'streetview' && showEmbedIframe ? 'opacity-30 pointer-events-none' : 'opacity-100'
          }`}
        />

        {/* Street View Mode Viewport */}
        {viewMode === 'streetview' && (
          <div className="absolute inset-0 z-10 flex flex-col pointer-events-auto">
            {showEmbedIframe ? (
              <div className="relative w-full h-full">
                <iframe
                  key={`${iframeKey}-${currentTarget.id}`}
                  src={getEmbedUrl()}
                  title={`Google Maps Street View - ${currentTarget.title}`}
                  className="w-full h-full border-0 absolute inset-0 touch-manipulation"
                  loading="eager"
                  allow="accelerometer; gyroscope; fullscreen"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />

                {/* Compact Mobile-Friendly Photosphere Card */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-auto sm:max-w-md bg-slate-950/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2 sm:p-3 shadow-2xl z-20">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {currentTarget.thumbnailUrl && (
                      <div className="relative w-12 h-11 sm:w-16 sm:h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 bg-slate-800 shadow-sm">
                        <img
                          src={currentTarget.thumbnailUrl}
                          alt={currentTarget.title}
                          className="w-full h-full object-cover"
                          loading="eager"
                        />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] font-mono px-1 rounded text-white font-bold">
                          360°
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                        <span className="font-extrabold text-white text-[11px] sm:text-xs truncate">
                          {currentTarget.title}
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-300 truncate mt-0.5">
                        {currentTarget.landmark}
                      </p>
                    </div>
                    <a
                      href={directGoogleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] sm:text-xs shadow-md transition-all active:scale-95"
                    >
                      <span>{language === 'tl' ? 'Buksan 360°' : 'Open 360°'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-slate-900/95 backdrop-blur-lg border border-slate-700 rounded-3xl p-5 shadow-2xl text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-base">
                      {currentTarget.title} 360° Street View
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {currentTarget.street}
                    </p>
                  </div>
                  <a
                    href={directGoogleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg transition-all active:scale-95"
                  >
                    <Compass className="w-4 h-4" />
                    <span>{language === 'tl' ? 'I-load ang 360° sa Google Maps' : 'Load 360° on Google Maps'}</span>
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Top-Left Status Badge (Hidden on small phones in Street View so 360° controls stay unobstructed) */}
        <div className="hidden sm:flex absolute top-3 left-3 pointer-events-none z-20 flex-col gap-1.5">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2 px-3 text-xs shadow-xl text-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="font-extrabold text-white text-[11px]">
              {viewMode === 'streetview'
                ? 'Google Maps Street View'
                : viewMode === 'satellite'
                  ? language === 'tl'
                    ? 'Google Maps Satelayt'
                    : 'Google Maps Satellite'
                  : language === 'tl'
                    ? 'Google Maps Kalsada'
                    : 'Google Maps Street'}
            </span>
          </div>

          {!hideCoordinates && (
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl py-1 px-2.5 text-[10px] font-mono text-emerald-400 shadow-md">
              GPS: {currentTarget.lat.toFixed(6)}, {currentTarget.lng.toFixed(6)}
            </div>
          )}
        </div>

        {/* Floating Zoom & Controls for Interactive Map */}
        {(viewMode === 'satellite' || viewMode === 'roadmap') && (
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => miniMapInstanceRef.current?.zoomIn()}
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center border border-slate-700 backdrop-blur-sm transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => miniMapInstanceRef.current?.zoomOut()}
              className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center border border-slate-700 backdrop-blur-sm transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Floating Footer for Satellite/Road Modes (Hidden on mobile Street View to avoid overlapping card) */}
        <div
          className={`${
            viewMode === 'streetview' ? 'hidden sm:flex' : 'flex'
          } absolute bottom-3 right-3 z-20 items-center gap-2 bg-slate-950/90 backdrop-blur-md border border-slate-700 p-1.5 rounded-2xl shadow-2xl`}
        >
          <span className="text-[11px] text-slate-300 font-bold px-2 hidden sm:inline">
            {currentTarget.barangay} • Cavite City
          </span>
          <a
            href={directGoogleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all active:scale-95 shadow-md"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{language === 'tl' ? 'Tingnan sa Google Maps' : 'View on Google Maps'}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
