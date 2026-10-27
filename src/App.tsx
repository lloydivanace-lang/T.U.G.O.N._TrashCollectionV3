import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HouseholdView } from './components/HouseholdView';
import { KagawadDashboard } from './components/KagawadDashboard';
import { CalibrationModal } from './components/CalibrationModal';
import { WasteReport } from './types';
import { soundAlert } from './utils/audioAlarm';
import { useLanguage } from './context/LanguageContext';
import {
  pushReportsToLanPiIfConfigured,
  hydratePiEndpointOnBoot,
  fetchUnifiedReports,
  updateUnifiedReportStatus,
  deleteUnifiedReport,
  clearAllUnifiedReports,
} from './utils/piBridge';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'resident' | 'kagawad'>(() => {
    try {
      return (
        localStorage.getItem('pulse_kagawad_auth') === 'true' ||
        localStorage.getItem('trash_kagawad_auth') === 'true' ||
        localStorage.getItem('draw_kagawad_auth') === 'true'
      )
        ? 'kagawad'
        : 'resident';
    } catch {
      return 'resident';
    }
  });
  const { language } = useLanguage();
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [activeStorageMode, setActiveStorageMode] = useState<'pi' | 'cloud'>('pi');
  const [, setScreenRefreshKey] = useState(0);

  // Fetch authoritative Barangay queue only when viewing Barangay Official Portal
  const fetchReports = async () => {
    if (currentRole !== 'kagawad') return;
    try {
      const { reports: fetched } = await fetchUnifiedReports(language);
      setReports(fetched);
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    }
  };

  // Hydrate server/edge/query-param Raspberry Pi endpoint on initial app load
  useEffect(() => {
    hydratePiEndpointOnBoot().catch(() => {});
  }, []);

  // Poll for updates every 3 seconds when in Barangay Official Portal
  useEffect(() => {
    if (currentRole !== 'kagawad') return;
    fetchReports();
    const interval = setInterval(fetchReports, 3000);
    return () => clearInterval(interval);
  }, [currentRole, language]);

  // Handle new submission from household
  const handleReportSubmitted = (newReport: WasteReport) => {
    if (newReport.localSyncStatus === 'SENT_TO_PI') {
      setReports((prev) => {
        const next = [newReport, ...prev.filter((r) => r.id !== newReport.id)];
        pushReportsToLanPiIfConfigured(next);
        return next;
      });
    }
    if (newReport.isElderly || newReport.urgency === 'URGENT_ELDERLY') {
      soundAlert.playUrgentAlarm();
    } else {
      soundAlert.playChime();
    }
  };

  // Handle Official status update with mandatory proof photos
  const handleUpdateReportStatus = async (
    id: string,
    status: 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED',
    notes?: string,
    proofPhotos?: string[],
    proofKagawadName?: string
  ) => {
    try {
      const defaultOfficialName =
        language === 'tl'
          ? 'Barangay Kagawad at Cavite City Sanitation Crew'
          : 'Barangay Official & Cavite City Sanitation Crew';

      const data = await updateUnifiedReportStatus(id, {
        status,
        lang: language,
        resolvedBy: proofKagawadName || defaultOfficialName,
        resolutionNotes: status === 'RESOLVED' ? notes : undefined,
        cancellationReason: status === 'CANCELLED' ? notes : undefined,
        proofPhotos: status === 'RESOLVED' ? proofPhotos : undefined,
        proofKagawadName: status === 'RESOLVED' ? proofKagawadName : undefined,
      });
      if (data.success && data.report) {
        setReports((prev) => prev.map((r) => (r.id === id ? data.report! : r)));
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  // Handle Deletion of Report from Official Queue (Never deletes resident's private phone log)
  const handleDeleteReport = async (id: string) => {
    try {
      const ok = await deleteUnifiedReport(id);
      if (ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete report:', e);
    }
  };

  const handleClearAllReports = async () => {
    try {
      await clearAllUnifiedReports();
      setReports([]);
    } catch (e) {
      console.error('Failed to clear all reports:', e);
    }
  };

  const handleScreenCalibrate = () => {
    setScreenRefreshKey((k) => k + 1);
  };

  // Pending count excludes auto-purged items from active queue
  const pendingCount = reports.filter((r) => r.status === 'PENDING' && !r.isPurgedFromFeed).length;

  return (
    <div className="adaptive-app-shell bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Application Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        pendingCount={pendingCount}
        onScreenCalibrate={handleScreenCalibrate}
      />

      {/* Adaptive Screen Calibration Modal */}
      <CalibrationModal />

      {/* Main View Body */}
      <main className="flex-1 w-full max-w-full overflow-x-clip pb-16">
        {currentRole === 'resident' ? (
          <HouseholdView
            onReportSubmitted={handleReportSubmitted}
            activeStorageMode={activeStorageMode}
          />
        ) : (
          <KagawadDashboard
            reports={reports}
            onUpdateReportStatus={handleUpdateReportStatus}
            onDeleteReport={handleDeleteReport}
            onClearAllReports={handleClearAllReports}
            activeStorageMode={activeStorageMode}
            onToggleStorageMode={() =>
              setActiveStorageMode(activeStorageMode === 'pi' ? 'cloud' : 'pi')
            }
          />
        )}
      </main>

      {/* Clean Footer (Removed "Serbisyo sa Koleksyon ng Basura") */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <span className="font-extrabold text-slate-800 text-sm">
              T.U.G.O.N.
            </span>
            <p className="text-[11px] text-slate-400">
              {language === 'tl'
                ? 'Barangay 40 (Gumamela) at Barangay 41 (Rosal), Lungsod ng Cavite'
                : 'Barangay 40 (Gumamela) & Barangay 41 (Rosal), Cavite City'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-[11px] text-slate-500">
            <span className="text-emerald-700 font-extrabold">
              Barangay 40 (Gumamela) &amp; 41 (Rosal), Cavite City
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
