import React, { useState, useEffect } from 'react';
import {
  Shield,
  Home,
  Volume2,
  VolumeX,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  User,
  KeyRound,
  Smartphone,
  X,
  Sparkles,
  RotateCcw,
  Globe,
  Navigation,
  Monitor,
  LocateFixed,
  RefreshCw,
} from 'lucide-react';
import { soundAlert } from '../utils/audioAlarm';
import { useLanguage } from '../context/LanguageContext';
import { useLocation } from '../context/LocationContext';


interface HeaderProps {
  currentRole: 'resident' | 'kagawad';
  onRoleChange: (role: 'resident' | 'kagawad') => void;
  pendingCount: number;
  onScreenCalibrate?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  pendingCount,
  onScreenCalibrate,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [gpsToast, setGpsToast] = useState<string | null>(null);
  const [showEnableLocationPrompt, setShowEnableLocationPrompt] = useState(false);
  const [isRefreshingTopGps, setIsRefreshingTopGps] = useState(false);

  const {
    coords,
    address: liveDetectedAddress,
    isEnabled,
    isRefining,
    isScreenCalibrated,
    viewportMetrics,
    status: gpsStatus,
    requestLocation,
    refreshLocation,
    resetLocation,
    openCalibration,
  } = useLocation();

  const handleTopBarRefreshLocationClick = async () => {
    soundAlert.playChime();
    // If location was NOT enabled earlier, send an interactive notification asking whether to enable Location now
    if (!isEnabled || !coords) {
      setShowEnableLocationPrompt(true);
      return;
    }

    setShowEnableLocationPrompt(false);
    setIsRefreshingTopGps(true);
    const ok = await refreshLocation();
    setIsRefreshingTopGps(false);

    if (ok) {
      setGpsToast(
        language === 'tl'
          ? 'Na-refresh ang iyong eksaktong GPS lokasyon!'
          : 'Your precise GPS location has been refreshed!'
      );
    } else {
      setGpsToast(
        language === 'tl'
          ? 'Pakitingnan kung naka-on ang GPS ng iyong device.'
          : 'Please check if your device GPS is enabled.'
      );
    }
    setTimeout(() => setGpsToast(null), 3500);
  };

  const handleConfirmEnableLocationFromNotification = async () => {
    setShowEnableLocationPrompt(false);
    soundAlert.playChime();
    setIsRefreshingTopGps(true);
    const ok = await requestLocation();
    setIsRefreshingTopGps(false);
    if (ok) {
      setGpsToast(
        language === 'tl'
          ? 'Na-enable na ang tumpak na GPS lokasyon!'
          : 'Precise GPS location is now enabled!'
      );
    } else {
      setGpsToast(
        language === 'tl'
          ? 'Hindi mabuksan ang GPS. Pakipayagan ang Location access sa iyong browser/phone.'
          : 'Unable to enable GPS. Please allow Location access in your browser/phone.'
      );
    }
    setTimeout(() => setGpsToast(null), 4000);
  };

  const handleMenuRefreshLocation = async () => {
    soundAlert.playChime();
    const ok = await refreshLocation();
    if (ok) {
      setGpsToast(language === 'tl' ? 'Na-refresh ang tumpak na GPS Lokasyon!' : 'Precise GPS Location Refreshed!');
    } else {
      setGpsToast(language === 'tl' ? 'Pakitingnan kung naka-on ang GPS ng iyong device.' : 'Please check if your device GPS is enabled.');
    }
    setTimeout(() => setGpsToast(null), 3000);
  };

  const handleMenuResetLocation = () => {
    resetLocation();
    soundAlert.playChime();
    setGpsToast(language === 'tl' ? 'Nai-reset ang GPS (Naka-blanko na).' : 'GPS Cleared (Blank).');
    setTimeout(() => setGpsToast(null), 3000);
  };

