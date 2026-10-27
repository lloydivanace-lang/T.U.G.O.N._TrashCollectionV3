import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ExternalLink,
  X,
  MapPin,
  Navigation,
  Crosshair,
  Camera,
} from 'lucide-react';

import { WasteReport } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  StreetView360,
  BRGY_40_HALL,
  BRGY_41_HALL,
  StreetViewTarget,
} from './StreetView360';
import { formatTicketNumber } from '../utils/imageCompressor';
import {
  BRGY_40_POLYGON,
  BRGY_41_POLYGON,
  BRGY_40_HALL_COORDS,
  BRGY_41_HALL_COORDS,
  BRGY_40_CENTER,
  BRGY_41_CENTER,
  COMBINED_JURISDICTION_CENTER,
  evaluateJurisdiction,
} from '../utils/jurisdiction';

interface BarangayMapProps {
  reports: WasteReport[];
  selectedReport: WasteReport | null;
  onSelectReport: (report: WasteReport | null) => void;
  isKagawadView?: boolean;
}

// Real Google Maps Anchors in Barangay 40 (Gumamela) & Barangay 41 (Rosal), Caridad, Cavite City
const CAVITE_LANDMARKS = [
  {
    name: 'Barangay 41 (Rosal) Hall',
    category: 'Barangay 41 (Rosal) • Caridad',
    coords: BRGY_41_HALL_COORDS,
    color: '#10b981',
    isPrimary: true,
  },
  {
    name: 'Barangay 40 (Gumamela) Hall & Outpost',
    category: 'Barangay 40 (Gumamela) • Caridad',
    coords: BRGY_40_HALL_COORDS,
    color: '#06b6d4',
    isPrimary: true,
  },
];

type MapTileStyle = 'osm' | 'satellite' | 'streetview';

