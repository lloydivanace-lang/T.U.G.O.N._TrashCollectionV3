import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Maximize2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { isValidPhotoSrc, resolvePhotoSrc } from '../utils/imageCompressor';

interface ResolvedPhotoProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  showExpandHint?: boolean;
}

export const ResolvedPhoto: React.FC<ResolvedPhotoProps> = ({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  onClick,
  showExpandHint = false,
}) => {
  const { language } = useLanguage();
  const [resolved, setResolved] = useState<string>(() => (isValidPhotoSrc(src) ? src : ''));
  const [failed, setFailed] = useState<boolean>(() => !isValidPhotoSrc(src));

  useEffect(() => {
    let active = true;
    if (!isValidPhotoSrc(src)) {
      setResolved('');
      setFailed(true);
      return;
    }
    setFailed(false);
    resolvePhotoSrc(src).then((out) => {
      if (!active) return;
      if (out) {
        setResolved(out);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [src]);

  if (failed || !resolved) {
    return (
      <div
        onClick={onClick}
        className={`bg-slate-100 text-slate-400 flex flex-col items-center justify-center text-center p-1.5 select-none ${
          onClick ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''
        } ${className}`}
        title={
          language === 'tl'
            ? 'Hindi mabasa ang lumang litrato'
            : 'Legacy photo attachment unavailable'
        }
      >
        <ImageOff className="w-4 h-4 shrink-0 text-slate-400" />
        <span className="text-[9px] font-bold leading-tight mt-0.5 line-clamp-2">
          {language === 'tl' ? 'Sira ang file' : 'Invalid image'}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      <img
        src={resolved}
        alt={alt}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
      />
      {showExpandHint && onClick && (
        <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="p-1.5 rounded-full bg-black/65 text-white shadow-md">
            <Maximize2 className="w-3.5 h-3.5" />
          </span>
        </div>
      )}
    </div>
  );
};

interface PhotoLightboxModalProps {
  isOpen: boolean;
  photos: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  photos,
  initialIndex = 0,
  title,
  onClose,
}) => {
  const { language } = useLanguage();
  const safePhotos = Array.isArray(photos) ? photos : [];
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [zoom, setZoom] = useState<number>(1);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const clamped = Math.min(Math.max(0, initialIndex), Math.max(0, safePhotos.length - 1));
      setCurrentIndex(clamped);
      setZoom(1);
    }
  }, [isOpen, initialIndex, safePhotos.length]);

  const activeRawSrc = safePhotos[currentIndex] || '';

  useEffect(() => {
    let active = true;
    if (!isOpen) return;
    if (!isValidPhotoSrc(activeRawSrc)) {
      setResolvedUrl('');
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    resolvePhotoSrc(activeRawSrc).then((url) => {
      if (!active) return;
      if (url) {
        setResolvedUrl(url);
        setLoadFailed(false);
      } else {
        setResolvedUrl('');
        setLoadFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, activeRawSrc]);

  const handlePrev = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (safePhotos.length <= 1) return;
      setZoom(1);
      setCurrentIndex((idx) => (idx > 0 ? idx - 1 : safePhotos.length - 1));
    },
    [safePhotos.length]
  );

  const handleNext = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (safePhotos.length <= 1) return;
      setZoom(1);
      setCurrentIndex((idx) => (idx < safePhotos.length - 1 ? idx + 1 : 0));
    },
    [safePhotos.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || safePhotos.length === 0) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] bg-slate-950/92 backdrop-blur-md flex flex-col justify-between p-2 sm:p-4 select-none animate-in fade-in duration-150"
    >
      {/* Top Toolbar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl mx-auto bg-slate-900/95 border border-slate-700/80 rounded-2xl px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shadow-xl"
      >
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-black text-white truncate">
            {title || (language === 'tl' ? 'Nakalakip na Litrato' : 'Attached Photo')}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 font-semibold">
            {language === 'tl'
              ? `Litrato ${currentIndex + 1} ng ${safePhotos.length}`
              : `Photo ${currentIndex + 1} of ${safePhotos.length}`}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title={language === 'tl' ? 'Liitan (Zoom Out)' : 'Zoom Out'}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono font-bold text-emerald-300 px-1.5 hidden xs:inline">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            title={language === 'tl' ? 'Palakihin (Zoom In)' : 'Zoom In'}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title={language === 'tl' ? 'I-reset ang Zoom' : 'Reset Zoom'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {resolvedUrl && !loadFailed && (
            <a
              href={resolvedUrl}
              download={`TUGON_Photo_${currentIndex + 1}.jpg`}
              onClick={(e) => e.stopPropagation()}
              className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title={language === 'tl' ? 'I-save ang Litrato' : 'Download Photo'}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {language === 'tl' ? 'I-save' : 'Save'}
              </span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white transition-colors cursor-pointer"
            title={language === 'tl' ? 'Isara' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 w-full max-w-5xl mx-auto my-2 flex items-center justify-center overflow-auto">
        {safePhotos.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-1 sm:left-3 z-20 p-2.5 sm:p-3 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700 shadow-xl transition-transform active:scale-95 cursor-pointer"
            title={language === 'tl' ? 'Nakaraang Litrato' : 'Previous Photo'}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
          className="max-w-full max-h-full flex items-center justify-center p-2"
        >
          {loadFailed || !resolvedUrl ? (
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm text-center space-y-3 text-slate-300">
              <ImageOff className="w-10 h-10 mx-auto text-rose-400" />
              <div className="font-extrabold text-sm text-white">
                {language === 'tl'
                  ? 'Hindi mabuksan ang lumang litrato'
                  : 'Cannot open legacy photo attachment'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {language === 'tl'
                  ? 'Ang lumang test record na ito ay may sira o kulang na image data noong ipinasa. Ang mga bagong litratong ia-attach ay gagana at mabubuksan na nang buo.'
                  : 'This older test record contains corrupted or incomplete image data from before the fix. Newly attached photos will open in full clarity.'}
              </p>
            </div>
          ) : (
            <img
              src={resolvedUrl}
              alt={title || 'Attachment'}
              onError={() => setLoadFailed(true)}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              className="max-h-[74vh] max-w-[92vw] sm:max-w-[82vw] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-slate-800 transition-transform duration-150 bg-slate-900"
            />
          )}
        </div>

        {safePhotos.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-1 sm:right-3 z-20 p-2.5 sm:p-3 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700 shadow-xl transition-transform active:scale-95 cursor-pointer"
            title={language === 'tl' ? 'Susunod na Litrato' : 'Next Photo'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {safePhotos.length > 1 ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-5xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-2 flex items-center justify-center gap-2 overflow-x-auto"
        >
          {safePhotos.map((thumb, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setZoom(1);
                setCurrentIndex(idx);
              }}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                idx === currentIndex
                  ? 'border-emerald-400 scale-105 shadow-md'
                  : 'border-slate-700 opacity-65 hover:opacity-100'
              }`}
            >
              <ResolvedPhoto src={thumb} className="w-full h-full" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center text-[11px] text-slate-400 pb-1">
          {language === 'tl'
            ? 'Mag-double tap sa litrato para mag-zoom • Pindutin sa labas o X upang isara'
            : 'Double-tap photo to zoom • Tap outside or X to close'}
        </div>
      )}
    </div>
  );
};
