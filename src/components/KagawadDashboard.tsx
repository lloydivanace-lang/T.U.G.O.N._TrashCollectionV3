import React, { useState, useRef, useEffect } from 'react';
import {
  Map,
  FileText,
  Server,
  Send,
  CheckCircle2,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Navigation,
  FileCode2,
  Camera,
  FolderOpen,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  AlertTriangle,
  Trash2,
  Wifi,
  WifiOff,
  Clock,
  Check,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WasteReport, TelegramBotStatus } from '../types';
import { BarangayMap } from './BarangayMap';
import { ResolutionLogs } from './ResolutionLogs';
import { RaspberryPiCenter } from './RaspberryPiCenter';
import { TelegramCenter } from './TelegramCenter';
import { SourceCodeCenter } from './SourceCodeCenter';
import { soundAlert } from '../utils/audioAlarm';
import { useLanguage } from '../context/LanguageContext';
import { LiveCameraModal } from './LiveCameraModal';
import { PhotoLightboxModal, ResolvedPhoto } from './PhotoLightboxModal';
import { compressImage, isValidPhotoSrc, formatTicketNumber } from '../utils/imageCompressor';
import {
  getStoredPiEndpoint,
  setStoredPiEndpoint,
  getUnifiedPiStatus,
  getUnifiedTelegramStatus,
} from '../utils/piBridge';

interface KagawadDashboardProps {
  reports: WasteReport[];
  onUpdateReportStatus: (
    id: string,
    status: 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED',
    notes?: string,
    proofPhotos?: string[],
    proofKagawadName?: string
  ) => void;
  onDeleteReport: (id: string) => void;
  onClearAllReports?: () => Promise<void>;
  activeStorageMode?: 'pi' | 'cloud';
  onToggleStorageMode?: () => void;
}

const OUTSIDE_PRESET_REASONS = {
  tl: [
    {
      title: 'Labas ng Hurisdiksyon',
      message: 'Paumanhin, ang lokasyon ay nasa labas ng hurisdiksyon ng Barangay 40 at 41. Mangyaring makipag-ugnayan sa inyong lokal na barangay o sanitation office.',
    },
    {
      title: 'Naipasa sa City Sanitation',
      message: 'Naipasa na po ang inyong ulat sa kinauukulang barangay o tanggapan ng Cavite City sanitation para sa nararapat na aksyon.',
    },
    {
      title: 'Kailangan ng Koordinasyon',
      message: 'Nangangailangan ng karagdagang beripikasyon sa inyong tahanan sa Barangay 40 o 41 bago makolekta.',
    },
    {
      title: 'Na-endorso sa Solid Waste Mgt',
      message: 'Na-endorso na sa pamunuan ng Cavite City Solid Waste Management para sa kaukulang aksyon.',
    },
  ],
  en: [
    {
      title: 'Outside Jurisdiction',
      message: 'We apologize, but this location is outside the jurisdiction of Barangay 40 and 41. Please reach out to your local barangay or city sanitation office.',
    },
    {
      title: 'Referred to City Sanitation',
      message: 'Your report has been forwarded to the appropriate barangay or Cavite City sanitation office for action.',
    },
    {
      title: 'Coordination Required',
      message: 'Further verification is required with your household in Barangay 40 or 41 prior to collection dispatch.',
    },
    {
      title: 'Endorsed to Solid Waste Mgt',
      message: 'Endorsed to Cavite City Solid Waste Management administration for scheduled servicing.',
    },
  ],
};