export const BarangayMap: React.FC<BarangayMapProps> = ({
  reports,
  selectedReport,
  onSelectReport,
}) => {
  const { language, t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonLayer41Ref = useRef<L.Polygon | null>(null);
  const polygonLayer40Ref = useRef<L.Polygon | null>(null);
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);
  const [currentTileStyle, setCurrentTileStyle] = useState<MapTileStyle>('osm');
  const currentTileStyleRef = useRef<MapTileStyle>('osm');
  currentTileStyleRef.current = currentTileStyle;
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showBrgyBoundaries, setShowBrgyBoundaries] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(17);
  const [activeStreetViewTarget, setActiveStreetViewTarget] = useState<StreetViewTarget>(BRGY_40_HALL);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const selectedReportRef = useRef(selectedReport);
  selectedReportRef.current = selectedReport;

  const onSelectReportRef = useRef(onSelectReport);
  onSelectReportRef.current = onSelectReport;

  useEffect(() => {
    const t = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 120);
    return () => clearTimeout(t);
  }, [isMapFullscreen]);

  // Keep polygon tooltips synchronized when language changes
  useEffect(() => {
    if (polygonLayer41Ref.current) {
      polygonLayer41Ref.current.unbindTooltip();
      polygonLayer41Ref.current.bindTooltip(
        language === 'tl' ? 'SAKOP NG BARANGAY 41 (ROSAL)' : 'BARANGAY 41 (ROSAL) JURISDICTION',
        { permanent: false, sticky: true, direction: 'top', offset: [0, -10], className: 'brgy-41-tooltip' }
      );
    }
    if (polygonLayer40Ref.current) {
      polygonLayer40Ref.current.unbindTooltip();
      polygonLayer40Ref.current.bindTooltip(
        language === 'tl' ? 'SAKOP NG BARANGAY 40 (GUMAMELA)' : 'BARANGAY 40 (GUMAMELA) JURISDICTION',
        { permanent: false, sticky: true, direction: 'top', offset: [0, -10], className: 'brgy-40-tooltip' }
      );
    }
  }, [language]);

  const createTileLayer = (style: MapTileStyle) => {
    if (style === 'satellite') {
      return L.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        {
          subdomains: ['0', '1', '2', '3'],
          attribution: '&copy; Google Maps Satellite',
          maxZoom: 20,
          maxNativeZoom: 19,
        }
      );
    }
    return L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      {
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps Street',
        maxZoom: 20,
        maxNativeZoom: 19,
      }
    );
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: COMBINED_JURISDICTION_CENTER,
      zoom: 17,
      minZoom: 14,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
    });

    mapInstanceRef.current = map;
    tileLayerRef.current = createTileLayer('osm').addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    landmarksLayerRef.current = L.layerGroup().addTo(map);

    // Barangay 41 (Rosal) Polygon (Emerald)
    polygonLayer41Ref.current = L.polygon(BRGY_41_POLYGON, {
      color: '#10b981',
      weight: 3,
      fillColor: '#10b981',
      fillOpacity: 0.16,
      dashArray: '6, 6',
    })
      .bindTooltip(language === 'tl' ? 'SAKOP NG BARANGAY 41 (ROSAL)' : 'BARANGAY 41 (ROSAL) JURISDICTION', {
        permanent: false,
        sticky: true,
        direction: 'top',
        offset: [0, -10],
        className: 'brgy-41-tooltip',
      })
      .addTo(map);

    // Barangay 40 (Gumamela) Polygon (Cyan)
    polygonLayer40Ref.current = L.polygon(BRGY_40_POLYGON, {
      color: '#06b6d4',
      weight: 3,
      fillColor: '#06b6d4',
      fillOpacity: 0.2,
      dashArray: '6, 6',
    })
      .bindTooltip(language === 'tl' ? 'SAKOP NG BARANGAY 40 (GUMAMELA)' : 'BARANGAY 40 (GUMAMELA) JURISDICTION', {
        permanent: false,
        sticky: true,
        direction: 'top',
        offset: [0, -10],
        className: 'brgy-40-tooltip',
      })
      .addTo(map);

    // Frame both accurate barangay polygons nicely on initial load
    const combinedBounds = L.latLngBounds([...BRGY_40_POLYGON, ...BRGY_41_POLYGON]);
    map.fitBounds(combinedBounds, { padding: [24, 24], maxZoom: 17 });

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (currentTileStyleRef.current === 'streetview') {
        const { lat, lng } = e.latlng;
        const juris = evaluateJurisdiction(lat, lng);
        const brgy = juris.detectedBarangay === 'Barangay 40' ? 'Barangay 40' : 'Barangay 41';
        const brgyTitle = brgy === 'Barangay 40' ? 'Barangay 40 (Gumamela)' : 'Barangay 41 (Rosal)';
        setActiveStreetViewTarget({
          id: `point-${Date.now()}`,
          lat,
          lng,
          title: `${brgyTitle} Street Point`,
          barangay: brgy,
          street: `${brgyTitle}, Caridad, Cavite City`,
          landmark: `${brgyTitle} Point`,
        });
        return;
      }
      if (selectedReportRef.current) {
        onSelectReportRef.current(null);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ debounceMoveend: true });
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 350);
    setTimeout(() => map.invalidateSize(), 800);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (currentTileStyle === 'streetview') return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = createTileLayer(currentTileStyle).addTo(map);
    setTimeout(() => {
      map.invalidateSize();
    }, 50);
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [currentTileStyle]);

  useEffect(() => {
    if (!landmarksLayerRef.current || !mapInstanceRef.current) return;
    landmarksLayerRef.current.clearLayers();
    if (!showLandmarks) return;

    CAVITE_LANDMARKS.forEach((lm) => {
      const landmarkIcon = L.divIcon({
        className: 'custom-landmark-marker',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;">
            <!-- Big Pill Label -->
            <div style="
              margin-bottom: 4px;
              background: rgba(15, 23, 42, 0.95); 
              color: #f8fafc; 
              font-size: 11px; 
              font-weight: 800; 
              padding: 4px 10px; 
              border-radius: 10px; 
              white-space: nowrap; 
              box-shadow: 0 4px 14px rgba(0,0,0,0.5);
              border: 2px solid #ffffff;
              display: flex;
              align-items: center;
              gap: 5px;
            ">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${lm.color}; box-shadow: 0 0 8px ${lm.color};"></span>
              <span>${lm.name}</span>
            </div>

            <!-- Big 3D Pin Head & Stem -->
            <div style="
              width: 42px; 
              height: 42px; 
              border-radius: 50% 50% 50% 0; 
              transform: rotate(-45deg); 
              background: linear-gradient(135deg, ${lm.color} 0%, #0f172a 100%); 
              border: 3px solid #ffffff; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              box-shadow: 0 8px 20px rgba(0,0,0,0.5);
            ">
              <div style="transform: rotate(45deg); color: white; font-size: 18px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                🏛️
              </div>
            </div>

            <!-- Pin Target Tip -->
            <div style="width: 14px; height: 4px; background: rgba(0,0,0,0.4); border-radius: 50%; filter: blur(1px); margin-top: 1px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker(lm.coords, { icon: landmarkIcon });
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #1e293b; padding: 2px;">
          <strong style="color: ${lm.color}; font-size: 13px;">${lm.name}</strong><br/>
          <span style="color: #64748b;">${lm.category} • Cavite City</span>
        </div>
      `);
      landmarksLayerRef.current?.addLayer(marker);
    });
  }, [showLandmarks]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (polygonLayer41Ref.current) {
      if (showBrgyBoundaries) {
        if (!map.hasLayer(polygonLayer41Ref.current)) polygonLayer41Ref.current.addTo(map);
      } else {
        if (map.hasLayer(polygonLayer41Ref.current)) map.removeLayer(polygonLayer41Ref.current);
      }
    }

    if (polygonLayer40Ref.current) {
      if (showBrgyBoundaries) {
        if (!map.hasLayer(polygonLayer40Ref.current)) polygonLayer40Ref.current.addTo(map);
      } else {
        if (map.hasLayer(polygonLayer40Ref.current)) map.removeLayer(polygonLayer40Ref.current);
      }
    }
  }, [showBrgyBoundaries]);

  useEffect(() => {
    if (!markersLayerRef.current || !mapInstanceRef.current) return;
    markersLayerRef.current.clearLayers();

    reports.forEach((report) => {
      const isSelected = selectedReport?.id === report.id;
      const isOutside =
        report.needsAssistanceOutside ||
        report.isWithinJurisdiction === false ||
        (report.isWithinBrgy41 === false && !report.barangay?.includes('40'));
      const isElderly = report.isElderly;
      const isBrgy40 = report.barangay?.includes('40') || report.purok?.includes('40');

      let pinColor = isBrgy40 ? '#06b6d4' : '#10b981';
      if (isElderly || report.severityLevel === 'EMERGENCY' || report.severityLevel === 'OVERFLOWING') {
        pinColor = '#ef4444';
      } else if (isOutside) {
        pinColor = '#9333ea';
      } else if (report.status === 'RESOLVED') {
        pinColor = '#10b981';
      }

      const formattedTicket = formatTicketNumber(report.ticketNumber);
      const shortTicket = formattedTicket.replace(/^(TUGON|PULSE|TRASH|DRAW)-CAV-/i, '#');
      const pinHtml = `
        <div class="report-marker-wrapper" style="
          position: relative; 
          transform: translate(-50%, -100%); 
          cursor: pointer;
          transition: transform 0.15s ease-out;
        ">
          <div style="
            position: absolute;
            top: -26px;
            left: 50%;
            transform: translateX(-50%);
            background: #0f172a;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 9999px;
            white-space: nowrap;
            border: 1.5px solid ${pinColor};
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 3px;
          ">
            <span>${shortTicket}</span>
            ${isElderly ? '<span>👴</span>' : ''}
            ${isOutside ? '<span>📍</span>' : ''}
          </div>
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  bottom: -6px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 32px;
                  height: 32px;
                  border-radius: 50%;
                  background: ${pinColor};
                  opacity: 0.35;
                  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                "></div>`
              : ''
          }
          <svg width="${isSelected ? 36 : 30}" height="${isSelected ? 46 : 38}" viewBox="0 0 32 42" fill="none" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45));">
            <path
              d="M16 0C7.16 0 0 7.16 0 16C0 26.25 14.12 40.68 14.73 41.29C15.42 42 16.58 42 17.27 41.29C17.88 40.68 32 26.25 32 16C32 7.16 24.84 0 16 0Z"
              fill="${pinColor}"
              stroke="#ffffff"
              stroke-width="${isSelected ? 2.5 : 1.5}"
            />
            <circle cx="16" cy="15" r="${isSelected ? 7 : 6}" fill="${isSelected ? '#ffffff' : '#0f172a'}" />
            <circle cx="16" cy="15" r="${isSelected ? 4 : 3}" fill="${isSelected ? pinColor : '#ffffff'}" />
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-report-pin',
        html: pinHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([report.coordinates.lat, report.coordinates.lng], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (selectedReportRef.current?.id === report.id) {
          onSelectReportRef.current(null);
        } else {
          onSelectReportRef.current(report);
          mapInstanceRef.current?.panTo([report.coordinates.lat, report.coordinates.lng], {
            animate: true,
            duration: 0.5,
          });
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [reports, selectedReport]);

  const handleFocusBrgy40 = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds(BRGY_40_POLYGON);
    mapInstanceRef.current.flyToBounds(bounds, {
      padding: [36, 36],
      maxZoom: 18,
      duration: 0.8,
    });
  }, []);

  const handleFocusBrgy41 = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds(BRGY_41_POLYGON);
    mapInstanceRef.current.flyToBounds(bounds, {
      padding: [32, 32],
      maxZoom: 17,
      duration: 0.8,
    });
  }, []);

  const handleFocusBoth = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds([...BRGY_40_POLYGON, ...BRGY_41_POLYGON]);
    mapInstanceRef.current.flyToBounds(bounds, {
      padding: [28, 28],
      maxZoom: 17,
      duration: 0.8,
    });
  }, []);

  const handleFitAllPins = useCallback(() => {
    if (!mapInstanceRef.current || reports.length === 0) return;
    const latLngs = reports.map((r) => [r.coordinates.lat, r.coordinates.lng] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 18,
      animate: true,
    });
  }, [reports]);

  return (
    <div
      className={`${
        isMapFullscreen
          ? 'fixed inset-0 z-[80] w-screen h-[100dvh] rounded-none'
          : 'relative w-full h-[480px] sm:h-[620px] rounded-3xl'
      } overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl flex flex-col select-none`}
    >
      {/* Top Map Control Header - Mobile Scrollable */}
      <div className="bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight">
                  {language === 'tl' ? 'Mapa ng Brgy 40 at 41' : 'Barangay 40 & 41 Map'}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-black">
                  40
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black">
                  41
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Interactive GIS • {reports.length} Pin{reports.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Mobile Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsMapFullscreen((v) => !v)}
            className="sm:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[11px] font-bold cursor-pointer"
          >
            {isMapFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{language === 'tl' ? 'Isara' : 'Exit'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{language === 'tl' ? 'Buong Screen' : 'Fullscreen'}</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pb-0.5 sm:pb-0">
          {/* Map Style Switcher (Street / Satellite / Street View) */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCurrentTileStyle('osm');
                setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTileStyle === 'osm'
                  ? 'bg-emerald-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={language === 'tl' ? 'Kalsada at mga Kalye' : 'Streets and Roads'}
            >
              {language === 'tl' ? 'Kalsada' : 'Street'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentTileStyle('satellite');
                setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTileStyle === 'satellite'
                  ? 'bg-emerald-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={language === 'tl' ? 'Google Maps Satelayt' : 'Google Maps Satellite Hybrid'}
            >
              {language === 'tl' ? 'Satelayt' : 'Satellite'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentTileStyle('streetview');
                if (!activeStreetViewTarget) {
                  setActiveStreetViewTarget(BRGY_40_HALL);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                currentTileStyle === 'streetview'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Google Maps Street View"
            >
              <Camera className="w-3 h-3 text-blue-300" />
              <span>Street View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleFocusBoth}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
            title={language === 'tl' ? 'I-focus ang parehong Brgy 40 at 41' : 'Focus both Barangay 40 & 41'}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>40 &amp; 41</span>
          </button>

          <button
            type="button"
            onClick={handleFocusBrgy40}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>Brgy 40</span>
          </button>

          <button
            type="button"
            onClick={handleFocusBrgy41}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>Brgy 41</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBrgyBoundaries((prev) => !prev)}
            className={`px-2 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              showBrgyBoundaries
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            {language === 'tl' ? 'Hangganan' : 'Borders'}
          </button>

          {reports.length > 0 && (
            <button
              type="button"
              onClick={handleFitAllPins}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Pins ({reports.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLandmarks((prev) => !prev)}
            className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
              showLandmarks
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
            title={language === 'tl' ? 'Ipakita ang Barangay Halls' : 'Toggle Barangay Halls'}
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>

          {/* Desktop Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsMapFullscreen((v) => !v)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
            title={isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {isMapFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>
              {isMapFullscreen
                ? language === 'tl'
                  ? 'Paliitin'
                  : 'Collapse'
                : language === 'tl'
                  ? 'Buong Screen'
                  : 'Fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Map or 360 Street View Container */}
      <div className="relative flex-1 w-full h-full bg-slate-900 overflow-hidden touch-manipulation">
        {/* Outer Map ALWAYS in DOM to preserve Leaflet */}
        <div
          className={`w-full h-full absolute inset-0 ${
            currentTileStyle === 'streetview' ? 'invisible pointer-events-none' : 'visible pointer-events-auto'
          }`}
        >
          <div ref={mapContainerRef} className="w-full h-full z-10" />

            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomIn()}
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center border border-slate-700 backdrop-blur-sm transition-all cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomOut()}
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white flex items-center justify-center border border-slate-700 backdrop-blur-sm transition-all cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute top-3 left-3 z-20 bg-slate-900/85 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-[9px] font-mono text-slate-400 shadow-md pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Zoom: {currentZoom}x</span>
              <span className="text-slate-600 hidden xs:inline">|</span>
              <span className="hidden xs:inline">Brgy 40 &amp; 41</span>
            </div>

            {/* Selected Card Popup - Mobile Scrollable */}
            {selectedReport && (
              <div className="absolute bottom-2.5 left-2 right-2 sm:left-auto sm:right-3 sm:max-w-md max-h-[52%] overflow-y-auto z-30 bg-slate-900/95 backdrop-blur-lg p-3 sm:p-4 rounded-2xl border border-slate-700 shadow-2xl text-white animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="font-black text-xs sm:text-sm text-white truncate font-mono">
                      #{formatTicketNumber(selectedReport.ticketNumber)}
                    </span>
                    {selectedReport.needsAssistanceOutside || selectedReport.isWithinJurisdiction === false ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-500/25 text-purple-300 border border-purple-400/40 text-[9px] font-extrabold shrink-0">
                        {language === 'tl' ? 'LABAS NG BRGY 40/41' : 'OUTSIDE BRGY 40/41'}
                      </span>
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold shrink-0 border ${
                        selectedReport.barangay?.includes('40')
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      }`}>
                        {selectedReport.barangay?.includes('40')
                          ? 'Brgy 40 (Gumamela)'
                          : selectedReport.barangay?.includes('41')
                          ? 'Brgy 41 (Rosal)'
                          : selectedReport.barangay || 'Brgy 41 (Rosal)'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const isB40 = selectedReport.barangay?.includes('40');
                        setActiveStreetViewTarget({
                          id: selectedReport.id,
                          lat: selectedReport.coordinates.lat,
                          lng: selectedReport.coordinates.lng,
                          title: `Ticket #${formatTicketNumber(selectedReport.ticketNumber)}`,
                          barangay: isB40 ? 'Barangay 40' : 'Barangay 41',
                          street: selectedReport.streetAddress || selectedReport.realtimeGpsAddress || selectedReport.purok,
                          landmark: selectedReport.landmark || 'Cavite City Waste Report',
                        });
                        setCurrentTileStyle('streetview');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                      title="360° Street View"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Street View</span>
                    </button>
                    <a
                      href={`https://www.google.com/maps?q=${selectedReport.coordinates.lat},${selectedReport.coordinates.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Maps</span>
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReport(null);
                      }}
                      className="p-1 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={language === 'tl' ? 'Isara ang popup' : 'Close popup'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-white text-sm">
                    {selectedReport.purok}
                    {selectedReport.streetAddress && (
                      <span className="text-slate-300 font-medium">
                        {' • '}{selectedReport.streetAddress}
                      </span>
                    )}
                  </div>
                  {selectedReport.realtimeGpsAddress && (
                    <div className="text-[11px] text-amber-300 font-medium bg-amber-950/40 border border-amber-900/60 rounded-lg p-1.5">
                      <strong>{language === 'tl' ? 'Tunay na GPS:' : 'Real-time GPS:'}</strong> {selectedReport.realtimeGpsAddress}
                    </div>
                  )}
                  {selectedReport.extraMessage && (
                    <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-1.5">
                      <strong>{language === 'tl' ? 'Mensahe ng Residente:' : 'Resident Message:'}</strong> &quot;{selectedReport.extraMessage}&quot;
                    </div>
                  )}
                  {selectedReport.residentName && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>
                        {language === 'tl' ? 'Residente:' : 'Resident:'} <strong className="text-slate-200">{selectedReport.residentName}</strong>
                      </span>
                      {selectedReport.isElderly && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-extrabold text-[10px]">
                          {language === 'tl' ? 'Senior Citizen 👴👵' : 'Senior Priority 👴👵'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    {language === 'tl' ? 'Kalubhaan:' : 'Severity:'}{' '}
                    <strong
                      className={
                        selectedReport.severityLevel === 'EMERGENCY' || selectedReport.severityLevel === 'OVERFLOWING'
                          ? 'text-rose-400 font-black'
                          : selectedReport.severityLevel === 'MODERATE'
                          ? 'text-amber-400 font-bold'
                          : 'text-emerald-400 font-semibold'
                      }
                    >
                      {t.severity[selectedReport.severityLevel]?.label || selectedReport.severityLevel}
                    </strong>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {selectedReport.coordinates.lat.toFixed(5)}, {selectedReport.coordinates.lng.toFixed(5)}
                  </span>
                </div>
              </div>
            )}
        </div>

        {/* Street View Mode (Overlay) */}
        {currentTileStyle === 'streetview' && (
          <div className="w-full h-full absolute inset-0 z-20">
            <StreetView360
              target={activeStreetViewTarget || BRGY_40_HALL}
              onSwitchTarget={(newT) => setActiveStreetViewTarget(newT)}
              onClose={() => {
                setCurrentTileStyle('osm');
                setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
              }}
            />
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="bg-slate-950 px-3 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1.5 z-20">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>{language === 'tl' ? 'Senior / Urgent' : 'Senior / Urgent'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{language === 'tl' ? 'Naka-pending' : 'Pending'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>{language === 'tl' ? 'Labas ng Hurisdiksyon' : 'Outside Jurisdiction'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{language === 'tl' ? 'Na-resolba' : 'Resolved'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm border border-emerald-400 bg-emerald-500/20" />
            <span>{language === 'tl' ? 'Hangganan ng Brgy' : 'Brgy Boundaries'}</span>
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          {language === 'tl'
            ? 'Pinch para mag-zoom • I-drag para mag-pan • Pindutin ang pin para sumilip'
            : 'Pinch to zoom • Drag to pan • Tap pin to inspect'}
        </div>
      </div>
    </div>
  );
};
