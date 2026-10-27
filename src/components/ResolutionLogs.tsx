import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Search,
  CheckCircle2,
  HardDrive,
  ShieldCheck,
  X,
  Camera,
  Trash2,
  Database,
  ArrowDownToLine,
  RefreshCw,
  Clock,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { WasteReport, SavedLogBook } from '../types';
import { soundAlert } from '../utils/audioAlarm';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchUnifiedSavedLogbooks,
  saveUnifiedLogbook,
  downloadUnifiedLogbook,
  deleteUnifiedSavedLogbook,
} from '../utils/piBridge';
import { PhotoLightboxModal, ResolvedPhoto } from './PhotoLightboxModal';
import { formatTicketNumber } from '../utils/imageCompressor';

interface ResolutionLogsProps {
  reports: WasteReport[];
  onViewReport: (report: WasteReport) => void;
  onDeleteReport?: (id: string) => void;
  onClearAllReports?: () => Promise<void>;
}

export const ResolutionLogs: React.FC<ResolutionLogsProps> = ({
  reports,
  onViewReport,
  onDeleteReport,
  onClearAllReports,
}) => {
  const { language, t } = useLanguage();
  const [activeLogTab, setActiveLogTab] = useState<'live' | 'saved_pi'>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPurok, setFilterPurok] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [lightboxState, setLightboxState] = useState<{
    photos: string[];
    index: number;
    title?: string;
  } | null>(null);

  // Saved Log Books state
  const [savedLogbooks, setSavedLogbooks] = useState<SavedLogBook[]>([]);
  const [isSavingLogbook, setIsSavingLogbook] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [selectedReportDetail, setSelectedReportDetail] = useState<WasteReport | null>(null);

  // Custom iframe-safe confirmation modals
  const [logbookToDelete, setLogbookToDelete] = useState<SavedLogBook | null>(null);
  const [confirmClearAllModal, setConfirmClearAllModal] = useState(false);

  const fetchSavedLogbooks = async () => {
    try {
      const list = await fetchUnifiedSavedLogbooks(language);
      setSavedLogbooks(list);
    } catch (e) {
      console.error('Failed to fetch saved logbooks:', e);
    }
  };

  const confirmDeleteSavedLogbook = async () => {
    if (!logbookToDelete) return;
    const id = logbookToDelete.id;
    const filename = logbookToDelete.filename;
    try {
      await deleteUnifiedSavedLogbook(logbookToDelete);
      soundAlert.playChime();
      setSavedLogbooks((prev) => prev.filter((l) => l.id !== id && l.filename !== filename));
      setLogbookToDelete(null);
    } catch (e) {
      console.error(e);
      setLogbookToDelete(null);
    }
  };

  const handleDownloadLogbook = async (log: SavedLogBook) => {
    try {
      const blob = await downloadUnifiedLogbook(log);
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = log.filename || `TUGON_Logbook_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        soundAlert.playChime();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 15000);
      }
    } catch (e) {
      console.error('Download logbook error:', e);
    }
  };

  useEffect(() => {
    fetchSavedLogbooks();
  }, [language]);

  const handleSaveToPiCloud = async () => {
    setIsSavingLogbook(true);
    setSaveSuccessMsg('');
    try {
      const data = await saveUnifiedLogbook(reports, language);
      if (data.success && data.logbook) {
        setSavedLogbooks((prev) => [data.logbook!, ...prev]);
        setSaveSuccessMsg(
          data.message ||
            (language === 'tl'
              ? `Matagumpay na na-save ang bagong Log Book snapshot sa Pi Cloud Server! (${data.logbook.savedAtPhilippineTime})`
              : `Log Book snapshot successfully saved to Pi Cloud Server! (${data.logbook.savedAtPhilippineTime})`)
        );
        soundAlert.playChime();
        setTimeout(() => setSaveSuccessMsg(''), 7000);
      }
    } catch (e) {
      console.error('Save logbook error:', e);
    } finally {
      setIsSavingLogbook(false);
    }
  };

  const filtered = reports.filter((r) => {
    const q = searchQuery.toLowerCase();
    const displayTicket = formatTicketNumber(r.ticketNumber).toLowerCase();
    const matchesSearch =
      displayTicket.includes(q) ||
      r.ticketNumber.toLowerCase().includes(q) ||
      (r.residentName ? r.residentName.toLowerCase().includes(q) : false) ||
      (r.streetAddress && r.streetAddress.toLowerCase().includes(q)) ||
      r.purok.toLowerCase().includes(q) ||
      (r.barangay && r.barangay.toLowerCase().includes(q));

    let matchesBarangay = true;
    if (filterPurok === '40') {
      matchesBarangay = !!(r.barangay?.includes('40') || r.purok?.includes('40'));
    } else if (filterPurok === '41') {
      matchesBarangay = !!(
        r.barangay?.includes('41') ||
        r.purok?.includes('41') ||
        (!r.barangay && !r.purok?.includes('40'))
      );
    } else if (filterPurok === 'OUTSIDE') {
      matchesBarangay = !!(r.needsAssistanceOutside || r.isWithinJurisdiction === false);
    }

    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchesSearch && matchesBarangay && matchesStatus;
  });

  const totalResidentPhotos = reports.reduce((acc, r) => acc + (r.photos?.length || 0), 0);
  const totalProofPhotos = reports.reduce((acc, r) => acc + (r.proofPhotos?.length || 0), 0);
  const totalResidentMb = reports.reduce(
    (acc, r) => acc + (r.residentPhotosSizeMb || (r.photos?.length || 0) * 0.8),
    0
  );
  const totalProofMb = reports.reduce(
    (acc, r) => acc + (r.proofPhotosSizeMb || (r.proofPhotos?.length || 0) * 0.75),
    0
  );
  const totalPiStorageMb = +(totalResidentMb + totalProofMb).toFixed(2);

  const exportToCSV = () => {
    const headers = [
      'Ticket Number',
      'Status',
      'Created Date/Time',
      'Completed/Resolved Date',
      'Barangay (Cavite City)',
      'Address',
      'Resident',
      'Extra Message',
      'Needs Assistance Outside',
      'Senior Priority',
      'Severity Level',
      'Waste Types',
      'Resident Photos Count',
      'Official Proof Photos Count',
      'Storage Used (MB)',
      'Resolved By / Proof Notes',
      'Cancellation Reason',
    ];

    const rows = filtered.map((r) => [
      `"${formatTicketNumber(r.ticketNumber)}"`,
      `"${r.status}"`,
      `"${new Date(r.createdAt).toLocaleString()}"`,
      `"${r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : 'N/A'}"`,
      `"${r.barangay || r.purok}"`,
      `"${(r.streetAddress || '')} ${(r.houseNumber || '')}"`,
      `"${r.residentName || 'N/A'}"`,
      `"${r.extraMessage || 'N/A'}"`,
      `"${r.needsAssistanceOutside ? 'YES' : 'NO'}"`,
      `"${r.isElderly ? 'YES' : 'NO'}"`,
      `"${r.severityLevel}"`,
      `"${r.wasteTypes.join(', ')}"`,
      r.photos?.length || 0,
      r.proofPhotos?.length || 0,
      r.storageUsedMb || ((r.photos?.length || 0) * 0.8 + (r.proofPhotos?.length || 0) * 0.75).toFixed(2),
      `"${r.resolutionNotes || r.resolvedBy || 'N/A'}"`,
      `"${r.cancellationReason || 'N/A'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `TUGON_Barangay40_41_Audit_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-6">
      {/* Header and Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <FileText className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-black text-slate-900">
              {language === 'tl'
                ? 'Logbook ng Basura at Proeba (Barangay 40 & 41)'
                : 'Waste Collection & Proof Logbook (Barangay 40 & 41)'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'tl'
              ? 'Opisyal na permanenteng talaan ng mga concern, litrato ng residente, at kalakip na proeba ng Kagawad sa Raspberry Pi Cloud Storage.'
              : 'Official permanent record of resident concerns, photos, and Barangay Official cleanup proofs in Raspberry Pi Cloud Storage.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSaveToPiCloud}
            disabled={isSavingLogbook}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            title={language === 'tl' ? 'I-save ang snapshot sa Raspberry Pi Cloud Storage' : 'Save snapshot to Raspberry Pi Cloud Storage'}
          >
            <HardDrive className="w-4 h-4 text-emerald-200" />
            <span>
              {isSavingLogbook
                ? (language === 'tl' ? 'Sine-save sa Pi Cloud...' : 'Saving to Pi Cloud...')
                : (language === 'tl' ? 'I-save sa Pi Cloud Server' : 'Save to Pi Cloud Server')}
            </span>
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{language === 'tl' ? 'I-export CSV' : 'Export CSV'}</span>
          </button>
          {reports.length > 0 && (
            <button
              onClick={() => setConfirmClearAllModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
              title={language === 'tl' ? 'Burahin ang lahat ng test data' : 'Clear all active test data'}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>{language === 'tl' ? 'Linisin Test Data' : 'Clear Test Data'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveLogTab('live')}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeLogTab === 'live'
              ? 'bg-purple-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{language === 'tl' ? 'Kasalukuyang Talaan (Live Logbook)' : 'Live Collection Records'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-900 text-purple-200 font-mono">
            {reports.length}
          </span>
        </button>

        <button
          onClick={() => setActiveLogTab('saved_pi')}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeLogTab === 'saved_pi'
              ? 'bg-purple-700 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5 text-amber-300" />
          <span>{language === 'tl' ? 'Saved Log Books sa Pi Cloud Server' : 'Saved Log Books in Pi Cloud'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black font-mono">
            {savedLogbooks.length}
          </span>
        </button>
      </div>

      {activeLogTab === 'saved_pi' ? (
        <div className="space-y-4">
          <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">
                  {language === 'tl'
                    ? 'Raspberry Pi Cloud Server: Saved Log Books Archive'
                    : 'Raspberry Pi Cloud Server: Saved Log Books Archive'}
                </h4>
                <p className="text-xs text-slate-400">
                  {language === 'tl'
                    ? 'Naka-archive ang bawat snapshot kasama ang lahat ng ticket at litrato sa database ng Pi Server para sa permanenteng talaan.'
                    : 'Each snapshot is archived with all tickets and photos directly in the Pi Server database for permanent sovereign records.'}
                </p>
              </div>
            </div>
            <button
              onClick={fetchSavedLogbooks}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'tl' ? 'I-refresh ang Archive' : 'Refresh Archive'}</span>
            </button>
          </div>

          {savedLogbooks.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">{language === 'tl' ? 'Logbook Snapshot ID' : 'Snapshot ID'}</th>
                    <th className="py-3 px-4">{language === 'tl' ? 'Oras (Philippine Time)' : 'Timestamp (PH Time)'}</th>
                    <th className="py-3 px-4">{language === 'tl' ? 'Sakop na Tala' : 'Records Included'}</th>
                    <th className="py-3 px-4">
                      {language === 'tl' ? 'Brgy 40 / 41' : 'Barangay 40 / 41'}
                    </th>
                    <th className="py-3 px-4">Storage (Pi MB)</th>
                    <th className="py-3 px-4">{language === 'tl' ? 'Sync Status' : 'Sync Status'}</th>
                    <th className="py-3 px-4 text-right">{language === 'tl' ? 'Aksyon' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {savedLogbooks.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {log.filename}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {log.savedAtPhilippineTime}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{log.totalRecords} tickets</span>
                        <div className="text-[10px] text-slate-400">
                          Pending: {log.pendingRecords} • Resolved: {log.resolvedRecords}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-800 mr-1">
                          B40: {log.brgy40Count}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          B41: {log.brgy41Count}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {log.storageUsedMb} MB
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>
                            {log.syncStatus === 'SYNCED'
                              ? (language === 'tl' ? 'SYNCED SA PI' : 'SYNCED TO PI')
                              : (language === 'tl' ? 'SAVED SA CLOUD' : 'SAVED TO CLOUD')}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadLogbook(log)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-sm transition-colors cursor-pointer"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                          <span>JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogbookToDelete(log)}
                          className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                          title={language === 'tl' ? 'Burahin ang Logbook na ito' : 'Delete this logbook'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <Database className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold text-xs">
                {language === 'tl'
                  ? 'Wala pang naka-save na Log Book snapshot sa Pi Cloud.'
                  : 'No saved Log Book snapshots in Pi Cloud yet.'}
              </p>
              <button
                onClick={handleSaveToPiCloud}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs cursor-pointer hover:bg-emerald-600"
              >
                {language === 'tl' ? 'I-save ang Kasalukuyang Log Book Ngayon' : 'Save Current Log Book Snapshot Now'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* LIVE LOGBOOK VIEW */
        <>
          {/* Raspberry Pi 4 Storage Consumption Breakdown */}
          <div className="bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white">
                    {language === 'tl'
                      ? 'Raspberry Pi 4B Hard Drive Breakdown (/media/pi/Vherrsie Back-up/RESEARCH TRASH):'
                      : 'Raspberry Pi 4B Hard Drive Breakdown (/media/pi/Vherrsie Back-up/RESEARCH TRASH):'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {language === 'tl'
                      ? `Maliit lamang ang kinakain sa drive (~${totalPiStorageMb} MB). Lahat ng na-purge sa active view ay ligtas dito sa permanent logbook.`
                      : `Lightweight storage footprint (~${totalPiStorageMb} MB). All purged active records are safely stored here in the permanent logbook.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-black">
                  {totalPiStorageMb} {language === 'tl' ? 'MB Ginamit sa Pi' : 'MB Used on Pi'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">{language === 'tl' ? 'Litrato ng Residente:' : 'Resident Photos:'}</span>
                <span className="text-white font-bold">
                  {totalResidentPhotos} {language === 'tl' ? 'litrato' : 'photos'} (~{totalResidentMb.toFixed(1)} MB)
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-emerald-400">{language === 'tl' ? 'Proeba ng Kagawad:' : 'Official Proofs:'}</span>
                <span className="text-emerald-300 font-bold">
                  {totalProofPhotos} {language === 'tl' ? 'proeba' : 'proofs'} (~{totalProofMb.toFixed(1)} MB)
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-purple-400">Database Disk:</span>
                <span className="text-purple-300 font-bold">Permanent JSON / SQLite</span>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t.logs.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-slate-50 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <select
                value={filterPurok}
                onChange={(e) => setFilterPurok(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50"
              >
                <option value="ALL">
                  {language === 'tl'
                    ? 'Lahat ng Hurisdiksyon (Brgy 40 Gumamela & Brgy 41 Rosal)'
                    : 'All Jurisdictions (Barangay 40 Gumamela & Barangay 41 Rosal)'}
                </option>
                <option value="40">
                  {language === 'tl' ? 'Barangay 40 (Gumamela) Lamang' : 'Barangay 40 (Gumamela) Only'}
                </option>
                <option value="41">
                  {language === 'tl' ? 'Barangay 41 (Rosal) Lamang' : 'Barangay 41 (Rosal) Only'}
                </option>
                <option value="OUTSIDE">
                  {language === 'tl' ? 'Labas ng Hurisdiksyon (Assistance)' : 'Outside Jurisdiction (Assistance)'}
                </option>
              </select>
            </div>
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50"
              >
                <option value="ALL">
                  {language === 'tl' ? 'Lahat ng Katayuan (Lahat Makikita)' : 'All Statuses (Show All)'}
                </option>
                <option value="RESOLVED">
                  {language === 'tl' ? 'Natapos na may Proeba (Resolved)' : 'Resolved (With Proof)'}
                </option>
                <option value="CANCELLED">
                  {language === 'tl' ? 'Kinansela Lamang (Cancelled)' : 'Cancelled Only'}
                </option>
                <option value="DISPATCHED">
                  {language === 'tl' ? 'Dispatched Lamang' : 'Dispatched Only'}
                </option>
                <option value="PENDING">
                  {language === 'tl' ? 'Pending Lamang' : 'Pending Only'}
                </option>
              </select>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block sm:hidden space-y-3">
            {filtered.length > 0 ? (
              filtered.map((report) => (
                <div
                  key={report.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900 font-mono">
                        #{formatTicketNumber(report.ticketNumber)}
                      </span>
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                          report.barangay?.includes('40')
                            ? 'bg-cyan-100 text-cyan-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {report.barangay || 'Barangay 41'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        report.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : report.status === 'CANCELLED'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>

                  {/* Auto-Purge Status */}
                  <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-xl flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{report.purgeCountdownText || (language === 'tl' ? 'Ligtas sa permanenteng Pi logbook' : 'Safely stored in permanent Pi logbook')}</span>
                  </div>

                  <div className="space-y-1 text-slate-600">
                    <div>
                      <strong>{language === 'tl' ? 'Address:' : 'Address:'}</strong> {report.purok} - {report.streetAddress || 'Cavite City'}
                    </div>
                    <div>
                      <strong>{language === 'tl' ? 'Uri:' : 'Type:'}</strong> {report.wasteTypes.join(', ')}
                    </div>
                    {report.extraMessage && (
                      <div className="italic text-emerald-800 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                        &quot;{report.extraMessage}&quot;
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex gap-1.5">
                      {report.photos?.length > 0 && (
                        <button
                          onClick={() =>
                            setLightboxState({
                              photos: report.photos,
                              index: 0,
                              title: `#${formatTicketNumber(report.ticketNumber)} • ${
                                language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                              }`,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-slate-500" />
                          <span>Photo ({report.photos.length})</span>
                        </button>
                      )}
                      {report.proofPhotos?.length > 0 && (
                        <button
                          onClick={() =>
                            setLightboxState({
                              photos: report.proofPhotos || [],
                              index: 0,
                              title: `#${formatTicketNumber(report.ticketNumber)} • ${
                                language === 'tl' ? 'Proeba ng Kagawad' : 'Official Proof'
                              }`,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Proof ({report.proofPhotos.length})</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {onDeleteReport && (
                        <button
                          onClick={() => onDeleteReport(report.id)}
                          className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title={language === 'tl' ? 'Burahin kung spam' : 'Delete if spam'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onViewReport(report)}
                        className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{language === 'tl' ? 'Mapa' : 'Map'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                {language === 'tl' ? 'Walang tala na tumutugma sa filter.' : 'No records match the filter.'}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{language === 'tl' ? 'Ticket / Residente' : 'Ticket / Resident'}</th>
                  <th className="py-3 px-4">{language === 'tl' ? 'Barangay & Lokasyon' : 'Barangay & Location'}</th>
                  <th className="py-3 px-4">{language === 'tl' ? 'Katayuan & Oras' : 'Status & Timestamp'}</th>
                  <th className="py-3 px-4">{language === 'tl' ? 'Litrato ng Residente' : 'Resident Photos'}</th>
                  <th className="py-3 px-4">{language === 'tl' ? 'Proeba ng Kagawad' : 'Official Proof'}</th>
                  <th className="py-3 px-4">{language === 'tl' ? 'Auto-Purge & Storage' : 'Auto-Purge & Storage'}</th>
                  <th className="py-3 px-4 text-right">{language === 'tl' ? 'Aksyon' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.length > 0 ? (
                  filtered.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 font-mono">
                          #{formatTicketNumber(report.ticketNumber)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {report.residentName || (language === 'tl' ? 'Residente' : 'Resident')}
                        </div>
                        {report.extraMessage && (
                          <div className="text-[10px] text-emerald-800 italic mt-0.5 max-w-xs truncate">
                            &quot;{report.extraMessage}&quot;
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mr-1 ${
                            report.barangay?.includes('40')
                              ? 'bg-cyan-100 text-cyan-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {report.barangay || 'Barangay 41'}
                        </span>
                        <div className="text-[11px] text-slate-700 mt-0.5 font-bold">
                          {report.purok}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {report.streetAddress || report.realtimeGpsAddress || 'Cavite City'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                            report.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : report.status === 'CANCELLED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {report.status}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {new Date(report.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {report.photos && report.photos.length > 0 ? (
                          <div className="flex gap-1.5 items-center">
                            {report.photos.slice(0, 3).map((p, idx) => (
                              <div
                                key={idx}
                                onClick={() =>
                                  setLightboxState({
                                    photos: report.photos,
                                    index: idx,
                                    title: `#${formatTicketNumber(report.ticketNumber)} • ${
                                      language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                                    }`,
                                  })
                                }
                                className="w-10 h-10 rounded-xl overflow-hidden border border-slate-300 shadow-2xs shrink-0"
                              >
                                <ResolvedPhoto src={p} className="w-full h-full" showExpandHint />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">{language === 'tl' ? 'Walang Litrato' : 'No Photos'}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {report.proofPhotos && report.proofPhotos.length > 0 ? (
                          <div className="flex gap-1.5 items-center">
                            {report.proofPhotos.slice(0, 3).map((p, idx) => (
                              <div
                                key={idx}
                                onClick={() =>
                                  setLightboxState({
                                    photos: report.proofPhotos || [],
                                    index: idx,
                                    title: `#${formatTicketNumber(report.ticketNumber)} • ${
                                      language === 'tl' ? 'Proeba ng Kagawad' : 'Official Proof'
                                    }`,
                                  })
                                }
                                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-2xs shrink-0"
                              >
                                <ResolvedPhoto src={p} alt="Proof" className="w-full h-full" showExpandHint />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">{language === 'tl' ? 'Wala pang proeba' : 'No proof yet'}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="font-bold text-slate-900">
                          ~{report.storageUsedMb || (report.photos.length * 0.8 + (report.proofPhotos?.length || 0) * 0.75).toFixed(2)} MB
                        </div>
                        <div className="text-[10px] text-amber-700 font-sans">
                          {report.purgeCountdownText || (report.status === 'RESOLVED' ? (language === 'tl' ? '1-araw auto-purge' : '1-day auto-purge') : (language === 'tl' ? '3-araw auto-purge' : '3-day auto-purge'))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => setSelectedReportDetail(report)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] transition-colors cursor-pointer"
                          title={language === 'tl' ? 'Tingnan ang buong detalye at litrato' : 'View full details and photos'}
                        >
                          {language === 'tl' ? 'Detalye' : 'Details'}
                        </button>
                        {onDeleteReport && (
                          <button
                            onClick={() => onDeleteReport(report.id)}
                            className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title={language === 'tl' ? 'Burahin ang ulat na ito' : 'Delete this report'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewReport(report)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title={language === 'tl' ? 'Tingnan sa mapa' : 'View on map'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {language === 'tl' ? 'Walang tala na tumutugma sa filter.' : 'No records match the filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* FULL REPORT DETAIL MODAL */}
      {selectedReportDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black font-mono text-purple-900 bg-purple-100 px-2.5 py-1 rounded-xl">
                  #{formatTicketNumber(selectedReportDetail.ticketNumber)}
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                    selectedReportDetail.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {selectedReportDetail.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedReportDetail(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  {language === 'tl' ? 'Hurisdiksyon & Lokasyon:' : 'Jurisdiction & Location:'}
                </div>
                <div className="font-extrabold text-slate-900">{selectedReportDetail.purok}</div>
                <div className="text-slate-600">{selectedReportDetail.streetAddress || 'Cavite City'}</div>
                <div className="text-[11px] font-mono text-purple-700">
                  GPS: {selectedReportDetail.coordinates.lat.toFixed(4)}, {selectedReportDetail.coordinates.lng.toFixed(4)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  {language === 'tl' ? 'Nagsampa / Residente:' : 'Reporter / Resident:'}
                </div>
                <div className="font-bold text-slate-900">{selectedReportDetail.residentName || (language === 'tl' ? 'Hindi ibinigay' : 'Not provided')}</div>
                <div className="text-slate-600">{language === 'tl' ? 'Telepono:' : 'Phone:'} {selectedReportDetail.residentPhone || 'N/A'}</div>
                {selectedReportDetail.isElderly && (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                    Senior Citizen / PWD
                  </span>
                )}
              </div>
            </div>

            {selectedReportDetail.extraMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 italic">
                &quot;{selectedReportDetail.extraMessage}&quot;
              </div>
            )}

            {/* Resident Photos */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-800">
                {language === 'tl' ? 'Litrato mula sa Residente' : 'Photos from Resident'} ({selectedReportDetail.photos?.length || 0}):
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedReportDetail.photos?.map((photo, i) => (
                  <div
                    key={i}
                    onClick={() =>
                      setLightboxState({
                        photos: selectedReportDetail.photos,
                        index: i,
                        title: `#${formatTicketNumber(selectedReportDetail.ticketNumber)} • ${
                          language === 'tl' ? 'Litrato ng Residente' : 'Resident Photo'
                        }`,
                      })
                    }
                    className="w-24 h-24 rounded-xl overflow-hidden border border-slate-300 shadow-xs"
                  >
                    <ResolvedPhoto src={photo} className="w-full h-full" showExpandHint />
                  </div>
                ))}
              </div>
            </div>

            {/* Kagawad Proof Photos */}
            {selectedReportDetail.proofPhotos && selectedReportDetail.proofPhotos.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    {language === 'tl'
                      ? `Katibayan / Proeba ng Kagawad (${selectedReportDetail.proofPhotos.length}):`
                      : `Official Proof of Cleanup (${selectedReportDetail.proofPhotos.length}):`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedReportDetail.proofPhotos.map((photo, i) => (
                    <div
                      key={i}
                      onClick={() =>
                        setLightboxState({
                          photos: selectedReportDetail.proofPhotos || [],
                          index: i,
                          title: `#${formatTicketNumber(selectedReportDetail.ticketNumber)} • ${
                            language === 'tl' ? 'Proeba ng Kagawad' : 'Official Proof'
                          }`,
                        })
                      }
                      className="w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-xs"
                    >
                      <ResolvedPhoto src={photo} alt="Proof" className="w-full h-full" showExpandHint />
                    </div>
                  ))}
                </div>
                {selectedReportDetail.resolutionNotes && (
                  <div className="p-2.5 bg-slate-100 rounded-xl text-xs text-slate-700">
                    <strong>{language === 'tl' ? 'Ulat ng Kagawad:' : 'Official Report:'}</strong>{' '}
                    {selectedReportDetail.resolutionNotes}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {onDeleteReport && (
                <button
                  onClick={() => {
                    const targetId = selectedReportDetail.id;
                    setSelectedReportDetail(null);
                    onDeleteReport(targetId);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{language === 'tl' ? 'Burahin ang Ticket' : 'Delete Ticket'}</span>
                </button>
              )}
              <button
                onClick={() => {
                  onViewReport(selectedReportDetail);
                  setSelectedReportDetail(null);
                }}
                className="ml-auto px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>{language === 'tl' ? 'Tingnan sa Mapa' : 'View on Map'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Photo Lightbox Viewer (z-[120] above Detail Modal) */}
      <PhotoLightboxModal
        isOpen={Boolean(lightboxState)}
        photos={lightboxState?.photos || []}
        initialIndex={lightboxState?.index || 0}
        title={lightboxState?.title}
        onClose={() => setLightboxState(null)}
      />

      {/* Custom Delete Saved Logbook Modal */}
      {logbookToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 rounded-2xl bg-rose-100">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </span>
              <div>
                <h4 className="font-black text-base text-slate-900">
                  {language === 'tl' ? 'Burahin ang Logbook Snapshot?' : 'Delete Logbook Snapshot?'}
                </h4>
                <p className="text-xs text-slate-500 font-mono truncate max-w-[220px]">
                  {logbookToDelete.filename}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setLogbookToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                onClick={confirmDeleteSavedLogbook}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-black text-xs text-white shadow-xs cursor-pointer"
              >
                {language === 'tl' ? 'Oo, Burahin' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Clear All Test Data Modal */}
      {confirmClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </span>
              <div>
                <h4 className="font-black text-base text-slate-900">
                  {language === 'tl' ? 'Linisin Lahat ng Test Records?' : 'Clear All Test Records?'}
                </h4>
                <p className="text-xs text-slate-500">
                  {language === 'tl'
                    ? 'Iha-handa ang database para sa malinis na produksyon'
                    : 'Resets active database for clean production use'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmClearAllModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Kanselahin' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  setConfirmClearAllModal(false);
                  if (onClearAllReports) {
                    await onClearAllReports();
                  } else {
                    await fetch('/api/reports/clear-all', { method: 'POST' });
                  }
                  soundAlert.playChime();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-black text-xs text-white shadow-xs cursor-pointer"
              >
                {language === 'tl' ? 'Oo, Linisin Lahat' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
