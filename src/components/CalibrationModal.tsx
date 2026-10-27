import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  X,
  CheckCircle2,
  RotateCcw,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Sparkles,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from 'lucide-react';
import { useLocation } from '../context/LocationContext';
import { useLanguage } from '../context/LanguageContext';
import { soundAlert } from '../utils/audioAlarm';

export const CalibrationModal: React.FC = () => {
  const {
    isCalibrationOpen,
    closeCalibration,
    screenCalibration,
    viewportMetrics,
    updateScreenCalibration,
    autoFixScreenDisplay,
    resetScreenCalibration,
    isScreenCalibrated,
  } = useLocation();
  const { language } = useLanguage();
  const isTl = language === 'tl';

  const [isPeekingScreen, setIsPeekingScreen] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    if (isCalibrationOpen) {
      setIsPeekingScreen(false);
      setFeedbackBanner(null);
    }
  }, [isCalibrationOpen]);

  if (!isCalibrationOpen) return null;

  const activeScale = viewportMetrics.effectiveScalePercent;

  const handleOneTapFix = () => {
    soundAlert.playChime();
    const res = autoFixScreenDisplay();
    setFeedbackBanner(
      isTl
        ? `Naayos na ang display para sa iyong screen (${res.width}×${res.height}px · ${res.appliedScale}%).`
        : `Display repaired and fitted to your screen (${res.width}×${res.height}px · ${res.appliedScale}%).`
    );
  };

  const handleScaleStep = (delta: number) => {
    const next = Math.min(115, Math.max(75, activeScale + delta));
    updateScreenCalibration({ mode: 'custom', scalePercent: next });
    setFeedbackBanner(null);
  };

  const handleResetAdaptive = () => {
    soundAlert.playChime();
    resetScreenCalibration();
    setFeedbackBanner(
      isTl
        ? 'Ibinalik sa Auto-Adaptive Screen mode.'
        : 'Restored to Auto-Adaptive Screen mode.'
    );
  };

  const handleSaveAndClose = () => {
    soundAlert.playChime();
    window.dispatchEvent(new Event('resize'));
    closeCalibration();
  };

  const presetScales = [
    {
      value: 80,
      labelTl: '80% · Mas Maliit',
      labelEn: '80% · Extra Compact',
    },
    {
      value: 90,
      labelTl: '90% · Sakto sa Maliit',
      labelEn: '90% · Compact Fit',
    },
    {
      value: 100,
      labelTl: '100% · Karaniwan',
      labelEn: '100% · Standard',
    },
    {
      value: 108,
      labelTl: '108% · Malaki',
      labelEn: '108% · Larger Text',
    },
  ];

  return (
    <>
      {/* Live 4-Corner Screen Fit Boundary Frame so the user can see exact display edges */}
      <div className="screen-fit-guide-frame" aria-hidden="true">
        {/* Top-Left Corner Bracket */}
        <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
        {/* Top-Right Corner Bracket */}
        <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
        {/* Bottom-Left Corner Bracket */}
        <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
        {/* Bottom-Right Corner Bracket */}
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />

        {/* Subtle Top Edge Fit Label */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-300 px-3 py-0.5 rounded-lg text-[10px] font-bold tracking-wide shadow-md whitespace-nowrap">
          {isTl
            ? `Hangganan ng Screen · ${viewportMetrics.width}×${viewportMetrics.height}px (${activeScale}%)`
            : `Screen Fit Boundary · ${viewportMetrics.width}×${viewportMetrics.height}px (${activeScale}%)`}
        </div>
      </div>

      {/* Peek Mode Floating Bar: lets user inspect the actual live app behind the modal */}
      {isPeekingScreen ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-1.5rem)] max-w-md bg-slate-900/95 text-white border border-emerald-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-emerald-300 truncate">
              {isTl ? 'Sinisilip ang Aktwal na Screen' : 'Previewing Live Screen Fit'}
            </div>
            <div className="text-[11px] text-slate-300 font-mono tabular-nums">
              {viewportMetrics.width}×{viewportMetrics.height}px · {activeScale}%
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleScaleStep(-5)}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer border border-slate-700"
              title={isTl ? 'Paliitin pa (-5%)' : 'Shrink (-5%)'}
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScaleStep(5)}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer border border-slate-700"
              title={isTl ? 'Palakihin (+5%)' : 'Enlarge (+5%)'}
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsPeekingScreen(false)}
              className="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{isTl ? 'Bumalik' : 'Back'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-[105] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm sm:text-base truncate">
                    {isTl ? 'Screen Calibration at Display Fit' : 'Screen Calibration & Display Fit'}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {isTl
                      ? 'Ayusin kung putol, sobrang laki, o nag-bug ang display sa phone'
                      : 'Fix cut-off edges, oversized elements, or mobile display glitches'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCalibration}
                className="min-h-[40px] min-w-[40px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title={isTl ? 'Isara' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Calibration Controls */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Primary 1-Tap Screen Bug Fixer */}
              <div className="bg-slate-900 text-white rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-white">
                      {isTl
                        ? 'Hindi kasya o nag-bug ba ang screen?'
                        : 'Screen cut off or bugged on your phone?'}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      {isTl
                        ? 'Pindutin sa ibaba upang awtomatikong sukatin ang iyong cellphone at i-fit nang buo ang lahat ng button, mapa, at teksto.'
                        : 'Tap below to automatically measure your phone screen, clear zoom glitches, and fit all buttons, maps, and text.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleOneTapFix}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">
                      {isTl ? '1-Tap Ayusin at I-Fit sa Screen' : '1-Tap Auto-Fix & Fit Screen'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPeekingScreen(true)}
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="whitespace-nowrap">
                      {isTl ? 'Silipin ang Buong Screen' : 'Preview Full Screen Fit'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Live Screen Diagnostics */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-mono tabular-nums">
                  <span className="font-semibold text-slate-800">
                    {viewportMetrics.width} × {viewportMetrics.height}px
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {viewportMetrics.orientation === 'portrait'
                      ? isTl
                        ? 'Patayo (Portrait)'
                        : 'Portrait'
                      : isTl
                      ? 'Pahiga (Landscape)'
                      : 'Landscape'}
                  </span>
                </div>
                <div className="font-semibold text-emerald-700">
                  {isScreenCalibrated
                    ? isTl
                      ? `Custom Calibrated (${activeScale}%)`
                      : `Custom Calibrated (${activeScale}%)`
                    : isTl
                    ? `Auto-Adaptive (${activeScale}%)`
                    : `Auto-Adaptive (${activeScale}%)`}
                </div>
              </div>

              {/* Section 1: UI & Text Scale Calibration */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Maximize2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      {isTl ? 'Sukat ng Buong Display (Zoom / Fit)' : 'Overall Display Scale (Zoom / Fit)'}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-xs font-bold text-emerald-700">
                    {activeScale}%
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleScaleStep(-5)}
                    disabled={activeScale <= 75}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                    title={isTl ? 'Paliitin para magkasya (-5%)' : 'Make smaller to fit (-5%)'}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min={75}
                    max={115}
                    step={1}
                    value={activeScale}
                    onChange={(e) =>
                      updateScreenCalibration({
                        mode: 'custom',
                        scalePercent: Number(e.target.value),
                      })
                    }
                    aria-label={isTl ? 'Sukat ng Display' : 'Display Scale'}
                    className="flex-1 accent-emerald-600 cursor-pointer h-2"
                  />

                  <button
                    type="button"
                    onClick={() => handleScaleStep(5)}
                    disabled={activeScale >= 115}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                    title={isTl ? 'Palakihin (+5%)' : 'Make larger (+5%)'}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Scale Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {presetScales.map((preset) => {
                    const isSelected = activeScale === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() =>
                          updateScreenCalibration({
                            mode: 'custom',
                            scalePercent: preset.value,
                          })
                        }
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap truncate ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {isTl ? preset.labelTl : preset.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Safe Edge Margins for Curved Screens, Notches, and Nav Bars */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {isTl
                      ? 'Palugit sa Gilid, Taas, at Ibaba ng Screen'
                      : 'Safe Edge Margins (Sides, Notch & Bottom Bar)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isTl
                    ? 'I-adjust kung natatakpan ng curved edge, front camera notch, o navigation buttons ng cellphone ang gilid ng app:'
                    : 'Adjust inward margins if curved screen edges, camera cutouts, or phone navigation bars clip the display:'}
                </p>

                <div className="space-y-2.5">
                  {/* Left & Right Margin */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {isTl ? 'Kaliwa at Kanang Gilid' : 'Left & Right Side Edges'}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {screenCalibration.safePaddingX}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={2}
                      value={screenCalibration.safePaddingX}
                      onChange={(e) =>
                        updateScreenCalibration({
                          mode: 'custom',
                          safePaddingX: Number(e.target.value),
                        })
                      }
                      aria-label={isTl ? 'Kaliwa at Kanang Gilid' : 'Left and Right Side Edges'}
                      className="w-full accent-emerald-600 cursor-pointer h-2"
                    />
                  </div>

                  {/* Top Notch Margin */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {isTl ? 'Itaas (Camera Notch / Status Bar)' : 'Top Edge (Camera Notch / Status Bar)'}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {screenCalibration.safePaddingTop}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={32}
                      step={2}
                      value={screenCalibration.safePaddingTop}
                      onChange={(e) =>
                        updateScreenCalibration({
                          mode: 'custom',
                          safePaddingTop: Number(e.target.value),
                        })
                      }
                      aria-label={isTl ? 'Palugit sa Itaas' : 'Top Safe Margin'}
                      className="w-full accent-emerald-600 cursor-pointer h-2"
                    />
                  </div>

                  {/* Bottom Navigation Bar Margin */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {isTl ? 'Ibaba (Phone Navigation Bar)' : 'Bottom Edge (Phone Navigation Bar)'}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        {screenCalibration.safePaddingBottom}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={48}
                      step={4}
                      value={screenCalibration.safePaddingBottom}
                      onChange={(e) =>
                        updateScreenCalibration({
                          mode: 'custom',
                          safePaddingBottom: Number(e.target.value),
                        })
                      }
                      aria-label={isTl ? 'Palugit sa Ibaba' : 'Bottom Safe Margin'}
                      className="w-full accent-emerald-600 cursor-pointer h-2"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Compact Spacing Mode Toggle */}
              <button
                type="button"
                onClick={() =>
                  updateScreenCalibration({
                    mode: 'custom',
                    compactCards: !screenCalibration.compactCards,
                  })
                }
                className={`w-full min-h-[48px] p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  screenCalibration.compactCards
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Minimize2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold">
                      {isTl ? 'Compact Layout para sa Maliit na Screen' : 'Compact Layout for Small Screens'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {isTl
                        ? 'Binabawasan ang sobrang espasyo upang mas maraming makita nang buo'
                        : 'Tightens card spacing so more controls fit comfortably on small phones'}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                    screenCalibration.compactCards
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  {screenCalibration.compactCards
                    ? isTl
                      ? 'NAKA-ON'
                      : 'ON'
                    : isTl
                    ? 'NAKA-OFF'
                    : 'OFF'}
                </span>
              </button>

              {feedbackBanner && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{feedbackBanner}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetAdaptive}
                className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isTl ? 'Auto-Adaptive Default' : 'Auto-Adaptive Default'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndClose}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isTl ? 'I-save ang Screen Fit' : 'Save Screen Fit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
