import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Clock,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Settings,
  ShieldCheck,
  Radio,
  ListOrdered,
  BellRing,
  RotateCcw,
  Wifi,
  WifiOff,
  Search,
  Unlink,
} from 'lucide-react';
import { soundAlert } from '../utils/audioAlarm';
import { TelegramBotStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  getUnifiedTelegramStatus,
  detectUnifiedTelegramChat,
  configureUnifiedTelegram,
  sendUnifiedTelegramTest,
  disconnectUnifiedTelegram,
} from '../utils/piBridge';

interface TelegramCenterProps {
  pendingCount: number;
}

function getPhilippineTimeNow(): string {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString();
  }
}

export const TelegramCenter: React.FC<TelegramCenterProps> = ({ pendingCount: _pendingCount }) => {
  const { language, t } = useLanguage();
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('pulse_telegram_setup_completed') === 'true' ||
        localStorage.getItem('trash_telegram_setup_completed') === 'true'
      );
    } catch {
      return false;
    }
  });

  const [botToken, setBotToken] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('pulse_telegram_bot_token') ||
        localStorage.getItem('trash_telegram_bot_token') ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [chatId, setChatId] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('pulse_telegram_chat_id') ||
        localStorage.getItem('trash_telegram_chat_id') ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [botLiveStatus, setBotLiveStatus] = useState<TelegramBotStatus>({
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

  const [philippineClock, setPhilippineClock] = useState<string>(() => getPhilippineTimeNow());
  const [isSending, setIsSending] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isDetectingChat, setIsDetectingChat] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [confirmDisconnectBot, setConfirmDisconnectBot] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [detectedChats, setDetectedChats] = useState<
    { id: string; title: string; type: string }[]
  >([]);
  const [broadcastLog, setBroadcastLog] = useState<string[]>(() => [
    `[${getPhilippineTimeNow()} PST] ${
      language === 'tl'
        ? 'Sistema: Handa para sa mga bagong concern at tapos na ulat sa Barangay 40 & 41'
        : 'System: Ready for new reports and resolved tickets in Barangay 40 & 41'
    }`,
  ]);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  useEffect(() => {
    const ticker = setInterval(() => {
      setPhilippineClock(getPhilippineTimeNow());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const syncStatus = useCallback(async () => {
    try {
      const savedToken = botToken || localStorage.getItem('pulse_telegram_bot_token') || '';
      const savedChat = chatId || localStorage.getItem('pulse_telegram_chat_id') || '';
      const data = await getUnifiedTelegramStatus(language, savedToken, savedChat);
      setBotLiveStatus(data);

      if (data.botConfigured && data.setupComplete && !isSetupComplete && !savedToken) {
        setIsSetupComplete(true);
      }
      if (data.chatId && !chatId) {
        setChatId(data.chatId);
      }
      if (Array.isArray(data.broadcastHistory) && data.broadcastHistory.length > 0) {
        setBroadcastLog(data.broadcastHistory);
      }
    } catch {
      setBotLiveStatus((prev) => ({ ...prev, online: false, status: 'OFFLINE' }));
    }
  }, [botToken, chatId, isSetupComplete, language]);

  useEffect(() => {
    syncStatus();
    const interval = setInterval(syncStatus, 8000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  const handleAutoDetectChatId = async () => {
    const cleanToken = botToken.trim();
    if (!cleanToken) {
      setFeedbackBanner({
        ok: false,
        text:
          language === 'tl'
            ? 'Pakilagay muna ang iyong Telegram Bot Token sa kaliwa bago mag-Auto-Detect.'
            : 'Please paste your Telegram Bot Token first before clicking Auto-Detect.',
      });
      return;
    }

    setIsDetectingChat(true);
    setFeedbackBanner(null);
    try {
      const data = await detectUnifiedTelegramChat(cleanToken, language);
      if (data.success && data.chatId) {
        setChatId(data.chatId);
        if (Array.isArray(data.chats)) setDetectedChats(data.chats);
        soundAlert.playChime();
        setFeedbackBanner({
          ok: true,
          text:
            language === 'tl'
              ? `Nahanap ang Chat ID: ${data.chatId} (${data.chatTitle})! Pindutin na ang Save sa ibaba.`
              : `Detected Chat ID: ${data.chatId} (${data.chatTitle})! Click Save below.`,
        });
      } else {
        setFeedbackBanner({
          ok: false,
          text:
            data.error ||
            (language === 'tl'
              ? 'Buksan muna ang iyong bot sa Telegram at i-tap ang /start, saka ulitin ang Auto-Detect.'
              : 'Open your bot in Telegram and send /start first, then click Auto-Detect again.'),
        });
      }
    } catch {
      setFeedbackBanner({
        ok: false,
        text:
          language === 'tl'
            ? 'Hindi makakonekta sa Telegram API.'
            : 'Could not reach Telegram API.',
      });
    } finally {
      setIsDetectingChat(false);
    }
  };

  const handleTestAlert = async (overrideToken?: string, overrideChat?: string) => {
    setIsSending(true);
    setFeedbackBanner(null);
    try {
      const candidateToken = (overrideToken ?? botToken).trim();
      const candidateChat = (overrideChat ?? chatId).trim();
      const data = await sendUnifiedTelegramTest(candidateToken, candidateChat, language);
      if (data.delivered) {
        soundAlert.playChime();
        setFeedbackBanner({
          ok: true,
          text:
            language === 'tl'
              ? `✓ Matagumpay na naipadala ang Test Alert sa Telegram! (${data.timestamp})`
              : `✓ Test Alert successfully delivered to Telegram! (${data.timestamp})`,
        });
        const entry = `[${data.timestamp}] ✓ Delivered: ${data.broadcast.replace(/\n/g, ' • ')}`;
        setBroadcastLog((prev) => [entry, ...prev.slice(0, 29)]);
      } else {
        setFeedbackBanner({
          ok: false,
          text:
            data.message ||
            (language === 'tl'
              ? 'Hindi naipadala sa Telegram. Suriin kung tama ang Bot Token at kung nag-send ka na ng /start sa bot.'
              : 'Failed to deliver to Telegram. Verify Bot Token and ensure you sent /start to the bot.'),
        });
      }
      await syncStatus();
    } catch {
      setFeedbackBanner({
        ok: false,
        text: language === 'tl' ? 'Nagkaroon ng network error.' : 'Network error occurred.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRestartBot = async () => {
    setIsRestarting(true);
    setFeedbackBanner(null);
    try {
      const data = await getUnifiedTelegramStatus(language, botToken.trim(), chatId.trim());
      setFeedbackBanner({
        ok: Boolean(data.online),
        text: data.online
          ? language === 'tl'
            ? `Na-restart at aktibo na ang Telegram Bot ${data.botUsername ? `(@${data.botUsername})` : ''}!`
            : `Telegram Bot ${data.botUsername ? `(@${data.botUsername})` : ''} restarted and active!`
          : language === 'tl'
          ? 'Hindi ma-verify ang Telegram Bot Token.'
          : 'Could not verify Telegram Bot Token.',
      });
      if (data.online) soundAlert.playChime();
      await syncStatus();
    } catch {
      setFeedbackBanner({
        ok: false,
        text:
          language === 'tl'
            ? 'Hindi ma-restart ang bot watchdog.'
            : 'Could not restart bot watchdog.',
      });
    } finally {
      setIsRestarting(false);
    }
  };

  const handleSaveAndCompleteSetup = async () => {
    const cleanToken = botToken.trim();
    const cleanChat = chatId.trim();
    if (!cleanToken || !cleanChat) {
      setFeedbackBanner({
        ok: false,
        text:
          language === 'tl'
            ? 'Pakilagay ang parehong Bot Token at Chat ID (maaaring gamitin ang Auto-Detect Chat ID).'
            : 'Please provide both Bot Token and Chat ID (you can use Auto-Detect Chat ID).',
      });
      return;
    }

    setIsSavingConfig(true);
    setFeedbackBanner(null);
    try {
      const data = await configureUnifiedTelegram(cleanToken, cleanChat, language);

      if (data.online) {
        localStorage.setItem('pulse_telegram_setup_completed', 'true');
        localStorage.setItem('pulse_telegram_bot_token', cleanToken);
        localStorage.setItem('pulse_telegram_chat_id', cleanChat);
        setIsSetupComplete(true);
        soundAlert.playChime();
        await handleTestAlert(cleanToken, cleanChat);
      } else {
        setFeedbackBanner({
          ok: false,
          text:
            data.error ||
            data.message ||
            (language === 'tl'
              ? 'Invalid ang Bot Token. Pakisuri ang kinopyang token mula kay @BotFather.'
              : 'Invalid Bot Token. Please check the token copied from @BotFather.'),
        });
      }
    } catch {
      setFeedbackBanner({
        ok: false,
        text: language === 'tl' ? 'Hindi ma-save sa server.' : 'Could not save configuration.',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    try {
      await disconnectUnifiedTelegram(language);
      localStorage.removeItem('pulse_telegram_setup_completed');
      localStorage.removeItem('pulse_telegram_bot_token');
      localStorage.removeItem('pulse_telegram_chat_id');
      localStorage.removeItem('trash_telegram_setup_completed');
      localStorage.removeItem('trash_telegram_bot_token');
      localStorage.removeItem('trash_telegram_chat_id');
      setBotToken('');
      setChatId('');
      setDetectedChats([]);
      setIsSetupComplete(false);
      setConfirmDisconnectBot(false);
      soundAlert.playChime();
      setFeedbackBanner({
        ok: true,
        text:
          language === 'tl'
            ? 'Nadiskonekta at nalinis na ang Telegram Bot. Maaari kang mag-set ng panibagong bot anumang oras.'
            : 'Telegram Bot disconnected and cleared. You can configure a new bot anytime.',
      });
      await syncStatus();
    } catch {}
  };

  const copyText = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedStep(label);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-100 text-sky-600">
              <Send className="w-5 h-5" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">
              {t.telegram.centerTitle}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t.telegram.centerSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>
              PH Time: <strong className="font-mono text-emerald-950">{philippineClock}</strong>
            </span>
          </div>
          {isSetupComplete && botLiveStatus.online ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t.telegram.botConfigured}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              {t.telegram.botNotConfigured}
            </span>
          )}
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 animate-in fade-in ${
            feedbackBanner.ok
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {feedbackBanner.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{feedbackBanner.text}</span>
        </div>
      )}

      {!isSetupComplete ? (
        <div className="space-y-5 animate-in fade-in">
          <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-3">
            <div className="flex items-center gap-2 text-sky-950 font-black text-sm">
              <HelpCircle className="w-4 h-4 text-sky-600" />
              <span>
                {language === 'tl'
                  ? 'GABAY SA PAG-CONNECT NG TELEGRAM BOT (Step-by-Step):'
                  : 'TELEGRAM BOT CONNECTION GUIDE (Step-by-Step):'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {language === 'tl'
                ? 'Isang beses mo lamang itong gagawin. Permanenteng mase-save ito sa server para awtomatikong mag-alert sa bawat bagong ulat.'
                : 'You only need to do this once. Credentials are persisted on the server for real-time report alerts.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-700">
              <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>
                    {language === 'tl'
                      ? 'Gumawa ng Bot sa @BotFather'
                      : 'Create Bot on @BotFather'}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  {language === 'tl'
                    ? 'Buksan ang Telegram app, i-search ang @BotFather, at i-type:'
                    : 'Open Telegram app, search for @BotFather, and type:'}
                </p>
                <div className="bg-slate-100 p-2 rounded-lg font-mono text-[11px] flex items-center justify-between">
                  <code>/newbot</code>
                  <button
                    onClick={() => copyText('/newbot', 'newbot')}
                    className="text-sky-600 font-bold cursor-pointer"
                  >
                    {copiedStep === 'newbot' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                    2
                  </span>
                  <span>
                    {language === 'tl'
                      ? 'I-paste ang Bot Token at /start'
                      : 'Paste Token & Send /start'}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  {language === 'tl'
                    ? 'I-paste ang Bot Token sa ibaba, at buksan ang bagong bot mo sa Telegram saka pindutin ang /start.'
                    : 'Paste the Bot Token below, then open your new bot in Telegram and tap /start.'}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-sky-100 shadow-2xs space-y-1.5">
                <div className="font-extrabold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                    3
                  </span>
                  <span>Auto-Detect Chat ID</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  {language === 'tl'
                    ? 'Pindutin ang "Auto-Detect Chat ID" sa ibaba (o kunin sa @userinfobot) at i-click ang Save!'
                    : 'Click "Auto-Detect Chat ID" below (or get it via @userinfobot) and click Save!'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="font-black text-sm text-slate-900">
              {language === 'tl'
                ? 'Ilagay ang Telegram Bot Credentials:'
                : 'Enter Telegram Bot Credentials:'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telegram Bot Token:
                </label>
                <input
                  type="text"
                  placeholder={
                    language === 'tl'
                      ? 'Hal. 7123456789:AAE-xxxxxxx'
                      : 'e.g. 7123456789:AAE-xxxxxxx'
                  }
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'tl'
                      ? 'Kagawad / Group Chat ID:'
                      : 'Official / Group Chat ID:'}
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoDetectChatId}
                    disabled={isDetectingChat}
                    className="text-[11px] font-black text-sky-700 hover:text-sky-900 flex items-center gap-1 underline cursor-pointer disabled:opacity-50"
                  >
                    <Search className="w-3 h-3" />
                    <span>
                      {isDetectingChat
                        ? language === 'tl'
                          ? 'Hinahanap...'
                          : 'Detecting...'
                        : 'Auto-Detect Chat ID'}
                    </span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={
                    language === 'tl'
                      ? 'Hal. 987654321 o -100123456789'
                      : 'e.g. 987654321 or -100123456789'
                  }
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white focus:ring-2 focus:ring-sky-500"
                />
                {detectedChats.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {detectedChats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setChatId(c.id)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer ${
                          chatId === c.id
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {c.title} ({c.id})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={isSavingConfig}
              onClick={handleSaveAndCompleteSetup}
              className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-sm shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>
                {isSavingConfig
                  ? language === 'tl'
                    ? 'Bine-verify at Sine-save...'
                    : 'Verifying & Saving...'
                  : language === 'tl'
                  ? 'I-verify, I-save, at Magpadala ng Test Alert'
                  : 'Verify, Save & Send Test Alert'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in">
          {/* Main Status Header Card */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${
              botLiveStatus.online
                ? 'bg-gradient-to-r from-sky-950 to-slate-900 border-sky-800'
                : botLiveStatus.status === 'RECONNECTING'
                ? 'bg-gradient-to-r from-amber-950 to-slate-900 border-amber-800'
                : 'bg-gradient-to-r from-slate-950 to-rose-950 border-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                  botLiveStatus.online
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                    : botLiveStatus.status === 'RECONNECTING'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                {botLiveStatus.online ? (
                  <Wifi className="w-6 h-6 text-emerald-400 animate-pulse" />
                ) : botLiveStatus.status === 'RECONNECTING' ? (
                  <RotateCcw className="w-6 h-6 text-amber-400 animate-spin" />
                ) : (
                  <WifiOff className="w-6 h-6 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm sm:text-base text-white">
                    Barangay 40 &amp; 41 Telegram Bot
                  </h4>
                  {botLiveStatus.online ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      ONLINE {botLiveStatus.botUsername ? `(@${botLiveStatus.botUsername})` : ''}
                    </span>
                  ) : botLiveStatus.status === 'RECONNECTING' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/30 text-amber-200 border border-amber-400/50 flex items-center gap-1.5">
                      <RotateCcw className="w-2.5 h-2.5 animate-spin" />
                      {language === 'tl' ? 'NAG-A-AUTORESTART...' : 'AUTORESTARTING...'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">
                      OFFLINE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Chat ID:{' '}
                  <span className="font-mono text-sky-300">
                    {botLiveStatus.chatId || chatId || 'Configured'}
                  </span>{' '}
                  •{' '}
                  {language === 'tl'
                    ? 'Proteksyon sa Auto-Restart:'
                    : 'Auto-Restart Protection:'}{' '}
                  <strong className="text-emerald-400">
                    {language === 'tl' ? 'Aktibo 24/7' : 'Active 24/7'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRestartBot}
                disabled={isRestarting}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                <span>
                  {isRestarting
                    ? language === 'tl'
                      ? 'Nagre-restart...'
                      : 'Restarting...'
                    : language === 'tl'
                    ? 'I-restart ang Bot'
                    : 'Restart Bot'}
                </span>
              </button>

              <button
                onClick={() => handleTestAlert()}
                disabled={isSending}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSending
                    ? language === 'tl'
                      ? 'Nagpapadala...'
                      : 'Sending...'
                    : language === 'tl'
                    ? 'Mag-send ng Test Alert'
                    : 'Send Test Alert'}
                </span>
              </button>
              <button
                onClick={() => setIsSetupComplete(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                title={
                  language === 'tl'
                    ? 'I-reconfigure ang Token o Chat ID'
                    : 'Reconfigure Token or Chat ID'
                }
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmDisconnectBot(true)}
                className="p-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs font-bold cursor-pointer"
                title={
                  language === 'tl' ? 'Idiskonekta ang Telegram Bot' : 'Disconnect Telegram Bot'
                }
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Watchdog Status Bar */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-700 font-medium">
                <strong>
                  {language === 'tl'
                    ? 'Awtomatikong Server Watchdog:'
                    : 'Automatic Server Watchdog:'}
                </strong>{' '}
                {language === 'tl'
                  ? 'Naka-save sa server ang bot credentials kaya kahit naka-sara ang browser ng Kagawad, darating pa rin ang alert sa phone.'
                  : 'Bot credentials are saved on the server so alerts arrive on Barangay Official phones even when no portal browser is open.'}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 shrink-0">
              <span>
                Auto-Restarts: <strong>{botLiveStatus.autoRestartCount || 0}</strong>
              </span>
              <span>•</span>
              <span>
                {language === 'tl' ? 'Huling Check:' : 'Last Check:'}{' '}
                <strong>
                  {botLiveStatus.lastCheckedAt
                    ? botLiveStatus.lastCheckedAt.split('(')[0]
                    : language === 'tl'
                    ? 'Aktibo'
                    : 'Active'}
                </strong>
              </span>
            </div>
          </div>

          {/* 2-Way Flow Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-sky-900 text-sm">
                <BellRing className="w-4 h-4 text-sky-600" />
                <span>
                  {language === 'tl'
                    ? '1. Kapag May Bagong Concern Report'
                    : '1. When New Concern Report Is Filed'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {language === 'tl' ? (
                  <>
                    Mag-aalarm sa Telegram bot ang buong detalye (ticket, address, Google Maps link,
                    dami ng litrato) at{' '}
                    <strong>
                      kasunod na isesend ang listahan ng lahat ng hindi pa natatapos na active
                      concerns
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    The Telegram bot alerts with full details (ticket, address, Google Maps link,
                    photo count) and{' '}
                    <strong>
                      subsequently sends the full list of all remaining active concerns
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-emerald-900 text-sm">
                <ListOrdered className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'tl'
                    ? '2. Kapag May Natapos / Na-resolve na Concern'
                    : '2. When Concern Is Resolved / Cleared'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                {language === 'tl' ? (
                  <>
                    Magpapadala ng abiso na nakolekta na ang basura kasama ang bilang ng patunay na
                    litrato, at{' '}
                    <strong>
                      awtomatikong isesend ang bagong listahan ng mga natitira pang hindi pa tapos
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    Dispatches a notification that waste was collected with proof photo count, and{' '}
                    <strong>
                      automatically sends the updated list of remaining unresolved tickets
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-black text-slate-800">
                {language === 'tl'
                  ? 'Mga Naipadalang Telegram Alerts:'
                  : 'Dispatched Telegram Alerts:'}
              </span>
              <span className="text-slate-400 text-[11px]">
                {broadcastLog.length} {language === 'tl' ? 'naitala' : 'recorded'}
              </span>
            </div>
            <div className="bg-slate-900 text-slate-200 rounded-2xl p-3.5 max-h-48 overflow-y-auto space-y-2 text-xs font-mono">
              {broadcastLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400">▸</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmDisconnectBot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 rounded-2xl bg-rose-100">
                <Unlink className="w-6 h-6 text-rose-600" />
              </span>
              <div>
                <h4 className="font-black text-base text-slate-900">
                  {language === 'tl'
                    ? 'Idiskonekta ang Telegram Bot?'
                    : 'Disconnect Telegram Bot?'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'tl'
                    ? 'Aalisin ang kasalukuyang Bot Token at Chat ID'
                    : 'Clears current Bot Token and Chat ID'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDisconnectBot(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                onClick={handleDisconnectTelegram}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-black text-xs text-white shadow-xs cursor-pointer"
              >
                {language === 'tl' ? 'Oo, Idiskonekta' : 'Yes, Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
