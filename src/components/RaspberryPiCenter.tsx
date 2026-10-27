import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Power,
  RotateCcw,
  RefreshCw,
  Check,
  ExternalLink,
  Unlink,
  ClipboardPaste,
  Database,
  Cpu,
  X,
  Link2,
} from 'lucide-react';
import { PiStatus } from '../types';
import { soundAlert } from '../utils/audioAlarm';
import { useLanguage } from '../context/LanguageContext';
import {
  normalizeClientPiUrl,
  getStoredPiEndpoint,
  setStoredPiEndpoint,
  pingAndConnectPiServer,
  getUnifiedPiStatus,
  syncUnifiedPiServer,
  disconnectUnifiedPiServer,
  sendUnifiedPiPowerAction,
  buildShareablePortalUrl,
} from '../utils/piBridge';

interface RaspberryPiCenterProps {
  activeStorageMode: 'pi' | 'cloud';
  onToggleStorageMode: () => void;
}

export const RaspberryPiCenter: React.FC<RaspberryPiCenterProps> = () => {
  const { language, t } = useLanguage();
  const [piEndpoint, setPiEndpoint] = useState<string>(() => getStoredPiEndpoint());
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);

  const [piData, setPiData] = useState<PiStatus | null>(null);
  const [, setLoading] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Ping & Sync Testing State
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [pingFeedback, setPingFeedback] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  // Safe Power Controls
  const [isSendingPowerAction, setIsSendingPowerAction] = useState(false);
  const [powerActionFeedback, setPowerActionFeedback] = useState<string | null>(null);
  const [confirmShutdownModal, setConfirmShutdownModal] = useState(false);
  const [confirmDisconnectModal, setConfirmDisconnectModal] = useState(false);
  const [healthInspectorOpen, setHealthInspectorOpen] = useState(false);

  const fetchPiStatus = useCallback(
    async (overrideEndpoint?: string) => {
      setLoading(true);
      try {
        const candidate =
          overrideEndpoint !== undefined ? overrideEndpoint : getStoredPiEndpoint();
        const data = await getUnifiedPiStatus(candidate || undefined, language);
        setPiData(data);

        if (!piEndpoint.trim() && data.configuredUrl) {
          setPiEndpoint(data.configuredUrl);
          setStoredPiEndpoint(data.configuredUrl);
        }
      } catch (e) {
        console.error('Error fetching Pi status:', e);
        setPiData((prev) => (prev ? { ...prev, online: false } : null));
      } finally {
        setLoading(false);
      }
    },
    [piEndpoint, language]
  );

  useEffect(() => {
    fetchPiStatus();
    const interval = setInterval(() => fetchPiStatus(), 6000);
    return () => clearInterval(interval);
  }, [fetchPiStatus]);

  const handleTestPingAndConnect = async () => {
    if (!piEndpoint.trim()) {
      setPingFeedback({
        success: false,
        message:
          language === 'tl'
            ? 'Pakilagay muna ang Cloud Server Link ng iyong Raspberry Pi bago mag-konekta.'
            : 'Please enter your Raspberry Pi Cloud Server Link before connecting.',
      });
      return;
    }

    setIsTestingPing(true);
    setPingFeedback(null);

    try {
      const result = await pingAndConnectPiServer(piEndpoint, language);
      if (result.normalizedUrl) {
        setPiEndpoint(result.normalizedUrl);
      }

      if (result.success && result.online) {
        soundAlert.playChime();
        setPingFeedback({
          success: true,
          latencyMs: result.latencyMs,
          message: result.message,
        });
        setSaveToast(language === 'tl' ? 'Konektado at Nai-save!' : 'Connected & Saved!');
        await fetchPiStatus(result.normalizedUrl);
        setTimeout(() => setSaveToast(null), 3000);
      } else {
        setPingFeedback({
          success: false,
          message: result.message,
        });
        if (result.normalizedUrl) {
          await fetchPiStatus(result.normalizedUrl);
        }
      }
    } catch {
      setPingFeedback({
        success: false,
        message:
          language === 'tl'
            ? 'Hindi maabot ang Cloud Server Link. Pakisuri kung online ang Raspberry Pi server.'
            : 'Cannot reach the Cloud Server Link. Please verify that the Raspberry Pi server is online.',
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleManualSyncNow = async () => {
    const cleanUrl = normalizeClientPiUrl(piEndpoint || piData?.configuredUrl || '');
    if (!cleanUrl) return;
    setIsSyncingNow(true);
    setPingFeedback(null);
    try {
      const syncResult = await syncUnifiedPiServer(cleanUrl, language);
      if (syncResult.success) {
        soundAlert.playChime();
      }
      setPingFeedback({
        success: syncResult.success,
        message: syncResult.message,
      });
      await fetchPiStatus(cleanUrl);
    } catch {
      setPingFeedback({
        success: false,
        message: language === 'tl' ? 'Hindi ma-sync sa ngayon.' : 'Could not sync right now.',
      });
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleDisconnectAndRemove = async () => {
    try {
      setPiEndpoint('');
      setPingFeedback(null);
      await disconnectUnifiedPiServer(language);
      soundAlert.playChime();
      setSaveToast(
        language === 'tl'
          ? 'Nadiskonekta at natanggal ang server link!'
          : 'Disconnected and removed server link!'
      );
      setConfirmDisconnectModal(false);
      await fetchPiStatus('');
      setTimeout(() => setSaveToast(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setPiEndpoint(normalizeClientPiUrl(text));
          setSaveToast(language === 'tl' ? 'Na-paste ang link!' : 'Link pasted!');
          setTimeout(() => setSaveToast(null), 2000);
          return;
        }
      }
      setSaveToast(
        language === 'tl'
          ? 'Paki-paste nang manu-mano sa kahon'
          : 'Please paste manually into the box'
      );
      setTimeout(() => setSaveToast(null), 2500);
    } catch {
      setSaveToast(
        language === 'tl'
          ? 'Paki-paste nang manu-mano sa kahon'
          : 'Please paste manually into the box'
      );
      setTimeout(() => setSaveToast(null), 2500);
    }
  };

  const handleSystemPowerAction = async (action: 'shutdown' | 'reboot') => {
    setIsSendingPowerAction(true);
    setPowerActionFeedback(null);
    const cleanUrl = normalizeClientPiUrl(piEndpoint || piData?.configuredUrl || '');

    try {
      const result = await sendUnifiedPiPowerAction(action, cleanUrl, language);
      if (result.success) {
        soundAlert.playChime();
      }
      setPowerActionFeedback(result.message);
      if (action === 'shutdown' && result.success) {
        setConfirmShutdownModal(false);
        setPiData((prev) => (prev ? { ...prev, online: false } : null));
      }
      setTimeout(() => fetchPiStatus(), 3000);
    } catch {
      setPowerActionFeedback(
        language === 'tl' ? 'Nagkaroon ng aberya sa koneksyon.' : 'Connection error occurred.'
      );
    } finally {
      setIsSendingPowerAction(false);
    }
  };

  const handleCopyResidentPortalLink = () => {
    const shareUrl = buildShareablePortalUrl(piEndpoint || piData?.configuredUrl || '');
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedPortalLink(true);
    soundAlert.playChime();
    setTimeout(() => setCopiedPortalLink(false), 2500);
  };

  const activeUrl = normalizeClientPiUrl(getStoredPiEndpoint() || piData?.configuredUrl || '');
  const isConfigured = Boolean(activeUrl);
  const isOnline = isConfigured && Boolean(piData?.online);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Server className="w-5 h-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              {t.piCenter.centerTitle}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t.piCenter.centerSubtitle}</p>
        </div>

        {/* Real-time Status Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isConfigured ? (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              {language === 'tl' ? 'WALANG NAKA-SET NA LINK' : 'NO SERVER LINK SET'}
            </span>
          ) : isOnline ? (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {t.piCenter.piOnline} ({piData?.latencyMs || 25}ms)
            </span>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              {t.piCenter.piOffline}
            </span>
          )}
        </div>
      </div>

      {/* Cloud Server Link Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Server className="w-4 h-4 text-purple-700" />
            <span>
              {language === 'tl'
                ? 'Link ng Raspberry Pi Cloud Server:'
                : 'Raspberry Pi Cloud Server Link:'}
            </span>
          </label>
          <div className="flex items-center gap-2">
            {saveToast && (
              <span className="text-emerald-700 font-extrabold text-xs animate-in fade-in">
                ✓ {saveToast}
              </span>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 underline cursor-pointer"
              title={language === 'tl' ? 'I-paste mula sa Clipboard' : 'Paste from Clipboard'}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{language === 'tl' ? 'I-paste' : 'Paste'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={piEndpoint}
              onChange={(e) => {
                setPiEndpoint(e.target.value);
                setPingFeedback(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTestPingAndConnect();
                }
              }}
              placeholder={
                language === 'tl'
                  ? 'Ilagay ang Cloud Server Link (hal. https://iyong-domain.ngrok.dev o https://xxxx.trycloudflare.com)'
                  : 'Enter Cloud Server Link (e.g. https://your-domain.ngrok.dev or https://xxxx.trycloudflare.com)'
              }
              className="w-full px-4 py-3 pr-16 rounded-2xl border border-slate-300 bg-white text-xs sm:text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            {piEndpoint && (
              <button
                type="button"
                onClick={() => setPiEndpoint('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                title={language === 'tl' ? 'Linisin ang input' : 'Clear input'}
              >
                {language === 'tl' ? 'Linisin' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons: Connect, Force Sync, and Disconnect */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <button
            onClick={handleTestPingAndConnect}
            disabled={isTestingPing || !piEndpoint.trim()}
            className="flex-1 py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 disabled:opacity-40"
          >
            {isTestingPing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>
              {isTestingPing
                ? language === 'tl'
                  ? 'Sinusuri at Kumokonekta...'
                  : 'Testing & Connecting...'
                : language === 'tl'
                ? 'I-konekta at I-save ang Link'
                : 'Connect & Save Link'}
            </span>
          </button>

          {isOnline && (
            <button
              onClick={handleManualSyncNow}
              disabled={isSyncingNow}
              type="button"
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-md disabled:opacity-50"
            >
              <Database className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
              <span>
                {isSyncingNow
                  ? language === 'tl'
                    ? 'Nagsi-sync...'
                    : 'Syncing...'
                  : language === 'tl'
                  ? 'I-Sync sa Pi Ngayon'
                  : 'Sync to Pi Now'}
              </span>
            </button>
          )}

          {isConfigured && (
            <button
              onClick={() => setConfirmDisconnectModal(true)}
              type="button"
              className="py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 shadow-xs"
            >
              <Unlink className="w-4 h-4 text-rose-600" />
              <span>
                {language === 'tl' ? 'Idiskonekta / Tanggalin' : 'Disconnect / Remove'}
              </span>
            </button>
          )}
        </div>

        {/* Ping and Connection Feedback */}
        {pingFeedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-in fade-in ${
              pingFeedback.success
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                : 'bg-rose-50 text-rose-900 border border-rose-300'
            }`}
          >
            {pingFeedback.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{pingFeedback.message}</span>
          </div>
        )}

        {/* Active Connected Link Inspector */}
        {isConfigured && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold text-slate-700 shrink-0">
                {language === 'tl' ? 'Aktibong Link:' : 'Active Link:'}
              </span>
              <code className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-mono text-[11px] text-purple-900 truncate max-w-xs sm:max-w-md">
                {activeUrl}
              </code>
            </div>
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleCopyResidentPortalLink}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                title={
                  language === 'tl'
                    ? 'Kopyahin ang link ng website na naka-bind na sa Pi server para sa ibang device'
                    : 'Copy website link pre-bound to this Pi server for other devices'
                }
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>
                  {copiedPortalLink
                    ? language === 'tl'
                      ? 'Nakopya ang Bound Link!'
                      : 'Bound Link Copied!'
                    : language === 'tl'
                    ? 'Kopyahin ang Bound Portal Link'
                    : 'Copy Bound Portal Link'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHealthInspectorOpen(true)}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline flex items-center gap-1 cursor-pointer"
              >
                <span>
                  {language === 'tl'
                    ? 'Suriin ang Live Telemetry (/api/health)'
                    : 'Inspect Live Telemetry (/api/health)'}
                </span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diagnostic Banner when Configured Link is Offline */}
      {isConfigured && !isOnline && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-950">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block font-black text-rose-900">
              {language === 'tl'
                ? 'Kasalukuyang Offline ang Naka-link na Raspberry Pi Cloud Server'
                : 'Linked Raspberry Pi Cloud Server Is Currently Offline'}
            </strong>
            <p className="leading-relaxed text-rose-800 text-[11px]">
              {piData?.errorDetail ||
                (language === 'tl'
                  ? `Walang tugon mula sa ${activeUrl}. Pakisuri kung naka-bukas ang iyong Cloud Server Link.`
                  : `No response from ${activeUrl}. Please verify that your Cloud Server Link is online.`)}
            </p>
          </div>
        </div>
      )}

      {/* Hardware & Hard Drive Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'tl' ? 'Katayuan ng Pi' : 'Pi Status'}
          </span>
          <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Online ({piData?.connectionMethod || 'Tunnel'})</span>
              </>
            ) : isConfigured ? (
              <>
                <WifiOff className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{language === 'tl' ? 'Naka-off' : 'Offline'}</span>
              </>
            ) : (
              <span className="text-slate-500">
                {language === 'tl' ? 'Hindi Pa Naka-set' : 'Not Configured'}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {isOnline
              ? `Latency: ${piData?.latencyMs || 25}ms`
              : language === 'tl'
              ? 'Walang koneksyon'
              : 'No connection'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            CPU Temp &amp; RAM
          </span>
          <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
            <span>{isOnline ? piData?.cpu_temp || '42.0°C' : 'N/A'}</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {isOnline ? `RAM: ${piData?.ram || 'Active'}` : 'Standby'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'tl' ? 'Hard Drive Folder' : 'Storage Folder'}
          </span>
          <div
            className="text-xs font-mono font-bold text-slate-800 truncate"
            title={piData?.storage_folder}
          >
            {isOnline ? piData?.storage_folder || '/media/pi/.../RESEARCH TRASH' : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500">
            {isOnline
              ? language === 'tl'
                ? `${piData?.activeTicketsCount ?? 0} ulat • ${piData?.savedLogbooksCount ?? 0} logbook`
                : `${piData?.activeTicketsCount ?? 0} reports • ${piData?.savedLogbooksCount ?? 0} logbooks`
              : language === 'tl'
              ? 'Hindi naka-link'
              : 'Not linked'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'tl' ? 'Laki sa Hard Drive' : 'Hard Drive Size'}
          </span>
          <div className="text-sm font-black text-emerald-700 font-mono">
            {isOnline ? `${piData?.pulseFolderMb ?? 0} MB` : '0 MB'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {isOnline ? `${piData?.pulseFolderKb ?? 0} KB` : 'N/A'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'tl' ? 'Bukas na Espasyo' : 'Free Disk Space'}
          </span>
          <div className="text-sm font-black text-slate-800 font-mono">
            {isOnline ? piData?.disk_free || '480 GB' : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {isOnline ? `Used: ${piData?.disk_used || '20 GB'} / ${piData?.disk_total || '500 GB'}` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Safe Power Controls */}
      {isConfigured && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Power className="w-5 h-5 text-amber-400" />
              <h4 className="font-black text-sm">
                {language === 'tl'
                  ? 'Ligtas na Power Controls ng Raspberry Pi'
                  : 'Safe Raspberry Pi Power Controls'}
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              {language === 'tl'
                ? 'Proteksyon laban sa pagkasira ng SD Card / Hard Drive'
                : 'SD Card & Hard Drive Protection'}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {language === 'tl'
              ? 'Bago hugutin ang saksakan ng Raspberry Pi, pindutin muna ang Safe Shutdown upang mai-flush ang disk memory at maiwasan ang pagkasira.'
              : 'Before unplugging the Raspberry Pi, click Safe Shutdown to flush disk buffers and prevent memory corruption.'}
          </p>

          {powerActionFeedback && (
            <div className="p-3 bg-slate-800 text-amber-300 rounded-xl text-xs font-bold border border-slate-700">
              {powerActionFeedback}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={() => setConfirmShutdownModal(true)}
              disabled={!isOnline || isSendingPowerAction}
              className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Power className="w-4 h-4" />
              <span>
                {language === 'tl'
                  ? 'Ligtas na I-Shutdown ang Pi (Bago Hugutin)'
                  : 'Safely Shutdown Pi (Before Unplugging)'}
              </span>
            </button>
            <button
              onClick={() => handleSystemPowerAction('reboot')}
              disabled={!isOnline || isSendingPowerAction}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{language === 'tl' ? 'I-Reboot ang Pi' : 'Reboot Pi Server'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Disconnecting Pi Link */}
      {confirmDisconnectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 rounded-2xl bg-rose-100">
                <Unlink className="w-6 h-6 text-rose-600" />
              </span>
              <div>
                <h4 className="font-black text-base text-slate-900">
                  {language === 'tl' ? 'Tanggalin ang Server Link?' : 'Disconnect Server Link?'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'tl'
                    ? 'Ididiskonekta ang Pi server mula sa portal'
                    : 'Disconnects Pi server from portal'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'tl'
                ? 'Mabubura ang nakatalang server URL sa iyong browser at server. Maaari kang mag-lagay muli ng bagong link anumang oras.'
                : 'The stored server URL will be cleared from your configuration. You can enter a new link anytime.'}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDisconnectModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                onClick={handleDisconnectAndRemove}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-black text-xs text-white shadow-xs cursor-pointer"
              >
                {language === 'tl' ? 'Oo, Tanggalin' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Shutdown Confirmation Modal */}
      {confirmShutdownModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 rounded-2xl bg-rose-100">
                <Power className="w-6 h-6 text-rose-600" />
              </span>
              <div>
                <h4 className="font-black text-base text-slate-900">
                  {language === 'tl' ? 'I-shutdown ang Raspberry Pi?' : 'Shutdown Raspberry Pi?'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'tl'
                    ? 'I-flush ang disk at patayin ang server nang ligtas'
                    : 'Flush disk memory and safely shut down'}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'tl'
                ? 'Pagkapindot ng kumpirmasyon, maghihintay ka ng 5 segundo hanggang huminto o mamamatay ang berdeng ilaw (ACT LED) sa Pi bago ligtas na hugutin ang saksakan.'
                : 'After confirming, wait 5 seconds until the green activity LED stops blinking before safely unplugging power.'}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmShutdownModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                onClick={() => handleSystemPowerAction('shutdown')}
                disabled={isSendingPowerAction}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-black text-xs text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSendingPowerAction
                  ? language === 'tl'
                    ? 'Nagpapadala...'
                    : 'Sending...'
                  : language === 'tl'
                  ? 'Oo, I-shutdown Na'
                  : 'Yes, Shutdown Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live /api/health JSON Telemetry Inspector Modal */}
      {healthInspectorOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-950 text-slate-100 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-sm text-white">
                  Raspberry Pi Live Telemetry (/api/pi-status)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHealthInspectorOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 max-h-80 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(piData, null, 2)}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => fetchPiStatus()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'tl' ? 'I-refresh' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => setHealthInspectorOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                {language === 'tl' ? 'Isara' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
