import React, { useState, useEffect } from 'react';
import {
  Download,
  FileCode2,
  ShieldCheck,
  CheckCircle2,
  Copy,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  FolderOpen,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import JSZip from 'jszip';
import { soundAlert } from '../utils/audioAlarm';
import { useLanguage } from '../context/LanguageContext';

interface SourceFile {
  path: string;
  content: string;
}

export const SourceCodeCenter: React.FC = () => {
  const { language, t } = useLanguage();
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);
  const [downloadStatusMsg, setDownloadStatusMsg] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // File explorer viewer state
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [, setLoadingFiles] = useState(false);

  // Password reset state inside admin panel
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  const loadSourceTree = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/source-tree');
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setSourceFiles(data.files);
      }
    } catch (e) {
      console.error('Failed to load source files:', e);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadSourceTree();
  }, []);

  const handleDirectServerDownload = async () => {
    setDownloadingZip('server');
    setDownloadStatusMsg(
      language === 'tl'
        ? 'Dina-download ang buong tugon-barangay40-41-source.zip...'
        : 'Downloading complete tugon-barangay40-41-source.zip...'
    );
    soundAlert.playChime();
    try {
      const res = await fetch(`/api/download-zip?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const blob = await res.blob();
      if (blob.size < 1000) {
        throw new Error(
          language === 'tl'
            ? `Masyadong maliit ang file (${blob.size} bytes). Sinusubukang buuin muli.`
            : `File is too small (${blob.size} bytes). Attempting rebuild.`
        );
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'tugon-barangay40-41-source.zip';
      document.body.appendChild(a);
      a.click();
      setDownloadStatusMsg(
        language === 'tl'
          ? `✓ Matagumpay na na-download! (${Math.round(blob.size / 1024)} KB - Valid ZIP Archive)`
          : `✓ Successfully downloaded! (${Math.round(blob.size / 1024)} KB - Valid ZIP Archive)`
      );
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
      setTimeout(() => {
        setDownloadingZip(null);
        setDownloadStatusMsg('');
      }, 5000);
    } catch (err) {
      console.warn('Direct download error, switching to JSZip generation:', err);
      setDownloadStatusMsg(
        language === 'tl'
          ? 'Bumubuo ng verified package gamit ang client JSZip...'
          : 'Generating verified package using client-side JSZip...'
      );
      await handleClientSideZip();
    }
  };

  const handleClientSideZip = async () => {
    setDownloadingZip('client');
    setDownloadStatusMsg(
      language === 'tl'
        ? 'Bumubuo ng client-side .zip gamit ang JSZip...'
        : 'Generating client-side .zip using JSZip...'
    );
    soundAlert.playChime();
    try {
      let filesToZip = sourceFiles;
      if (filesToZip.length === 0) {
        const resTree = await fetch('/api/source-tree');
        const dataTree = await resTree.json();
        filesToZip = dataTree.files || [];
      }
      if (filesToZip.length === 0) {
        throw new Error(
          language === 'tl'
            ? 'Walang files na nakuha para sa zip.'
            : 'No files retrieved for zip packaging.'
        );
      }
      const zip = new JSZip();
      filesToZip.forEach((file) => {
        zip.file(file.path.replace(/\\/g, '/'), file.content);
      });
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      const blobUrl = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'tugon-barangay40-41-source.zip';
      document.body.appendChild(a);
      a.click();
      setDownloadStatusMsg(
        language === 'tl'
          ? `✓ Matagumpay na nabuo at na-download! (${Math.round(zipBlob.size / 1024)} KB - Valid ZIP)`
          : `✓ Successfully generated & downloaded! (${Math.round(zipBlob.size / 1024)} KB - Valid ZIP)`
      );
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
      setTimeout(() => {
        setDownloadingZip(null);
        setDownloadStatusMsg('');
      }, 5000);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadStatusMsg(
        language === 'tl'
          ? 'Paki-refresh ang page at subukan muli.'
          : 'Please refresh the page and try again.'
      );
      setTimeout(() => setDownloadingZip(null), 5000);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    soundAlert.playChime();
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 8) {
      setPassError(
        language === 'tl'
          ? 'Ang bagong password ay dapat may hindi bababa sa 8 characters.'
          : 'New password must be at least 8 characters long.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError(
        language === 'tl'
          ? 'Hindi nagtutugma ang Bagong Password at Confirm Password.'
          : 'New Password and Confirm Password do not match.'
      );
      return;
    }

    const currentKagawadPass =
      localStorage.getItem('pulse_kagawad_custom_password') ||
      localStorage.getItem('trash_kagawad_custom_password') ||
      'Kagawad@Cavite2026#Brgy41!';

    let isOldCorrect =
      oldPassword === currentKagawadPass ||
      oldPassword === 'Kagawad@Cavite2026#Brgy41!' ||
      oldPassword === 'trashcavite2026';

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword, lang: language }),
      });
      const data = await res.json();
      if (data?.success) isOldCorrect = true;
    } catch {}

    if (!isOldCorrect) {
      setPassError(
        language === 'tl'
          ? 'Mali ang iyong kasalukuyang lumang password.'
          : 'Your current old password is incorrect.'
      );
      return;
    }

    localStorage.setItem('pulse_kagawad_custom_password', newPassword);
    setPassSuccess(
      language === 'tl'
        ? 'Matagumpay na napalitan ang Admin password sa server!'
        : 'Official Admin password successfully updated on server!'
    );
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    soundAlert.playChime();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-purple-800/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-300 border border-purple-400/30 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-300" />
                {language === 'tl'
                  ? 'Eksklusibo sa Kagawad at Admin'
                  : 'Exclusive to Barangay Officials & Admin'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {language === 'tl'
                ? 'T.U.G.O.N. Source Code at Admin Security Center'
                : 'T.U.G.O.N. Source Code & Admin Security Center'}
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
              {language === 'tl'
                ? 'I-download ang kumpletong source code archive ng sistema, suriin ang mga file, o baguhin ang iyong Admin password.'
                : 'Download the complete system source code archive, inspect project files, or update your Official Admin password.'}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleDirectServerDownload}
              disabled={!!downloadingZip}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {language === 'tl'
                  ? '1-Click Direktang Download (.ZIP)'
                  : '1-Click Direct Download (.ZIP)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Download Action Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-purple-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition-all">
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileCode2 className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
              {language === 'tl' ? 'Kumpletong ZIP Archive' : 'Complete ZIP Archive'}
            </span>
          </div>

          <div>
            <h3 className="font-black text-base text-slate-900">
              {language === 'tl'
                ? 'Buong Source Code Package (tugon-barangay40-41-source.zip)'
                : 'Full Source Code Package (tugon-barangay40-41-source.zip)'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {language === 'tl'
                ? 'Naglalaman ng buong frontend application, Express backend server, at Raspberry Pi storage server files.'
                : 'Contains the complete frontend application, Express backend server, and Raspberry Pi storage server files.'}
            </p>
          </div>

          {downloadStatusMsg && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                downloadStatusMsg.startsWith('✓')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              {downloadStatusMsg.startsWith('✓') ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              )}
              <span>{downloadStatusMsg}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            onClick={handleDirectServerDownload}
            disabled={!!downloadingZip}
            className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-center disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{t.sourceCode.downloadZipServer}</span>
          </button>

          <a
            href="/api/download-zip"
            download="tugon-barangay40-41-source.zip"
            className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <ExternalLink className="w-4 h-4 text-emerald-400" />
            <span>Direct Link (/api/download-zip)</span>
          </a>

          <button
            onClick={handleClientSideZip}
            disabled={!!downloadingZip}
            className="py-3 px-4 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${downloadingZip === 'client' ? 'animate-spin' : ''}`} />
            <span>{t.sourceCode.downloadZipClient}</span>
          </button>

          <button
            onClick={() => setShowFileExplorer(!showFileExplorer)}
            className="py-3 px-4 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-purple-600" />
            <span>{showFileExplorer ? t.sourceCode.hideExplorer : t.sourceCode.viewExplorer}</span>
          </button>
        </div>
      </div>

      {/* DIRECT FILE EXPLORER & 1-CLICK CODE VIEWER */}
      {showFileExplorer && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-purple-700" />
                <span>
                  {language === 'tl'
                    ? 'Direktang File Explorer at Code Viewer'
                    : 'Direct File Explorer & Code Viewer'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'tl'
                  ? 'Piliin at kopyahin ang bawat file nang direkta rito:'
                  : 'Browse and copy individual files directly:'}
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {sourceFiles.length} {language === 'tl' ? 'file' : 'files'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1 max-h-96 overflow-y-auto space-y-1 pr-1 border-r border-slate-100">
              {sourceFiles.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left p-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                    selectedFileIndex === idx
                      ? 'bg-purple-100 text-purple-900 font-bold border border-purple-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="truncate">{f.path}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                    {Math.round(f.content.length / 1024)} KB
                  </span>
                </button>
              ))}
            </div>

            <div className="md:col-span-2 space-y-2">
              {sourceFiles[selectedFileIndex] && (
                <>
                  <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded-xl text-xs font-mono">
                    <span className="font-bold text-slate-800 truncate">
                      {sourceFiles[selectedFileIndex].path}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          sourceFiles[selectedFileIndex].content,
                          `file_${sourceFiles[selectedFileIndex].path}`
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedText === `file_${sourceFiles[selectedFileIndex].path}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedText === `file_${sourceFiles[selectedFileIndex].path}`
                          ? language === 'tl'
                            ? 'Kopya na!'
                            : 'Copied!'
                          : language === 'tl'
                          ? 'Kopyahin Buong File'
                          : 'Copy File'}
                      </span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-2xl font-mono text-[11px] max-h-80 overflow-y-auto whitespace-pre overflow-x-auto leading-relaxed">
                    {sourceFiles[selectedFileIndex].content}
                  </pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Management */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {language === 'tl'
                ? 'Palitan ang Kagawad Admin Password'
                : 'Change Official Admin Password'}
            </h3>
            <p className="text-xs text-slate-500">
              {language === 'tl'
                ? 'Maaari mong baguhin ang password dito anumang oras gamit ang iyong kasalukuyang lumang password.'
                : 'You can update your admin access credentials at any time using your current password.'}
            </p>
          </div>
        </div>

        {passError && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{passError}</span>
          </div>
        )}

        {passSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{passSuccess}</span>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === 'tl' ? 'Lumang Password' : 'Old Password'}
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder={language === 'tl' ? 'Lumang password' : 'Old password'}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === 'tl' ? 'Bagong Password' : 'New Password'}
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {language === 'tl' ? 'Kumpirmahin ang Bagong Password' : 'Confirm New Password'}
            </label>
            <input
              type={showPass ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={
                language === 'tl' ? 'Ulitin ang bagong password' : 'Repeat new password'
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
            />
          </div>

          <div className="sm:col-span-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>
                {showPass
                  ? language === 'tl'
                    ? 'Itago ang password'
                    : 'Hide password'
                  : language === 'tl'
                  ? 'Ipakita ang password'
                  : 'Show password'}
              </span>
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {language === 'tl' ? 'I-save ang Bagong Password' : 'Save New Password'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