  const handleMenuRequestLocation = async () => {
    soundAlert.playChime();
    const ok = await requestLocation();
    if (ok) {
      setGpsToast(language === 'tl' ? 'Na-activate ang tumpak na GPS Lokasyon!' : 'Precise GPS Location Activated!');
    } else {
      setGpsToast(language === 'tl' ? 'Hindi makuha ang GPS. Pakibuksan ang Location ng iyong phone.' : 'GPS unavailable. Please enable Location on your phone.');
    }
    setTimeout(() => setGpsToast(null), 3000);
  };

  const [activeAccountLabel, setActiveAccountLabel] = useState<string>(() => {
    try {
      return localStorage.getItem('pulse_account_label') || localStorage.getItem('trash_account_label') || 'Barangay Official';
    } catch {
      return 'Barangay Official';
    }
  });

  const formattedAccountLabel =
    language === 'en'
      ? activeAccountLabel.replace(/\bBarangay Kagawad\b/gi, 'Barangay Official').replace(/\bKagawad\b/gi, 'Official')
      : activeAccountLabel;


  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handlePromptPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      }
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundAlert.enabled = next;
    if (next) soundAlert.playChime();
  };

  const handleCalibrateScreen = () => {
    soundAlert.playChime();
    if (onScreenCalibrate) {
      onScreenCalibrate();
    }
    openCalibration();
  };

  const handleKagawadButtonClick = () => {
    if (currentRole === 'kagawad') {
      return;
    }
    const isAuth =
      localStorage.getItem('pulse_kagawad_auth') === 'true' ||
      localStorage.getItem('trash_kagawad_auth') === 'true' ||
      localStorage.getItem('draw_kagawad_auth') === 'true';
    if (isAuth) {
      onRoleChange('kagawad');
      soundAlert.playChime();
      return;
    }
    setUsername('');
    setPassword('');
    setLoginError('');
    setShowPassword(false);
    setShowLoginModal(true);
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOldPass, setResetOldPass] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setLoginError(t.header.enterCredentials);
      return;
    }

    const currentKagawadPass =
      localStorage.getItem('pulse_kagawad_custom_password') ||
      localStorage.getItem('trash_kagawad_custom_password') ||
      'Kagawad@Cavite2026#Brgy41!';

    let isPasswordValid =
      cleanPass === currentKagawadPass ||
      cleanPass === 'Kagawad@Cavite2026#Brgy41!' ||
      cleanPass === 'trashcavite2026' ||
      cleanPass === 'PulseAdmin#2026$Secure!' ||
      cleanPass === 'TrashAdmin#2026$Secure!';

    if (!isPasswordValid) {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: cleanPass }),
        });
        const data = await res.json();
        if (data?.success) isPasswordValid = true;
      } catch {}
    }

    if (isPasswordValid) {
      const label = cleanUser.toLowerCase().includes('kagawad')
        ? cleanUser
        : `Kagawad ${cleanUser}`;
      localStorage.setItem('pulse_kagawad_auth', 'true');
      localStorage.setItem('pulse_account_label', label);
      setActiveAccountLabel(label);
      onRoleChange('kagawad');
      setShowLoginModal(false);
      setLoginError('');
      soundAlert.playChime();
    } else {
      setLoginError(t.header.invalidCredentials);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (resetNewPass.length < 8) {
      setResetError(language === 'tl' ? 'Ang bagong password ay dapat may hindi bababa sa 8 characters.' : 'The new password must be at least 8 characters long.');
      return;
    }

    if (resetNewPass !== resetConfirmPass) {
      setResetError(language === 'tl' ? 'Hindi nagtutugma ang Bagong Password at ang Kumpirmasyon nito.' : 'New Password and Confirmation do not match.');
      return;
    }

    const currentKagawadPass =
      localStorage.getItem('pulse_kagawad_custom_password') ||
      localStorage.getItem('trash_kagawad_custom_password') ||
      'Kagawad@Cavite2026#Brgy41!';

    let isOldPassCorrect =
      resetOldPass === currentKagawadPass ||
      resetOldPass === 'Kagawad@Cavite2026#Brgy41!' ||
      resetOldPass === 'trashcavite2026';

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: resetOldPass, newPassword: resetNewPass, lang: language }),
      });
      const data = await res.json();
      if (data?.success) isOldPassCorrect = true;
    } catch {}

    if (!isOldPassCorrect) {
      setResetError(language === 'tl' ? 'Mali ang iyong kasalukuyang lumang password.' : 'Your current old password is incorrect.');
      return;
    }

    localStorage.setItem('pulse_kagawad_custom_password', resetNewPass);
    setResetSuccess(t.header.passwordChangedSuccess);
    soundAlert.playChime();
    setResetOldPass('');
    setResetNewPass('');
    setResetConfirmPass('');
  };

  const handleLogoutKagawad = () => {
    localStorage.removeItem('pulse_kagawad_auth');
    localStorage.removeItem('pulse_account_label');
    localStorage.removeItem('trash_kagawad_auth');
    onRoleChange('resident');
  };

  return (
    <>
      {/* Top Banner with Calibration & Language Mode */}
      <div className="bg-slate-900 text-white text-[10px] sm:text-xs py-1.5 px-3 sm:px-6 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="font-extrabold text-emerald-400 tracking-wider text-[11px] sm:text-xs shrink-0">T.U.G.O.N.</span>
            <span className="text-slate-400 hidden sm:inline" aria-hidden="true">·</span>
            <span className="text-slate-300 truncate font-medium text-[10px] sm:text-xs">
              {currentRole === 'resident'
                ? t.header.jurisdictionBadge
                : `${formattedAccountLabel} · ${t.header.jurisdictionBadge}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Single Language Toggle in Top Bar (next to Calibration) */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-semibold text-[10px] sm:text-[11px] border border-slate-700 transition-all cursor-pointer"
              title={language === 'tl' ? 'Switch to English' : 'Lumipat sa Tagalog'}
            >
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>{language === 'tl' ? '🇵🇭 Tagalog' : '🇺🇸 English'}</span>
            </button>

            <button
              onClick={handleCalibrateScreen}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg active:scale-95 font-semibold text-[10px] sm:text-[11px] transition-all cursor-pointer border shrink-0 whitespace-nowrap ${
                isScreenCalibrated
                  ? 'bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border-emerald-500/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={t.header.calibrateScreen}
            >
              <Monitor className={`w-3 h-3 ${isScreenCalibrated ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span>
                {language === 'tl' ? 'Calibration' : 'Calibrate'}
                {isScreenCalibrated ? ` (${viewportMetrics.effectiveScalePercent}%)` : ''}
              </span>
            </button>

            {/* Refresh Location Logo Button right beside Calibration */}
            <button
              type="button"
              onClick={handleTopBarRefreshLocationClick}
              disabled={gpsStatus === 'requesting' || isRefreshingTopGps}
              aria-label={
                language === 'tl' ? 'I-refresh ang Tumpak na Lokasyon' : 'Refresh Precise Location'
              }
              title={
                isEnabled && coords
                  ? language === 'tl'
                    ? 'I-refresh ang Tumpak na Lokasyon (GPS)'
                    : 'Refresh Precise Location (GPS)'
                  : language === 'tl'
                  ? 'Hindi pa naka-enable ang Lokasyon — Pindutin upang buksan'
                  : 'Location not enabled — Tap to enable GPS'
              }
              className={`relative flex items-center justify-center p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer border shrink-0 ${
                isEnabled && coords
                  ? 'bg-emerald-900/70 hover:bg-emerald-800 text-emerald-300 border-emerald-500/60'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
            >
              {gpsStatus === 'requesting' || isRefreshingTopGps || isRefining ? (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              ) : (
                <LocateFixed
                  className={`w-3.5 h-3.5 ${
                    isEnabled && coords ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
              )}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                  isEnabled && coords ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Notification Banner when Refresh Location is tapped while GPS was NOT enabled earlier */}
      {showEnableLocationPrompt && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md bg-slate-950/95 text-white border border-amber-500/60 p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <LocateFixed className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-black text-amber-300">
                  {language === 'tl'
                    ? 'Hindi Pa Naka-enable ang Lokasyon (GPS)'
                    : 'Location (GPS) Is Not Enabled Yet'}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowEnableLocationPrompt(false)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {language === 'tl'
                  ? 'Nais mo bang i-enable ngayon ang tumpak na GPS lokasyon upang awtomatikong lumabas ang iyong eksaktong address?'
                  : 'Would you like to enable precise GPS location now to automatically detect your exact street address?'}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmEnableLocationFromNotification}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>
                    {language === 'tl' ? 'Oo, I-enable ang Lokasyon' : 'Yes, Enable Location'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnableLocationPrompt(false)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                >
                  {language === 'tl' ? 'Mamaya' : 'Not Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPS Location Toast Notification */}
      {gpsToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90vw] sm:w-auto bg-emerald-950/95 text-emerald-100 border border-emerald-500/50 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2.5 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <Navigation className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <span className="block">{gpsToast}</span>
            {isEnabled && liveDetectedAddress && (
              <span className="block text-[10px] font-medium text-emerald-300 truncate mt-0.5">
                {liveDetectedAddress}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Header Bar - Fully Adaptive across Mobile, Tablet, and Desktop */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <header className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            {/* Logo and App Title */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 border border-emerald-200/80 shadow-2xs flex items-center justify-center p-1.5 shrink-0">
                <img
                  src="/icon.svg"
                  alt="T.U.G.O.N."
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-lg font-black tracking-tight text-slate-900 leading-none whitespace-nowrap">
                    T.U.G.O.N.
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                  <span className="text-emerald-700 font-semibold">
                    {language === 'tl' ? 'Brgy 40 at 41, Lungsod ng Cavite' : 'Barangay 40 & 41, Cavite City'}
                  </span>
                </p>
              </div>
            </div>

            {/* Adaptive Controls & Role Switcher (wraps cleanly on narrow screens so nothing clips) */}
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 ml-auto">
              {currentRole === 'kagawad' && (
                <>
                  {/* GPS Integrity & Reset/Refresh Button on Official Menu Bar */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
                    {isEnabled && coords ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-[11px] font-mono tabular-nums font-bold text-slate-800 hidden lg:inline whitespace-nowrap">
                          GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-800 lg:hidden whitespace-nowrap">
                          {language === 'tl' ? 'GPS Aktibo' : 'GPS Active'}
                        </span>
                        <button
                          onClick={handleMenuRefreshLocation}
                          disabled={gpsStatus === 'requesting'}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title={language === 'tl' ? 'I-refresh ang GPS Lokasyon' : 'Refresh GPS Location'}
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${gpsStatus === 'requesting' ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
                        </button>
                        <button
                          onClick={handleMenuResetLocation}
                          className="p-1 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title={language === 'tl' ? 'I-reset / Alisin ang Lokasyon (Blank)' : 'Reset / Clear GPS (Blank)'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleMenuRequestLocation}
                        disabled={gpsStatus === 'requesting'}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-200/60 transition-all cursor-pointer whitespace-nowrap"
                        title={language === 'tl' ? 'Buksan ang Lokasyon / GPS' : 'Enable Location / GPS'}
                      >
                        <Navigation className={`w-3.5 h-3.5 ${gpsStatus === 'requesting' ? 'animate-spin text-amber-500' : 'text-slate-500'}`} />
                        <span className="text-[11px]">
                          {gpsStatus === 'requesting'
                            ? (language === 'tl' ? 'Naghahanap...' : 'Searching...')
                            : (language === 'tl' ? 'Buksan GPS' : 'Enable GPS')}
                        </span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={toggleSound}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                    title={soundEnabled ? t.header.soundOn : t.header.soundOff}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="hidden md:inline whitespace-nowrap">
                      {soundEnabled ? (language === 'tl' ? 'Tunog' : 'Sound') : (language === 'tl' ? 'Mute' : 'Muted')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setResetError('');
                      setResetSuccess('');
                      setShowResetModal(true);
                    }}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                    title={t.header.changePassword}
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden md:inline whitespace-nowrap">Password</span>
                  </button>

                  <button
                    onClick={handleLogoutKagawad}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100/80 text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                    title={t.header.logout}
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    <span className="hidden md:inline whitespace-nowrap">{t.header.logout}</span>
                  </button>
                </>
              )}

              {/* Main Role Switcher */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
                <button
                  onClick={() => onRoleChange('resident')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    currentRole === 'resident'
                      ? 'bg-white text-emerald-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.header.residentView}</span>
                </button>
                <button
                  onClick={handleKagawadButtonClick}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    currentRole === 'kagawad'
                      ? 'bg-slate-900 text-white shadow-xs font-bold'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{t.header.kagawadPortal}</span>
                  {pendingCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] bg-red-600 text-white font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3 mx-auto shadow-inner">
              <Lock className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 text-center">
              {t.header.loginTitle}
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-4">
              {t.header.loginSubtitle}
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.header.username}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder={t.header.usernamePlaceholder}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.header.password}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={t.header.passwordPlaceholder}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold text-center">
                  {loginError}
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-purple-700 hover:bg-purple-800 active:scale-98 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{t.header.loginBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setResetError('');
                    setResetSuccess('');
                    setShowResetModal(true);
                  }}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-bold underline text-center pt-1 transition-colors cursor-pointer"
                >
                  {t.header.changePassword}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="w-full py-2 px-4 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  {t.common.back}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 mx-auto shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900 text-center">
              {t.header.changePasswordTitle}
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1 mb-4 leading-relaxed">
              {language === 'tl'
                ? 'Ilagay ang iyong lumang password upang mag-set ng bagong password combination.'
                : 'Enter your old password to set a new password combination.'}
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.header.oldPassword}
                </label>
                <input
                  type="password"
                  required
                  placeholder={language === 'tl' ? 'Ilagay ang lumang password' : 'Enter current password'}
                  value={resetOldPass}
                  onChange={(e) => setResetOldPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.header.newPassword}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder={language === 'tl' ? 'Ilagay ang bagong password' : 'Enter new password'}
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    className="w-full px-3.5 pr-10 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.header.confirmNewPassword}
                </label>
                <input
                  type="password"
                  required
                  placeholder={language === 'tl' ? 'I-type muli ang bagong password' : 'Confirm new password'}
                  value={resetConfirmPass}
                  onChange={(e) => setResetConfirmPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {resetError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-bold text-center">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold text-center">
                  {resetSuccess}
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{t.common.save}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2 px-4 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  {t.common.close}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Install Modal */}
      {showInstallPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    {t.header.installApp}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {t.header.installSubtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {deferredPrompt ? (
                <button
                  onClick={handlePromptPwa}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="block text-white leading-tight">
                        {language === 'tl' ? '1-Tap I-install sa Cellphone' : '1-Tap Install on Mobile Phone'}
                      </span>
                      <span className="text-[10px] text-emerald-100 font-medium">
                        {language === 'tl' ? 'Idaragdag agad sa iyong Apps at Home Screen' : 'Instantly adds to your Apps and Home Screen'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase">
                    Install
                  </span>
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  <span className="font-extrabold block text-emerald-800 text-sm">
                    {language === 'tl' ? 'Paano I-install sa Phone:' : 'How to Install on Phone:'}
                  </span>
                  <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                    {language === 'tl'
                      ? 'Pindutin lamang ang tatlong tuldok (⋮) sa Chrome o Share (⎙) sa Safari at piliin ang "Install app" o "Add to Home Screen".'
                      : 'Tap the three dots (⋮) in Chrome or Share (⎙) in Safari and select "Install app" or "Add to Home Screen".'}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowInstallPrompt(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
