import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { soundAlert } from '../utils/audioAlarm';
import { compressImage, isValidPhotoSrc } from '../utils/imageCompressor';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onFallbackToFile: () => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onFallbackToFile,
}) => {
  const { language, t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startStream = useCallback(async (facing: 'environment' | 'user') => {
    stopStream();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        language === 'tl'
          ? 'Hindi suportado ang camera sa browser na ito. Gamitin ang file explorer.'
          : 'Camera is not supported on this browser. Please use file explorer.'
      );
      return;
    }

    try {
      // Try environment camera first, then fallback to any video
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback without constraints for basic webcams on PC / TV
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError(
        language === 'tl'
          ? 'Hindi ma-access ang camera (Walang pahintulot o walang nakasaksak na camera).'
          : 'Cannot access camera (Permission denied or no camera device found).'
      );
    }
  }, [language, stopStream]);

  useEffect(() => {
    if (isOpen) {
      startStream(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startStream, stopStream]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, vw);
    canvas.height = Math.max(1, vh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const compressedUrl = await compressImage(rawDataUrl, 1200, 1200, 0.8);
    const finalUrl = isValidPhotoSrc(compressedUrl) ? compressedUrl : rawDataUrl;
    if (!isValidPhotoSrc(finalUrl)) return;

    soundAlert.playChime();
    onCapture(finalUrl);
    stopStream();
    onClose();
  };

  const handleToggleFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
  };

  const handleUseFilePicker = () => {
    stopStream();
    onClose();
    onFallbackToFile();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {t.household.takeLivePhoto}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {cameraActive && (
              <button
                type="button"
                onClick={handleToggleFacing}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title={language === 'tl' ? 'Palitan ang Camera' : 'Switch Camera'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder Area */}
        <div className="relative flex-1 bg-black min-h-[300px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-xs text-xs text-rose-300">
              <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
              <p className="font-bold leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={handleUseFilePicker}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs transition-colors cursor-pointer"
              >
                {t.household.uploadFromFiles}
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target Framing Guides */}
              <div className="pointer-events-none absolute inset-6 sm:inset-10 border-2 border-emerald-400/40 rounded-2xl flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                </div>
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              {!cameraActive && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-slate-300 text-xs font-bold gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>{language === 'tl' ? 'Binubuksan ang camera...' : 'Starting camera...'}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Shutter / Capture Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleUseFilePicker}
            className="text-xs text-slate-400 hover:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            {t.household.uploadFromFiles}
          </button>

          <button
            type="button"
            disabled={!cameraActive}
            onClick={handleCapture}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>{t.household.takeLivePhoto}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="text-xs text-slate-400 hover:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};