export const KagawadDashboard: React.FC<KagawadDashboardProps> = ({
  reports,
  onUpdateReportStatus,
  onDeleteReport,
  onClearAllReports,
  activeStorageMode = 'pi',
  onToggleStorageMode = () => {},
}) => {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'map' | 'logs' | 'pi' | 'telegram' | 'source'>('map');
  const [selectedReport, setSelectedReport] = useState<WasteReport | null>(null);
  const [photoCarouselIndex, setPhotoCarouselIndex] = useState(0);
  const [lightboxState, setLightboxState] = useState<{
    photos: string[];
    index: number;
    title?: string;
  } | null>(null);

  // Cancellation Modal state
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Action / Proof Modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [reportToResolve, setReportToResolve] = useState<WasteReport | null>(null);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [proofNotes, setProofNotes] = useState('');
  const [proofKagawadName, setProofKagawadName] = useState(
    language === 'tl' ? 'Barangay 40 & 41 Kagawad' : 'Barangay 40 & 41 Official'
  );
  const [proofError, setProofError] = useState('');
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // Deletion Modal state (for spam / fake reports)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<WasteReport | null>(null);

  // Live interconnected Raspberry Pi 4 Status
  const [piLiveStatus, setPiLiveStatus] = useState<{
    online: boolean;
    latencyMs?: number;
    endpoint?: string;
    connectionMethod?: string;
  }>({
    online: false,
    latencyMs: 0,
    endpoint: '',
  });

  // Live Telegram Kagawad Bot Status
  const [telegramLiveStatus, setTelegramLiveStatus] = useState<TelegramBotStatus>({
    online: false,
    status: 'NOT_CONFIGURED',
    botConfigured: false,
    chatId: '',
    botUsername: '',
    autoRestartCount: 0,
    reconnectAttempts: 0,
    lastCheckedAt: '',
    watchdogActive: true,
  });

  const checkPiConnection = async () => {
    try {
      const savedEndpoint = getStoredPiEndpoint();
      const data = await getUnifiedPiStatus(savedEndpoint || undefined, language);
      if (!savedEndpoint && data.configuredUrl) {
        setStoredPiEndpoint(data.configuredUrl);
      }
      setPiLiveStatus({
        online: Boolean(data.online),
        latencyMs: data.latencyMs || 0,
        endpoint: data.configuredUrl || savedEndpoint || '',
        connectionMethod:
          data.connectionMethod ||
          (language === 'tl' ? 'Walang Naka-set' : 'None Configured'),
      });
    } catch {
      setPiLiveStatus((prev) => ({ ...prev, online: false }));
    }
  };

  const checkTelegramConnection = async () => {
    try {
      const data = await getUnifiedTelegramStatus(language);
      setTelegramLiveStatus(data);
    } catch {
      setTelegramLiveStatus((prev) => ({ ...prev, online: false, status: 'OFFLINE' }));
    }
  };

  useEffect(() => {
    checkPiConnection();
    checkTelegramConnection();
    const piInterval = setInterval(checkPiConnection, 5000);
    const tgInterval = setInterval(checkTelegramConnection, 8000);
    return () => {
      clearInterval(piInterval);
      clearInterval(tgInterval);
    };
  }, [language]);

  const [queueFilter, setQueueFilter] = useState<'ALL' | 'BRGY40' | 'BRGY41' | 'ASSISTANCE'>('ALL');
  const proofCameraRef = useRef<HTMLInputElement>(null);
  const proofGalleryRef = useRef<HTMLInputElement>(null);
  const [isProofCameraOpen, setIsProofCameraOpen] = useState(false);

  const safeList = Array.isArray(reports) ? reports : [];

  // Active queue includes reports that are PENDING or DISPATCHED and not purged
  const activeReports = safeList.filter(
    (r) => r && (r.status === 'PENDING' || r.status === 'DISPATCHED') && !r.isPurgedFromFeed
  );

  const brgy40ActiveReports = activeReports.filter(
    (r) => !r.needsAssistanceOutside && r.isWithinJurisdiction !== false && (r.barangay?.includes('40') || r.purok?.includes('40'))
  );

  const brgy41ActiveReports = activeReports.filter(
    (r) =>
      !r.needsAssistanceOutside &&
      r.isWithinJurisdiction !== false &&
      (r.barangay?.includes('41') || r.purok?.includes('41') || (!r.barangay && !r.purok?.includes('40')))
  );

  const outsideAssistanceReports = activeReports.filter(
    (r) => r.needsAssistanceOutside || r.isWithinJurisdiction === false
  );

  const resolvedReports = safeList.filter((r) => r && r.status === 'RESOLVED');
  const elderlyReports = activeReports.filter((r) => r && r.isElderly);

  const filteredQueue = activeReports.filter((r) => {
    if (queueFilter === 'BRGY40') return !r.needsAssistanceOutside && (r.barangay?.includes('40') || r.purok?.includes('40'));
    if (queueFilter === 'BRGY41')
      return (
        !r.needsAssistanceOutside &&
        (r.barangay?.includes('41') || r.purok?.includes('41') || (!r.barangay && !r.purok?.includes('40')))
      );
    if (queueFilter === 'ASSISTANCE') return r.needsAssistanceOutside || r.isWithinJurisdiction === false;
    return true;
  });

  const handleSelectReport = (report: WasteReport | null) => {
    setSelectedReport((prev) => (!report || prev?.id === report.id ? null : report));
    setPhotoCarouselIndex(0);
  };

  const handleOpenResolveWithProof = (report: WasteReport) => {
    setReportToResolve(report);
    setProofPhotos([]);
    setProofKagawadName((prev) =>
      !prev ||
      prev === 'Barangay 40 & 41 Kagawad' ||
      prev === 'Barangay 40 & 41 Official'
        ? language === 'tl'
          ? 'Barangay 40 & 41 Kagawad'
          : 'Barangay 40 & 41 Official'
        : prev
    );
    const isOutside = report.needsAssistanceOutside || report.isWithinJurisdiction === false;
    const currentPresets = OUTSIDE_PRESET_REASONS[language] || OUTSIDE_PRESET_REASONS.tl;
    if (isOutside) {
      setProofNotes(currentPresets[0].message);
    } else {
      setProofNotes(
        language === 'tl'
          ? 'Nakolekta na po ng barangay sanitation crew. Malinis na ang lugar.'
          : 'Collected by barangay sanitation crew. The area is now clean.'
      );
    }
    setProofError('');
    setShowProofModal(true);
  };

  const handleProofPhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = 5 - proofPhotos.length;
    if (remainingSlots <= 0) return;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const validBatch: string[] = [];
    for (const file of filesToProcess) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        if (compressed && isValidPhotoSrc(compressed)) {
          validBatch.push(compressed);
        }
      } catch (err) {
        console.warn('Error reading proof photo:', err);
      }
    }
    if (validBatch.length > 0) {
      setProofPhotos((prev) => [...prev, ...validBatch]);
      setProofError('');
    } else {
      setProofError(
        language === 'tl'
          ? 'Hindi mabasa ang napiling litrato. Pumili ng valid na JPEG o PNG na litrato.'
          : 'Could not read the selected image. Please choose a valid JPEG or PNG photo.'
      );
    }
  };

  const handleProofCameraCapture = async (dataUrl: string) => {
    if (proofPhotos.length >= 5) return;
    const finalPhoto = isValidPhotoSrc(dataUrl)
      ? dataUrl
      : await compressImage(dataUrl, 1200, 1200, 0.8);
    if (!isValidPhotoSrc(finalPhoto)) return;
    setProofPhotos((prev) => [...prev, finalPhoto]);
    setProofError('');
  };

  const removeProofPhoto = (index: number) => {
    setProofPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmResolveWithProof = async () => {
    if (!reportToResolve) return;
    const isOutside = reportToResolve.needsAssistanceOutside || reportToResolve.isWithinJurisdiction === false;

    // For INSIDE Brgy 40 & 41: Photo is MANDATORY
    if (!isOutside && proofPhotos.length === 0) {
      setProofError(
        language === 'tl'
          ? 'Mahigpit na kinakailangan ang proeba (litrato ng nakolektang basura) para sa sakop ng Barangay 40 at Barangay 41.'
          : 'Proof photo of the cleaned site is strictly required for Barangay 40 and 41.'
      );
      return;
    }

    if (isOutside && !proofNotes.trim()) {
      setProofError(
        language === 'tl'
          ? 'Pakilagay ang mensahe o rason kung paano inaksyunan ang concern sa labas ng Brgy 40/41.'
          : 'Please enter notes explaining how the concern outside Barangay 40/41 was handled.'
      );
      return;
    }

    setIsSubmittingProof(true);
    setProofError('');
    try {
      await onUpdateReportStatus(
        reportToResolve.id,
        'RESOLVED',
        proofNotes.trim() ||
          (language === 'tl'
            ? 'Inaksyunan ng Barangay Kagawad.'
            : 'Action taken by Barangay Official.'),
        proofPhotos,
        proofKagawadName.trim() ||
          (language === 'tl' ? 'Barangay 40 & 41 Kagawad' : 'Barangay 40 & 41 Official')
      );
      soundAlert.playFinishedChime();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      setShowProofModal(false);
      setReportToResolve(null);
      setProofPhotos([]);
      setSelectedReport(null);
    } catch (e) {
      console.error(e);
      setProofError(language === 'tl' ? 'Nagka-aberya sa pag-save ng proeba.' : 'Failed to save proof.');
    } finally {
      setIsSubmittingProof(false);
    }
  };

  const handleConfirmCancel = () => {
    if (!selectedReport) return;
    onUpdateReportStatus(
      selectedReport.id,
      'CANCELLED',
      cancelReasonInput ||
        (language === 'tl'
          ? 'Kinansela ng Kagawad (duplicate ticket).'
          : 'Cancelled by Barangay Official (duplicate ticket).')
    );
    setShowCancelModal(false);
    setCancelReasonInput('');
    setSelectedReport(null);
  };

  const handleConfirmDelete = () => {
    if (!reportToDelete) return;
    onDeleteReport(reportToDelete.id);
    if (selectedReport?.id === reportToDelete.id) {
      setSelectedReport(null);
    }
    setShowDeleteModal(false);
    setReportToDelete(null);
    soundAlert.playChime();
  };

  const isSelectedReportOutside = selectedReport
    ? selectedReport.needsAssistanceOutside || selectedReport.isWithinJurisdiction === false
    : false;

  return (
    <div className="w-full max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
      {/* Top Admin Status Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 border border-slate-700/80 p-1.5 flex items-center justify-center shrink-0">
            <img src="/icon.svg" alt="T.U.G.O.N." className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                T.U.G.O.N. Barangay Portal
              </h3>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-xs text-slate-300 font-medium">
                {language === 'tl' ? 'Brgy 40 at 41, Cavite City' : 'Barangay 40 & 41, Cavite City'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              {language === 'tl'
                ? 'Lungsod ng Cavite · Obligado ang Katibayan bago ma-resolve sa Raspberry Pi Cloud Storage'
                : 'Cavite City · Photographic proof required before resolving to Raspberry Pi Cloud Storage'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('source')}
            className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Source Code</span>
          </button>

          <button
            onClick={() => setActiveTab('pi')}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
              piLiveStatus.endpoint
                ? piLiveStatus.online
                  ? 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border-emerald-500/50'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                !piLiveStatus.endpoint
                  ? 'bg-slate-400'
                  : piLiveStatus.online
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-rose-400'
              }`}
            />
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {!piLiveStatus.endpoint
                ? (language === 'tl' ? 'Pi 4B: I-SETUP' : 'Pi 4B: SETUP')
                : piLiveStatus.online
                ? `Pi 4B: LIVE (${piLiveStatus.latencyMs || 25}ms)`
                : (language === 'tl' ? 'Pi 4B: OFFLINE' : 'Pi 4B: OFFLINE')}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
              telegramLiveStatus.online
                ? 'bg-sky-500/25 hover:bg-sky-500/35 text-sky-200 border-sky-500/50'
                : telegramLiveStatus.status === 'RECONNECTING'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                telegramLiveStatus.online
                  ? 'bg-sky-400 animate-pulse'
                  : telegramLiveStatus.status === 'RECONNECTING'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-rose-400'
              }`}
            />
            <Send className="w-3.5 h-3.5" />
            <span>
              {telegramLiveStatus.online
                ? `Telegram: LIVE ${telegramLiveStatus.botUsername ? `(@${telegramLiveStatus.botUsername})` : ''}`
                : telegramLiveStatus.status === 'RECONNECTING'
                ? (language === 'tl' ? 'Telegram: NAG-A-AUTORESTART' : 'Telegram: AUTO-RESTARTING')
                : 'Telegram: OFFLINE'}
            </span>
          </button>
        </div>
      </div>

      {/* REAL-TIME DUAL STATUS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Card 1: Raspberry Pi 4B Cloud Server */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs shadow-xs ${
            !piLiveStatus.endpoint
              ? 'bg-slate-900 border-slate-700 text-slate-300'
              : piLiveStatus.online
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                !piLiveStatus.endpoint
                  ? 'bg-slate-800 border-slate-700 text-slate-400'
                  : piLiveStatus.online
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}
            >
              {!piLiveStatus.endpoint ? (
                <Server className="w-4 h-4 text-slate-400" />
              ) : piLiveStatus.online ? (
                <Wifi className="w-4 h-4 animate-pulse text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs text-white">
                  {!piLiveStatus.endpoint
                    ? (language === 'tl' ? 'Pi Server: HINDI PA NAKA-SET (MANUAL SETUP)' : 'Pi Server: NOT CONFIGURED (MANUAL SETUP)')
                    : piLiveStatus.online
                    ? (language === 'tl' ? '✓ Pi Server: LIVE' : '✓ Pi Server: LIVE')
                    : (language === 'tl' ? '⚠️ Pi Server: OFFLINE' : '⚠️ Pi Server: OFFLINE')}
                </span>
                {piLiveStatus.online && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                    {piLiveStatus.latencyMs || 25}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {!piLiveStatus.endpoint
                  ? language === 'tl'
                    ? 'Ilagay ang iyong Cloud Server Link sa Pi Center anumang oras.'
                    : 'Enter your Cloud Server Link in Pi Center anytime.'
                  : piLiveStatus.online
                  ? language === 'tl'
                    ? `Konektado sa ${piLiveStatus.endpoint} nang maayos.`
                    : `Connected to ${piLiveStatus.endpoint} properly.`
                  : language === 'tl'
                  ? `Hindi maabot ang ${piLiveStatus.endpoint}. Pindutin upang palitan o tanggalin.`
                  : `Cannot reach ${piLiveStatus.endpoint}. Click to change or remove.`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('pi')}
            className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 font-bold text-[11px] shrink-0 cursor-pointer"
          >
            {!piLiveStatus.endpoint
              ? (language === 'tl' ? 'I-setup ang Pi →' : 'Setup Pi →')
              : (language === 'tl' ? 'Pi Center →' : 'Pi Center →')}
          </button>
        </div>

        {/* Card 2: Telegram Bot Auto-Restart Watchdog */}
        <div
          className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs shadow-xs ${
            telegramLiveStatus.online
              ? 'bg-sky-950/60 border-sky-500/40 text-sky-100'
              : telegramLiveStatus.status === 'RECONNECTING'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-100'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                telegramLiveStatus.online
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : telegramLiveStatus.status === 'RECONNECTING'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}
            >
              <Send className={`w-4 h-4 ${telegramLiveStatus.online ? 'animate-pulse text-sky-400' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs text-white">
                  {telegramLiveStatus.online
                    ? `✓ Telegram Bot: ${language === 'tl' ? 'AKTIBO' : 'ACTIVE'} ${telegramLiveStatus.botUsername ? `(@${telegramLiveStatus.botUsername})` : ''}`
                    : telegramLiveStatus.status === 'RECONNECTING'
                    ? (language === 'tl' ? '⚠️ Telegram: NAG-A-AUTORESTART...' : '⚠️ Telegram: AUTO-RESTARTING...')
                    : (language === 'tl' ? '⚠️ Telegram Bot: OFFLINE' : '⚠️ Telegram Bot: OFFLINE')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  Auto-Restart Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {telegramLiveStatus.online
                  ? (language === 'tl'
                      ? 'Alert sa bago at tapos na report (Kusa magre-restart kapag nawalan ng signal).'
                      : 'Alert on new and completed reports (Auto-restarts when disconnected).')
                  : telegramLiveStatus.status === 'RECONNECTING'
                  ? (language === 'tl'
                      ? 'Na-detect ang disconnection. Kusa nang nag-reconnect ang watchdog...'
                      : 'Disconnection detected. Watchdog reconnecting automatically...')
                  : (language === 'tl'
                      ? 'Offline ang bot. I-check ang credentials sa Telegram tab.'
                      : 'Bot offline. Check credentials in Telegram tab.')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('telegram')}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 font-bold text-[11px] shrink-0 cursor-pointer"
          >
            {language === 'tl' ? 'Bot Setup →' : 'Bot Setup →'}
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-cyan-200 bg-cyan-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
            <span className="font-black text-sm">40</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{brgy40ActiveReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">
              {language === 'tl' ? 'Brgy 40 (Gumamela)' : 'Barangay 40 (Gumamela)'}
            </div>
            <div className="text-[10px] text-cyan-700 font-semibold">
              {language === 'tl' ? 'Aktibong Pila' : 'Active Queue'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <span className="font-black text-sm">41</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900">{brgy41ActiveReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">
              {language === 'tl' ? 'Brgy 41 (Rosal)' : 'Barangay 41 (Rosal)'}
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold">
              {language === 'tl' ? 'Aktibong Pila' : 'Active Queue'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <span className="text-xl sm:text-2xl">👴👵</span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-600">{elderlyReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">
              {language === 'tl' ? 'Senior Priority' : 'Senior Priority'}
            </div>
            <div className="text-[10px] text-rose-600 font-semibold">
              {language === 'tl' ? 'Nauuna sa pagkuha' : 'Priority Queue'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600">{resolvedReports.length}</div>
            <div className="text-[11px] sm:text-xs text-slate-700 font-bold">
              {language === 'tl' ? 'Na-resolba (May Proeba)' : 'Resolved (With Proof)'}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">
              {language === 'tl' ? 'Nakatala sa Pi Cloud' : 'Logged in Pi Cloud'}
            </div>
          </div>
        </div>
      </div>

      {/* HORIZONTALLY SCROLLABLE TABS */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 shadow-xs border border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        <button
          onClick={() => setActiveTab('map')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>{t.dashboard.tabMap} ({activeReports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t.dashboard.tabLogs}</span>
        </button>

        <button
          onClick={() => setActiveTab('pi')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'pi'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>{t.dashboard.tabPi}</span>
        </button>

        <button
          onClick={() => setActiveTab('telegram')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'telegram'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>{t.dashboard.tabTelegram}</span>
        </button>

        <button
          onClick={() => setActiveTab('source')}
          className={`shrink-0 flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeTab === 'source'
              ? 'bg-purple-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode2 className="w-4 h-4 text-purple-400" />
          <span>{t.dashboard.tabSource}</span>
        </button>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Map */}
          <div className="lg:col-span-2 space-y-3">
            <BarangayMap
              reports={activeReports}
              selectedReport={selectedReport}
              onSelectReport={handleSelectReport}
              isKagawadView={true}
            />
            <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                <strong>{language === 'tl' ? 'Tuntunin sa Pag-aksyon:' : 'Action Protocol:'}</strong>{' '}
                {language === 'tl'
                  ? 'Kapag ang concern ay Sakop ng Brgy 40/41, kailangan ng proeba (litrato). Kapag Labas ng Brgy 40/41 (Assistance), mensahe na lamang ang ipadadala.'
                  : 'For concerns within Barangay 40/41, photographic proof of cleanup is required. For concerns outside Barangay 40/41 (Assistance), a notification note is sent.'}
              </span>
              <span className="text-purple-700 font-extrabold shrink-0">
                Cavite City Grid
              </span>
            </div>
          </div>

          {/* Right: Selected Concern Inspector OR Active Queue List */}
          <div className="space-y-4">
            {selectedReport ? (
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isSelectedReportOutside ? 'bg-purple-600' : 'bg-red-500'} animate-pulse`} />
                    <span className="font-extrabold text-sm text-slate-900 font-mono">
                      #{formatTicketNumber(selectedReport.ticketNumber)}
                    </span>
                    {isSelectedReportOutside ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                        {language === 'tl' ? 'LABAS NG BRGY 40/41' : 'OUTSIDE BARANGAY 40/41'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {selectedReport.barangay || 'Barangay 41'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Auto-Purge countdown badge */}
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {selectedReport.purgeCountdownText ||
                      (language === 'tl' ? '3-Araw TTL bago ma-auto-purge sa active feed' : '3-Day TTL before auto-purge from active feed')}
                  </span>
                </div>

                {/* Outside Notice if applicable */}
                {isSelectedReportOutside && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1">
                    <div className="font-extrabold text-purple-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-purple-600" />
                      <span>{language === 'tl' ? 'Nangangailangan ng Assistance' : 'Special Assistance Requested'}</span>
                    </div>
                    <p className="text-[11px] text-purple-800 leading-relaxed">
                      {language === 'tl'
                        ? 'Ang residenteng ito ay nasa labas ng Cavite City. Hindi kailangang mag-attach ng litrato; maaari kang magpadala ng mensahe/rason.'
                        : 'This resident is outside immediate jurisdiction. Photographic proof is not strictly required; you may send assistance advice.'}
                    </p>
                  </div>
                )}

                {/* Senior Citizen Alert Banner */}
                {selectedReport.isElderly && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-950 font-bold">
                    <span className="text-2xl">👴👵</span>
                    <div>
                      <span>{language === 'tl' ? 'PRAYORIDAD NG SENIOR CITIZEN' : 'SENIOR CITIZEN PRIORITY'}</span>
                      <p className="text-[10px] font-normal text-rose-700">
                        {language === 'tl' ? 'Nauuna sa pila ng pagkolekta.' : 'Prioritized in the collection queue.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Severity Badge */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">{language === 'tl' ? 'Kalubhaan:' : 'Severity:'}</span>
                  <span className="font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                    {t.severity[selectedReport.severityLevel]?.label || selectedReport.severityLevel}
                  </span>
                </div>

                {/* Address and Details */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                      {language === 'tl' ? 'Lokasyon:' : 'Location:'}
                    </span>
                    <span className="font-extrabold text-sm text-slate-900">
                      {selectedReport.purok}
                    </span>
                    <p className="text-slate-700 font-semibold">
                      {selectedReport.streetAddress || (language === 'tl' ? 'Auto-GPS Pinned' : 'Auto-GPS Pinned')} {selectedReport.houseNumber}
                    </p>
                  </div>

                  {selectedReport.residentName ? (
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="text-slate-400 font-semibold text-[10px] uppercase block">
                          {language === 'tl' ? 'Residente:' : 'Resident:'}
                        </span>
                        <span className="font-bold text-slate-800">{selectedReport.residentName}</span>
                      </div>
                    </div>
                  ) : null}

                  {selectedReport.extraMessage && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-400 font-semibold text-[10px] uppercase block">
                        {language === 'tl' ? 'Karagdagang Mensahe ng Residente:' : 'Additional Message from Resident:'}
                      </span>
                      <p className="text-slate-800 font-bold bg-amber-50 p-2 rounded-xl border border-amber-200 mt-1">
                        &quot;{selectedReport.extraMessage}&quot;
                      </p>
                    </div>
                  )}
                </div>

                {/* Photos Carousel */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold text-slate-700">
                      {language === 'tl' ? 'Litrato ng Residente' : 'Resident Photos'} ({selectedReport.photos.length}):
                    </span>
                    {selectedReport.photos.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxState({
                            photos: selectedReport.photos,
                            index: photoCarouselIndex,
                            title: `#${formatTicketNumber(selectedReport.ticketNumber)} • ${
                              language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                            }`,
                          })
                        }
                        className="text-[11px] font-extrabold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>
                          {language === 'tl' ? 'Buksan nang Buo' : 'Open Full Photo'}
                        </span>
                      </button>
                    )}
                  </div>

                  {selectedReport.photos.length > 0 ? (
                    <div className="space-y-2">
                      <div
                        onClick={() =>
                          setLightboxState({
                            photos: selectedReport.photos,
                            index: photoCarouselIndex,
                            title: `#${formatTicketNumber(selectedReport.ticketNumber)} • ${
                              language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                            }`,
                          })
                        }
                        className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 flex items-center justify-center cursor-pointer group"
                      >
                        <ResolvedPhoto
                          src={selectedReport.photos[photoCarouselIndex]}
                          alt="Resident Attachment"
                          className="w-full h-full"
                        />
                        <div className="pointer-events-none absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/70 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                          <Maximize2 className="w-3 h-3 text-emerald-300" />
                          <span>
                            {language === 'tl' ? 'Pindutin para buksan' : 'Tap to open'}
                          </span>
                        </div>
                        {selectedReport.photos.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoCarouselIndex((idx) =>
                                  idx > 0 ? idx - 1 : selectedReport.photos.length - 1
                                );
                              }}
                              className="absolute left-2 p-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoCarouselIndex((idx) =>
                                  idx < selectedReport.photos.length - 1 ? idx + 1 : 0
                                );
                              }}
                              className="absolute right-2 p-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      {selectedReport.photos.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                          {selectedReport.photos.map((thumb, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setPhotoCarouselIndex(idx);
                                setLightboxState({
                                  photos: selectedReport.photos,
                                  index: idx,
                                  title: `#${formatTicketNumber(selectedReport.ticketNumber)} • ${
                                    language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                                  }`,
                                });
                              }}
                              className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                                idx === photoCarouselIndex
                                  ? 'border-purple-600 shadow-xs'
                                  : 'border-slate-200 opacity-75 hover:opacity-100'
                              }`}
                            >
                              <ResolvedPhoto src={thumb} className="w-full h-full" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                      {language === 'tl' ? 'Walang litrato.' : 'No photos attached.'}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <a
                    href={`https://www.google.com/maps?q=${selectedReport.coordinates.lat},${selectedReport.coordinates.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'tl' ? 'Buksan ang Lokasyon sa Google Maps' : 'Open Location in Google Maps'}</span>
                  </a>

                  {/* ACTION RESOLVE BUTTON */}
                  <button
                    onClick={() => handleOpenResolveWithProof(selectedReport)}
                    className={`w-full py-3.5 px-4 rounded-2xl text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer ${
                      isSelectedReportOutside
                        ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                    }`}
                  >
                    {isSelectedReportOutside ? (
                      <>
                        <MessageSquare className="w-4 h-4 text-purple-200" />
                        <span>{language === 'tl' ? 'Magpadala ng Mensahe / I-aksyon (Assistance)' : 'Send Note / Act on Assistance'}</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-emerald-200" />
                        <span>{language === 'tl' ? 'Mag-attach ng Proeba at I-resolve' : 'Attach Proof & Mark Resolved'}</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>{language === 'tl' ? 'I-cancel' : 'Cancel'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setReportToDelete(selectedReport);
                        setShowDeleteModal(true);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      title={language === 'tl' ? 'Burahin nang permanente (spam/fake)' : 'Delete permanently (spam/fake)'}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      <span>{language === 'tl' ? 'Burahin (Spam)' : 'Delete (Spam)'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Active Queue */
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {language === 'tl' ? 'Aktibong Pila sa Portal' : 'Active Portal Queue'}
                  </h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {filteredQueue.length} {language === 'tl' ? 'naka-lista' : 'listed'}
                  </span>
                </div>

                {/* Sub-Filter Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl text-[11px] font-bold overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setQueueFilter('ALL')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {language === 'tl' ? 'Lahat' : 'All'} ({activeReports.length})
                  </button>
                  <button
                    onClick={() => setQueueFilter('BRGY40')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'BRGY40' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {language === 'tl' ? 'Brgy 40' : 'Barangay 40'} ({brgy40ActiveReports.length})
                  </button>
                  <button
                    onClick={() => setQueueFilter('BRGY41')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'BRGY41' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {language === 'tl' ? 'Brgy 41' : 'Barangay 41'} ({brgy41ActiveReports.length})
                  </button>
                  <button
                    onClick={() => setQueueFilter('ASSISTANCE')}
                    className={`shrink-0 flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      queueFilter === 'ASSISTANCE' ? 'bg-purple-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {language === 'tl' ? 'Labas' : 'Outside'} ({outsideAssistanceReports.length})
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredQueue.length > 0 ? (
                    filteredQueue.map((report) => {
                      const isOutside = report.needsAssistanceOutside || report.isWithinJurisdiction === false;
                      return (
                        <div
                          key={report.id}
                          onClick={() => handleSelectReport(report)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                            isOutside
                              ? 'border-purple-200 bg-purple-50/40 hover:border-purple-400'
                              : 'border-slate-200 bg-slate-50/70 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-xs text-slate-900">
                              #{formatTicketNumber(report.ticketNumber)}
                            </span>
                            <div className="flex items-center gap-1">
                              {isOutside ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                                  ASSISTANCE
                                </span>
                              ) : report.isElderly ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 animate-pulse">
                                  SENIOR 👴👵
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  PENDING
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-700 line-clamp-1">
                            {report.purok} {report.streetAddress ? ` • ${report.streetAddress}` : ''}
                          </div>
                          {report.extraMessage && (
                            <div className="text-[11px] text-slate-600 italic bg-amber-50/60 p-1.5 rounded-lg line-clamp-1 border border-amber-200">
                              &quot;{report.extraMessage}&quot;
                            </div>
                          )}
                          {report.photos && report.photos.length > 0 && (
                            <div className="flex items-center gap-2 pt-0.5">
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxState({
                                    photos: report.photos,
                                    index: 0,
                                    title: `#${formatTicketNumber(report.ticketNumber)} • ${
                                      language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                                    }`,
                                  });
                                }}
                                className="w-11 h-11 rounded-xl overflow-hidden border border-slate-300 shrink-0 shadow-2xs"
                              >
                                <ResolvedPhoto src={report.photos[0]} className="w-full h-full" showExpandHint />
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxState({
                                    photos: report.photos,
                                    index: 0,
                                    title: `#${formatTicketNumber(report.ticketNumber)} • ${
                                      language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                                    }`,
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-800 border border-slate-200 hover:border-purple-300 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Maximize2 className="w-3 h-3 text-purple-600" />
                                <span>
                                  {language === 'tl'
                                    ? `Buksan ang Litrato (${report.photos.length})`
                                    : `Open Photo (${report.photos.length})`}
                                </span>
                              </button>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span>{language === 'tl' ? 'Kalubhaan:' : 'Severity:'} <strong>{t.severity[report.severityLevel]?.label || report.severityLevel}</strong></span>
                            <span>{new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="pt-1 flex items-center justify-between gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportToDelete(report);
                                setShowDeleteModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title={language === 'tl' ? 'Burahin kung spam' : 'Delete if spam'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenResolveWithProof(report);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] flex items-center gap-1 cursor-pointer ${
                                isOutside
                                  ? 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                              }`}
                            >
                              {isOutside ? (
                                <>
                                  <MessageSquare className="w-3 h-3 text-purple-600" />
                                  <span>{language === 'tl' ? 'Mensahe / Rason' : 'Notes / Reason'}</span>
                                </>
                              ) : (
                                <>
                                  <Camera className="w-3 h-3 text-emerald-600" />
                                  <span>{language === 'tl' ? 'Proeba at I-resolve' : 'Proof & Resolve'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      {language === 'tl' ? 'Walang concern sa piniling kategorya.' : 'No concerns found in this category.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === 'logs' && (
        <ResolutionLogs
          reports={reports}
          onViewReport={(r) => {
            setSelectedReport(r);
            setActiveTab('map');
          }}
          onDeleteReport={(id) => {
            const matched = reports.find((r) => r.id === id);
            if (matched) {
              setReportToDelete(matched);
              setShowDeleteModal(true);
            }
          }}
          onClearAllReports={onClearAllReports}
        />
      )}

      {/* Tab 3: Raspberry Pi 4 Center */}
      {activeTab === 'pi' && (
        <RaspberryPiCenter
          activeStorageMode={activeStorageMode}
          onToggleStorageMode={onToggleStorageMode}
        />
      )}

      {/* Tab 4: Telegram Center */}
      {activeTab === 'telegram' && (
        <TelegramCenter pendingCount={activeReports.length} />
      )}

      {/* Tab 5: Source Code Center */}
      {activeTab === 'source' && (
        <SourceCodeCenter />
      )}

      {/* KAGAWAD ACTION / PROOF MODAL */}
      {showProofModal && reportToResolve && (() => {
        const isOutside = reportToResolve.needsAssistanceOutside || reportToResolve.isWithinJurisdiction === false;
        const currentPresets = OUTSIDE_PRESET_REASONS[language] || OUTSIDE_PRESET_REASONS.tl;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${
                    isOutside ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isOutside ? <MessageSquare className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {isOutside
                        ? language === 'tl'
                          ? 'Aksyon sa Concern: Labas ng Brgy 40/41 (Assistance)'
                          : 'Action on Concern: Outside Barangay 40/41 (Assistance)'
                        : language === 'tl'
                        ? 'Kagawad Requirement: Proeba ng Pagkolekta'
                        : 'Official Requirement: Proof of Collection'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Ticket #{formatTicketNumber(reportToResolve.ticketNumber)} • {reportToResolve.purok}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProofModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reportToResolve.photos && reportToResolve.photos.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>
                      {language === 'tl'
                        ? `Nakalakip na Litrato ng Residente (${reportToResolve.photos.length}):`
                        : `Resident Attached Photos (${reportToResolve.photos.length}):`}
                    </span>
                    <span className="text-[10px] text-purple-700 font-bold">
                      {language === 'tl' ? 'Pindutin upang buksan' : 'Tap to enlarge'}
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {reportToResolve.photos.map((rp, rIdx) => (
                      <div
                        key={rIdx}
                        onClick={() =>
                          setLightboxState({
                            photos: reportToResolve.photos,
                            index: rIdx,
                            title: `#${formatTicketNumber(reportToResolve.ticketNumber)} • ${
                              language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                            }`,
                          })
                        }
                        className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 shrink-0 cursor-pointer"
                      >
                        <ResolvedPhoto src={rp} className="w-full h-full" showExpandHint />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Banner */}
              {isOutside ? (
                <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-purple-900">
                    <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      {language === 'tl'
                        ? 'Nasa Labas ng Brgy 40/41 (Nangangailangan ng Assistance):'
                        : 'Outside Barangay 40/41 (Assistance Requested):'}
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    {language === 'tl'
                      ? 'Dahil nasa labas ng Brgy 40/41 ang lokasyong ito, hindi kinakailangang maglagay ng litrato. Ang mensahe sa ibaba ang matatanggap ng residente bilang paliwanag.'
                      : 'Because this location is outside Barangay 40/41, photographic proof is not strictly required. The message below will be sent to the resident.'}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                    <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {language === 'tl'
                        ? 'Obligadong Proeba Bago Ma-resolve (Sakop ng Brgy 40 at 41):'
                        : 'Mandatory Proof Before Resolving (Barangay 40 & 41):'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    {language === 'tl'
                      ? 'Kailangan mag-attach ng litrato ng nilinis o nakolektang lugar upang magsilbing katibayan (proof) para sa residente bago mai-resolve.'
                      : 'You must attach a photograph of the cleaned or collected site as official proof for the resident before resolving.'}
                  </p>
                </div>
              )}

              {/* Presets for outside jurisdiction */}
              {isOutside && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'tl' ? 'Pumili ng Naka-set na Mensahe / Rason (1-Tap):' : 'Choose Preset Response / Reason (1-Tap):'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {currentPresets.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setProofNotes(preset.message)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          proofNotes === preset.message
                            ? 'bg-purple-100 text-purple-900 border-purple-400 font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          <span>📌</span>
                          <span>{preset.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                          {preset.message}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isOutside
                    ? (language === 'tl' ? 'Mensahe / Rason na Ipadadala sa Residente (*Required):' : 'Notes / Reason to Deliver to Resident (*Required):')
                    : (language === 'tl' ? 'Mensahe / Resolution Note pabalik sa Residente:' : 'Resolution Notes to Deliver to Resident:')}
                </label>
                <textarea
                  rows={3}
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder={language === 'tl' ? 'Ilagay ang dahilan o detalye ng aksyon...' : 'Enter details of the action taken...'}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              {/* Photo Attachment */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>
                    {isOutside
                      ? language === 'tl'
                        ? 'Litrato ng Proeba (Opsyonal para sa Labas ng Brgy 40/41):'
                        : 'Proof Photos (Optional for Outside Barangay 40/41):'
                      : language === 'tl'
                      ? 'Litrato ng Proeba (*Kinakailangan para sa Brgy 40 at 41):'
                      : 'Proof Photos (*Required for Barangay 40 & 41):'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    proofPhotos.length > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : isOutside
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {proofPhotos.length} {language === 'tl' ? 'na-attach' : 'attached'} {isOutside ? (language === 'tl' ? '(Opsyonal)' : '(Optional)') : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsProofCameraOpen(true)}
                    className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-white" />
                    <span>{language === 'tl' ? 'Kumuha (Camera)' : 'Take Photo (Camera)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => proofGalleryRef.current?.click()}
                    className="py-2.5 px-3 rounded-2xl border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'tl' ? 'Attach (Gallery)' : 'Upload (Gallery)'}</span>
                  </button>
                </div>

                <input
                  ref={proofCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    handleProofPhotoFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                  className="hidden"
                />
                <input
                  ref={proofGalleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handleProofPhotoFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                  className="hidden"
                />

                <LiveCameraModal
                  isOpen={isProofCameraOpen}
                  onClose={() => setIsProofCameraOpen(false)}
                  onCapture={handleProofCameraCapture}
                  onFallbackToFile={() => proofGalleryRef.current?.click()}
                />

                {proofPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {proofPhotos.map((pUrl, idx) => (
                      <div
                        key={idx}
                        onClick={() =>
                          setLightboxState({
                            photos: proofPhotos,
                            index: idx,
                            title: `#${formatTicketNumber(reportToResolve.ticketNumber)} • ${
                              language === 'tl' ? 'Proeba' : 'Proof'
                            }`,
                          })
                        }
                        className="relative aspect-video rounded-xl overflow-hidden border-2 border-emerald-500 shadow-sm cursor-pointer"
                      >
                        <ResolvedPhoto src={pUrl} alt="Proof thumbnail" className="w-full h-full" showExpandHint />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeProofPhoto(idx);
                          }}
                          className="absolute top-1 right-1 z-10 p-1 bg-red-600 text-white rounded-full shadow-md cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="pointer-events-none absolute bottom-0 inset-x-0 bg-emerald-900/80 text-white text-[9px] font-bold text-center py-0.5">
                          {language === 'tl' ? 'Proeba' : 'Proof'} #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'tl' ? 'Pangalan ng Kagawad:' : 'Official Name:'}
                </label>
                <input
                  type="text"
                  value={proofKagawadName}
                  onChange={(e) => setProofKagawadName(e.target.value)}
                  placeholder={
                    language === 'tl'
                      ? 'Hal. Kagawad Juan Dela Cruz'
                      : 'E.g., Official Juan Dela Cruz'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-slate-50 font-semibold"
                />
              </div>

              {proofError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold">
                  {proofError}
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="flex-1 py-3 px-4 rounded-2xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  {language === 'tl' ? 'Kanselahin' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingProof || (!isOutside && proofPhotos.length === 0) || (isOutside && !proofNotes.trim())}
                  onClick={handleConfirmResolveWithProof}
                  className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSubmittingProof || (!isOutside && proofPhotos.length === 0) || (isOutside && !proofNotes.trim())
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : isOutside
                      ? 'bg-purple-700 hover:bg-purple-800 text-white active:scale-98'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmittingProof
                      ? (language === 'tl' ? 'Ipinoproseso...' : 'Processing...')
                      : isOutside
                      ? (language === 'tl' ? 'Ipadala ang Mensahe sa Residente' : 'Send Message to Resident')
                      : (language === 'tl' ? 'I-save at Ipadala ang Proeba' : 'Save & Deliver Proof')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancellation Modal */}
      {showCancelModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900 mb-2">
              {language === 'tl' ? 'Kanselahin ang Concern?' : 'Cancel This Report?'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'tl' ? 'Pakilagay ang dahilan ng pagkansela ng ticket' : 'Please provide reason for cancelling ticket'} <strong>#{formatTicketNumber(selectedReport.ticketNumber)}</strong>:
            </p>
            <textarea
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder={language === 'tl' ? 'Hal. Naitapon na ng residente o duplicate ticket' : 'E.g., Already cleared by resident or duplicate ticket'}
              className="w-full p-3 rounded-2xl border border-slate-300 text-xs bg-slate-50 mb-4 focus:ring-2 focus:ring-red-500 focus:outline-hidden"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {language === 'tl' ? 'Bumalik' : 'Back'}
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs cursor-pointer"
              >
                {language === 'tl' ? 'I-confirm' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERMANENT DELETE CONCERN MODAL (Spam / Fake Ticket Removal) */}
      {showDeleteModal && reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {language === 'tl' ? 'Burahin nang Permanente ang Concern?' : 'Permanently Delete This Concern?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {language === 'tl'
                  ? `Sigurado ka bang nais mong burahin ang ticket #${formatTicketNumber(reportToDelete.ticketNumber)} sa ${reportToDelete.purok}?`
                  : `Are you sure you want to delete ticket #${formatTicketNumber(reportToDelete.ticketNumber)} in ${reportToDelete.purok}?`}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-[11px] text-red-800 text-left font-medium">
              {language === 'tl'
                ? '* Paraan ito para sa mga spam sends, bastos na litrato, o maling ulat. Mawawala ito nang lubusan sa active queue, logbook, at storage ng server.'
                : '* Use this to purge spam submissions, invalid photos, or test records. It will be completely removed from active queue, logbook, and server storage.'}
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setReportToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer"
              >
                {language === 'tl' ? 'Oo, Burahin' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Photo Lightbox Viewer */}
      <PhotoLightboxModal
        isOpen={Boolean(lightboxState)}
        photos={lightboxState?.photos || []}
        initialIndex={lightboxState?.index || 0}
        title={lightboxState?.title}
        onClose={() => setLightboxState(null)}
      />
    </div>
  );
};
