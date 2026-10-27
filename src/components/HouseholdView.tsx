import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Trash2,
  CheckCircle2,
  Navigation,
  FolderHeart,
  Plus,
  X,
  Check,
  ShieldCheck,
  Cloud,
  CloudOff,
  Smartphone,
  Eye,
  MessageSquare,
  Clock,
  RotateCcw,
  Compass,
  Send,
  RefreshCw,
} from 'lucide-react';
import { WasteReport, SeverityLevel } from '../types';
import { soundAlert } from '../utils/audioAlarm';
import { useLanguage } from '../context/LanguageContext';
import { useLocation } from '../context/LocationContext';
import { LiveCameraModal } from './LiveCameraModal';
import { StreetView360, StreetViewTarget, BRGY_40_HALL, BRGY_41_HALL } from './StreetView360';
import { PhotoLightboxModal, ResolvedPhoto } from './PhotoLightboxModal';
import {
  compressImage,
  isValidPhotoSrc,
  generateTicketNumber,
  formatTicketNumber,
} from '../utils/imageCompressor';
import { BRGY_40_HALL_COORDS, BRGY_41_HALL_COORDS } from '../utils/jurisdiction';
import {
  getOrCreateDeviceId,
  getAllDeviceReports,
  saveDeviceReport,
  deleteDeviceReport,
  clearAllDeviceReports,
  mergeServerUpdatesIntoDeviceReports,
} from '../utils/residentStorage';
import { fetchUnifiedReports, submitUnifiedReport } from '../utils/piBridge';
import {
  ThreeDHouseholdTrash,
  ThreeDBulkyFurniture,
  ThreeDYardGarden,
  ThreeDHazardous,
  ThreeDCamera,
  ThreeDFolderGallery,
  ThreeDSeverityMild,
  ThreeDSeverityModerate,
  ThreeDSeverityOverflowing,
  ThreeDSeverityEmergency,
  ThreeDSeniorHeart,
  ThreeDAssistanceBeacon,
  ThreeDLocationPin,
  ThreeDBarangayHall,
  ThreeDCheckShield,
} from './ThreeDIcons';

interface HouseholdViewProps {
  onReportSubmitted: (newReport: WasteReport) => void;
  activeStorageMode?: 'pi' | 'cloud';
}

const COMMON_WASTE_BUTTONS = [
  {
    id: 'household',
    title: 'Household Trash',
    tagalog: 'Pang-araw-araw na Basura',
    IconComponent: ThreeDHouseholdTrash,
  },
  {
    id: 'bulky',
    title: 'Bulky Waste / Furniture',
    tagalog: 'Sirang Gamit / Kahoy / Kutson',
    IconComponent: ThreeDBulkyFurniture,
  },
  {
    id: 'yard',
    title: 'Yard & Garden Trimmings',
    tagalog: 'Dahon / Sangang Pinutol',
    IconComponent: ThreeDYardGarden,
  },
  {
    id: 'hazardous',
    title: 'Hazardous / E-Waste',
    tagalog: 'Baterya, Ilaw, Sirang Appliances',
    IconComponent: ThreeDHazardous,
  },
];

const SEVERITY_LEVELS: {
  id: SeverityLevel;
  label: string;
  tagalog: string;
  color: string;
  IconComponent: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'MILD',
    label: 'Mild (1-2 bags)',
    tagalog: 'Banayad / 1-2 sako lamang',
    color: 'border-emerald-400 bg-emerald-50 text-emerald-900',
    IconComponent: ThreeDSeverityMild,
  },
  {
    id: 'MODERATE',
    label: 'Moderate (3-5 bags)',
    tagalog: 'Katamtaman (3-5 sako)',
    color: 'border-amber-400 bg-amber-50 text-amber-900',
    IconComponent: ThreeDSeverityModerate,
  },
  {
    id: 'OVERFLOWING',
    label: 'Overflowing / Severe Pile',
    tagalog: 'Malala / Umaapaw na Basura',
    color: 'border-rose-500 bg-rose-50 text-rose-900',
    IconComponent: ThreeDSeverityOverflowing,
  },
  {
    id: 'EMERGENCY',
    label: 'Emergency / Hazardous',
    tagalog: 'Emergency / Delikado o Nakaharang',
    color: 'border-red-600 bg-red-100 text-red-950 font-bold',
    IconComponent: ThreeDSeverityEmergency,
  },
];

const BARANGAY_OPTIONS = [
  { value: 'Barangay 41 (Rosal), Cavite City', label: 'Barangay 41 (Rosal), Cavite City' },
  { value: 'Barangay 40 (Gumamela), Cavite City', label: 'Barangay 40 (Gumamela), Cavite City' },
];

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  onReportSubmitted,
}) => {
  const { language, t } = useLanguage();
  const [residentTab, setResidentTab] = useState<'form' | 'my_storage'>('form');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Household Trash']);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string>('');
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>('MODERATE');
  const [isElderly, setIsElderly] = useState(false);
  const [needsAssistanceOutside, setNeedsAssistanceOutside] = useState(false);
  const [barangay, setBarangay] = useState('Barangay 41 (Rosal), Cavite City');
  const [purok, setPurok] = useState('Barangay 41 (Rosal), Cavite City');
  const [streetAddress, setStreetAddress] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [residentName, setResidentName] = useState('');
  const [notes, setNotes] = useState('');
  const [extraMessage, setExtraMessage] = useState('');

  const userEditedStreetRef = useRef(false);
  const userEditedHouseRef = useRef(false);

  const {
    coords,
    address: liveGpsAddress,
    detectedStreet: liveDetectedStreet,
    detectedHouseNumber: liveDetectedHouseNumber,
    accuracy: liveGpsAccuracy,
    isRefining: isGpsRefining,
    isEnabled: isLocationEnabled,
    status: locationStatus,
    isWithinJurisdiction: gpsWithinJurisdiction,
    detectedBarangay: gpsDetectedBarangay,
    errorMessage: locationErrorMessage,
    requestLocation,
    refreshLocation,
    resetLocation,
    setManualLocation,
    setPinpointLocation,
  } = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryingReportId, setRetryingReportId] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<WasteReport | null>(null);
  const [savedLocallyNoticeTicket, setSavedLocallyNoticeTicket] = useState<WasteReport | null>(null);
  const [piServerOnline, setPiServerOnline] = useState<boolean | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<{
    reportId: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const [lightboxState, setLightboxState] = useState<{
    photos: string[];
    index: number;
    title?: string;
  } | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<WasteReport | null>(null);
  const [streetViewModalTarget, setStreetViewModalTarget] = useState<StreetViewTarget | null>(null);

  // Resident's Personal Per-Device Storage (IndexedDB isolated per phone device)
  const [myStoredReports, setMyStoredReports] = useState<WasteReport[]>([]);
  const myStoredReportsRef = useRef<WasteReport[]>([]);

  useEffect(() => {
    myStoredReportsRef.current = myStoredReports;
  }, [myStoredReports]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);

  // Initial load from this phone's private IndexedDB storage
  useEffect(() => {
    let active = true;
    getAllDeviceReports().then((loaded) => {
      if (active) {
        setMyStoredReports(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Poll ONLY this device's own report IDs for status/proof updates (never downloads other phones' reports)
  const syncPersonalReports = useCallback(async () => {
    try {
      const localList = await getAllDeviceReports();
      const ids = localList.map((r) => r.id).filter(Boolean);

      const { reports: matchedReports, piOnline } = await fetchUnifiedReports(language, ids);
      if (piOnline !== null) {
        setPiServerOnline(piOnline);
      }

      if (ids.length === 0) {
        setMyStoredReports(localList);
        return;
      }

      if (Array.isArray(matchedReports) && matchedReports.length > 0) {
        const merged = await mergeServerUpdatesIntoDeviceReports(matchedReports);
        setMyStoredReports(merged);
      }
    } catch {
      // Offline / network glitch: device's own IndexedDB records remain 100% intact
    }
  }, [language]);

  useEffect(() => {
    syncPersonalReports();
    const interval = setInterval(syncPersonalReports, 6000);
    return () => clearInterval(interval);
  }, [syncPersonalReports]);

  // Sync detected barangay & street with form selection
  useEffect(() => {
    if (gpsDetectedBarangay) {
      const full =
        gpsDetectedBarangay === 'Barangay 40'
          ? 'Barangay 40 (Gumamela), Cavite City'
          : 'Barangay 41 (Rosal), Cavite City';
      setBarangay(full);
      setPurok(full);
    }
  }, [gpsDetectedBarangay]);

  useEffect(() => {
    if (liveDetectedStreet && !userEditedStreetRef.current) {
      setStreetAddress(liveDetectedStreet);
    }
  }, [liveDetectedStreet]);

  useEffect(() => {
    if (liveDetectedHouseNumber && !userEditedHouseRef.current) {
      setHouseNumber(liveDetectedHouseNumber);
    }
  }, [liveDetectedHouseNumber]);

  // Sync assistance flag if detected outside
  useEffect(() => {
    if (isLocationEnabled && coords) {
      if (!gpsWithinJurisdiction) {
        setNeedsAssistanceOutside(true);
      } else {
        setNeedsAssistanceOutside(false);
      }
    }
  }, [isLocationEnabled, coords, gpsWithinJurisdiction]);

  const toggleWasteType = (typeTitle: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeTitle)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== typeTitle);
      } else {
        return [...prev, typeTitle];
      }
    });
  };

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = 15 - photos.length;
    if (remainingSlots <= 0) {
      setPhotoError(
        language === 'tl'
          ? 'Naabot na ang limitasyon na 15 litrato.'
          : 'The 15-photo limit has been reached.'
      );
      return;
    }
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const validBatch: string[] = [];
    for (const file of filesToProcess) {
      try {
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        if (compressed && isValidPhotoSrc(compressed)) {
          validBatch.push(compressed);
        }
      } catch (err) {
        console.warn('Error reading photo:', err);
      }
    }
    if (validBatch.length > 0) {
      setPhotos((prev) => [...prev, ...validBatch]);
      setPhotoError('');
    } else {
      setPhotoError(
        language === 'tl'
          ? 'Hindi mabasa ang napiling litrato. Pumili ng valid na JPEG o PNG na litrato.'
          : 'Could not read the selected image. Please choose a valid JPEG or PNG photo.'
      );
    }
  };

  const handleLiveCameraCapture = async (dataUrl: string) => {
    if (photos.length >= 15) {
      setPhotoError(
        language === 'tl'
          ? 'Naabot na ang limitasyon na 15 litrato.'
          : 'The 15-photo limit has been reached.'
      );
      return;
    }
    const finalPhoto = isValidPhotoSrc(dataUrl)
      ? dataUrl
      : await compressImage(dataUrl, 1200, 1200, 0.8);
    if (!isValidPhotoSrc(finalPhoto)) {
      setPhotoError(
        language === 'tl'
          ? 'Hindi nakuha nang maayos ang litrato. Pakisubukan muli.'
          : 'Could not capture photo properly. Please try again.'
      );
      return;
    }
    setPhotos((prev) => [...prev, finalPhoto]);
    setPhotoError('');
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const openInteractiveStreetView = (reportItem?: WasteReport) => {
    if (reportItem) {
      const isB40 =
        reportItem.barangay?.includes('40') || reportItem.purok?.includes('40');
      setStreetViewModalTarget({
        id: `res-${reportItem.id}`,
        lat: reportItem.coordinates?.lat || (isB40 ? BRGY_40_HALL_COORDS[0] : BRGY_41_HALL_COORDS[0]),
        lng: reportItem.coordinates?.lng || (isB40 ? BRGY_40_HALL_COORDS[1] : BRGY_41_HALL_COORDS[1]),
        title: `#${formatTicketNumber(reportItem.ticketNumber)}`,
        barangay: isB40 ? 'Barangay 40' : 'Barangay 41',
        street: reportItem.streetAddress || reportItem.realtimeGpsAddress || reportItem.purok,
        landmark:
          reportItem.houseNumber ||
          (language === 'tl' ? 'Lokasyon ng Ulat' : 'Reported Location'),
      });
      return;
    }

    if (isLocationEnabled && coords) {
      const isB40 =
        gpsDetectedBarangay === 'Barangay 40' || barangay.includes('40');
      setStreetViewModalTarget({
        id: 'resident-live-pin',
        lat: coords.lat,
        lng: coords.lng,
        title:
          language === 'tl'
            ? 'Kasalukuyang Lokasyon Mo'
            : 'Your Current Location',
        barangay: isB40 ? 'Barangay 40' : 'Barangay 41',
        street: liveGpsAddress || streetAddress || barangay,
        landmark:
          houseNumber ||
          (language === 'tl' ? 'Live Satellite GPS Pin' : 'Live Satellite GPS Pin'),
      });
      return;
    }

    setStreetViewModalTarget(barangay.includes('40') ? BRGY_40_HALL : BRGY_41_HALL);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      setPhotoError(
        language === 'tl'
          ? 'Kinakailangan kumuha o mag-attach ng sariling litrato ng basura. Bawal ang mag-submit nang walang litrato.'
          : 'A waste photo is required. Submission without a photo is not allowed.'
      );
      return;
    }
    setPhotoError('');
    setIsSubmitting(true);

    const deviceId = getOrCreateDeviceId();
    const hasLiveGps = Boolean(isLocationEnabled && coords);
    const isOutsideOrFlagged =
      needsAssistanceOutside || (hasLiveGps && !gpsWithinJurisdiction);
    const finalTypes = [...selectedTypes];
    if (
      isOutsideOrFlagged &&
      !finalTypes.includes('Nangangailangan ng assistance') &&
      !finalTypes.includes('Special Assistance Needed')
    ) {
      finalTypes.push(
        language === 'tl' ? 'Nangangailangan ng assistance' : 'Special Assistance Needed'
      );
    }
    if (isElderly && !finalTypes.includes('Senior Citizen Priority')) {
      finalTypes.push('Senior Citizen Priority');
    }

    const finalCoords = hasLiveGps
      ? coords!
      : barangay.includes('40')
      ? { lat: BRGY_40_HALL_COORDS[0], lng: BRGY_40_HALL_COORDS[1] }
      : { lat: BRGY_41_HALL_COORDS[0], lng: BRGY_41_HALL_COORDS[1] };

    const finalAddress =
      hasLiveGps && liveGpsAddress
        ? liveGpsAddress
        : streetAddress
        ? `${streetAddress}, ${barangay}`
        : `${barangay} (${
            language === 'tl'
              ? 'Manu-manong address - Walang GPS data'
              : 'Manual address - No GPS data'
          })`;

    const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const draftTicketNum = generateTicketNumber();
    const createdAtIso = new Date().toISOString();

    const draftReport: WasteReport = {
      id: reportId,
      deviceId,
      ticketNumber: draftTicketNum,
      createdAt: createdAtIso,
      residentName: residentName.trim(),
      residentPhone: 'N/A',
      isElderly,
      severityLevel,
      purok: purok || `${barangay}`,
      barangay: barangay.includes('40')
        ? 'Barangay 40 (Gumamela)'
        : 'Barangay 41 (Rosal)',
      streetAddress: streetAddress.trim(),
      houseNumber: houseNumber.trim(),
      coordinates: finalCoords,
      autoGpsAccurate: hasLiveGps,
      realtimeGpsAddress: finalAddress,
      isWithinBrgy41: barangay.includes('41'),
      isWithinJurisdiction: !isOutsideOrFlagged,
      needsAssistanceOutside: isOutsideOrFlagged,
      wasteTypes: finalTypes,
      urgency: isElderly
        ? 'URGENT_ELDERLY'
        : severityLevel === 'EMERGENCY'
        ? 'HIGH'
        : 'NORMAL',
      estimatedBags: `${severityLevel}`,
      photos,
      proofPhotos: [],
      notes: notes.trim(),
      extraMessage: extraMessage.trim(),
      status: 'PENDING',
      sourceStorage: 'Device Local Storage (Waiting for Pi Cloud Server)',
      localSyncStatus: 'SAVED_ON_DEVICE',
    };

    // Always persist to this resident's own phone IndexedDB first so it is NEVER lost even without Pi!
    await saveDeviceReport(draftReport);

    try {
      const result = await submitUnifiedReport(draftReport, language);

      if (result.ok && result.report) {
        const syncedReport: WasteReport = {
          ...draftReport,
          ...result.report,
          deviceId,
          photos: draftReport.photos,
          localSyncStatus: 'SENT_TO_PI',
        };
        await saveDeviceReport(syncedReport);
        const refreshed = await getAllDeviceReports();
        setMyStoredReports(refreshed);
        setPiServerOnline(true);
        setSubmittedTicket(syncedReport);
        onReportSubmitted(syncedReport);
        soundAlert.playChime();
      } else if (result.piOffline) {
        // Pi Cloud Server is offline: report & photos stay safely saved on this phone's private storage!
        const refreshed = await getAllDeviceReports();
        setMyStoredReports(refreshed);
        setPiServerOnline(false);
        setSavedLocallyNoticeTicket(draftReport);
        soundAlert.playChime();
      } else {
        const refreshed = await getAllDeviceReports();
        setMyStoredReports(refreshed);
        setPhotoError(
          result.error ||
            (language === 'tl'
              ? 'Nagkaroon ng problema sa pag-submit. Naka-save na ang kopya sa iyong phone.'
              : 'Submission error. A copy has been safely saved to your phone.')
        );
      }
    } catch {
      const refreshed = await getAllDeviceReports();
      setMyStoredReports(refreshed);
      setPiServerOnline(false);
      setSavedLocallyNoticeTicket(draftReport);
      soundAlert.playChime();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetrySendToPi = async (reportItem: WasteReport) => {
    setRetryingReportId(reportItem.id);
    setRetryFeedback(null);
    try {
      const result = await submitUnifiedReport(reportItem, language);

      if (result.ok && result.report) {
        const synced: WasteReport = {
          ...reportItem,
          ...result.report,
          deviceId: getOrCreateDeviceId(),
          photos: reportItem.photos,
          localSyncStatus: 'SENT_TO_PI',
        };
        await saveDeviceReport(synced);
        const refreshed = await getAllDeviceReports();
        setMyStoredReports(refreshed);
        setPiServerOnline(true);
        onReportSubmitted(synced);
        soundAlert.playChime();
        setRetryFeedback({
          reportId: reportItem.id,
          ok: true,
          message:
            language === 'tl'
              ? 'Matagumpay na naipadala sa Raspberry Pi Cloud Server at sa Barangay Officials!'
              : 'Successfully sent to the Raspberry Pi Cloud Server and Barangay Officials!',
        });
      } else {
        setPiServerOnline(false);
        setRetryFeedback({
          reportId: reportItem.id,
          ok: false,
          message:
            result.error ||
            (language === 'tl'
              ? 'Naka-offline pa rin ang Raspberry Pi Cloud Server. Mananatiling ligtas ang ulat sa iyong phone.'
              : 'Raspberry Pi Cloud Server is still offline. Your report remains safely saved on your phone.'),
        });
      }
    } catch {
      setRetryFeedback({
        reportId: reportItem.id,
        ok: false,
        message:
          language === 'tl'
            ? 'Hindi pa maabot ang Raspberry Pi Cloud Server sa ngayon.'
            : 'Cannot reach the Raspberry Pi Cloud Server right now.',
      });
    } finally {
      setRetryingReportId(null);
    }
  };

  const handleResetForm = () => {
    setSubmittedTicket(null);
    setSavedLocallyNoticeTicket(null);
    setPhotos([]);
    setNotes('');
    setExtraMessage('');
    setIsElderly(false);
    setSeverityLevel('MODERATE');
    setPurok('Barangay 41 (Rosal), Cavite City');
    userEditedStreetRef.current = false;
    userEditedHouseRef.current = false;
    setStreetAddress(liveDetectedStreet || '');
    setHouseNumber(liveDetectedHouseNumber || '');
    setResidentName('');
    setNeedsAssistanceOutside(false);
  };

  const handleConfirmClearAll = async () => {
    await clearAllDeviceReports();
    setMyStoredReports([]);
    setIsConfirmingClearAll(false);
    soundAlert.playChime();
  };

  const handleConfirmDeleteSingle = async () => {
    if (!reportToDelete) return;
    const updated = await deleteDeviceReport(reportToDelete.id);
    setMyStoredReports(updated);
    setReportToDelete(null);
    soundAlert.playChime();
  };

  // Saved Locally (Pi Cloud Server Offline) Notice View
  if (savedLocallyNoticeTicket) {
    return (
      <div className="w-full max-w-md sm:max-w-xl mx-auto py-6 sm:py-10 px-3 sm:px-6 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-200 text-center space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Smartphone className="w-9 h-9 sm:w-11 sm:h-11" />
          </div>
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 font-mono">
            {t.household.ticketNumberLabel}: #{formatTicketNumber(savedLocallyNoticeTicket.ticketNumber)}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {language === 'tl'
              ? 'Naka-save sa Iyong Sariling Cellphone!'
              : 'Saved to Your Personal Phone Storage!'}
          </h2>
          <p className="text-xs sm:text-sm text-amber-800 font-bold leading-relaxed">
            {language === 'tl'
              ? 'Kasalukuyang offline ang Raspberry Pi Cloud Server kaya hindi pa maipapadala ang mga litrato sa Barangay Officials.'
              : 'The Raspberry Pi Cloud Server is currently offline, so photos cannot be transmitted to Barangay Officials yet.'}
          </p>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700 space-y-1.5">
            <div className="font-extrabold flex items-center gap-1.5 text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {language === 'tl'
                  ? 'Pribadong Storage sa Iyong Telepono:'
                  : 'Private On-Device Storage:'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {language === 'tl'
                ? 'Hinding-hindi mawawala ang ulat at mga litrato mo sa "Aking Mga Ulat". Sa oras na mag-online ang Raspberry Pi Cloud Server, pindutin lamang ang "Ipasa sa Barangay Ngayon" upang makita ito ng mga Barangay Officials.'
                : 'Your report and photos are permanently stored inside "My Reports" on this device. Once the Raspberry Pi Cloud Server comes online, simply tap "Send to Barangay Now" so Barangay Officials can view and dispatch it.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={() => {
                handleResetForm();
                setResidentTab('my_storage');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderHeart className="w-4 h-4" />
              <span>
                {language === 'tl'
                  ? 'Buksan ang Aking Mga Ulat'
                  : 'Open My Reports'}
              </span>
            </button>
            <button
              onClick={handleResetForm}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {language === 'tl' ? 'Gumawa ng Bagong Ulat' : 'Create Another Report'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Submission success view (Sent through Raspberry Pi Cloud Server)
  if (submittedTicket) {
    return (
      <div className="w-full max-w-md sm:max-w-xl mx-auto py-6 sm:py-10 px-3 sm:px-6 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-100 text-center space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 font-mono">
            {t.household.ticketNumberLabel}: #{formatTicketNumber(submittedTicket.ticketNumber)}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {t.household.successModalTitle}
          </h2>
          <p className="text-sm sm:text-base text-emerald-700 font-bold">
            {t.household.successModalSubtitle}
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 space-y-1">
            <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>
                {language === 'tl'
                  ? 'Aksyon ng Kagawad & Pribadong Phone Storage:'
                  : 'Official Action & Private Phone Storage:'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {language === 'tl'
                ? 'Naka-save ang ticket na ito sa sariling storage ng iyong telepono at naipasa na sa Raspberry Pi Cloud Server. Bago ma-resolve ng Kagawad, obligado silang mag-attach ng litrato ng katibayan na nalinis na.'
                : 'This ticket is saved privately in your device storage and transmitted to the Raspberry Pi Cloud Server. Before resolving, Barangay Officials must attach photographic proof of cleanup.'}
            </p>
          </div>
          {submittedTicket.extraMessage && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700">
              <span className="font-bold block text-slate-900">
                {language === 'tl' ? 'Iyong Karagdagang Mensahe:' : 'Your Additional Message:'}
              </span>
              <p className="italic mt-0.5">&quot;{submittedTicket.extraMessage}&quot;</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-3">
            <button
              onClick={() => {
                handleResetForm();
                setResidentTab('my_storage');
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FolderHeart className="w-4 h-4 text-emerald-600" />
              <span>{t.household.myReportsTab}</span>
            </button>
            <button
              onClick={handleResetForm}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'tl' ? 'Mag-report ng Panibago' : 'Report Another'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingUnsentCount = myStoredReports.filter(
    (r) => r.localSyncStatus === 'SAVED_ON_DEVICE'
  ).length;

  return (
    <div className="w-full max-w-2xl lg:max-w-3xl mx-auto py-4 sm:py-6 px-3 sm:px-6">
      {/* Resident Sub-Tabs */}
      <div className="mb-4 sm:mb-6 flex p-1 bg-slate-200/80 rounded-2xl">
        <button
          onClick={() => setResidentTab('form')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            residentTab === 'form'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-600" />
          <span>{t.household.reportWasteTab}</span>
        </button>
        <button
          onClick={() => setResidentTab('my_storage')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            residentTab === 'my_storage'
              ? 'bg-white text-emerald-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderHeart className="w-4 h-4 text-emerald-600" />
          <span>
            {t.household.myReportsTab} ({myStoredReports.length})
          </span>
          {pendingUnsentCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white">
              {pendingUnsentCount}
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: RESIDENT'S PRIVATE PER-DEVICE STORAGE (ON THIS PHONE ONLY) */}
      {residentTab === 'my_storage' ? (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>
                  {language === 'tl'
                    ? 'Aking Mga Ulat (Sariling Storage ng Device)'
                    : 'My Reports (Private Device Storage)'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {language === 'tl'
                  ? 'Hiwalay at pribado ang storage sa bawat cellphone. Tanging ikaw lamang ang makakakita at makakabura ng iyong mga ulat dito kahit naka-offline ang Pi.'
                  : 'Storage is isolated and private per phone device. Only you can view or clear your records here, even when the Pi Cloud Server is offline.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {myStoredReports.length > 0 &&
                (isConfirmingClearAll ? (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-300 p-1 rounded-xl animate-in fade-in">
                    <span className="text-[11px] font-bold text-red-900 px-1">
                      {language === 'tl' ? 'Burahin lahat?' : 'Clear all?'}
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmClearAll}
                      className="text-[11px] font-black bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 shadow-sm"
                    >
                      {language === 'tl' ? 'Oo, Burahin' : 'Yes, Clear'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearAll(false)}
                      className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-lg border border-slate-300 cursor-pointer"
                    >
                      {language === 'tl' ? 'Kansela' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(true)}
                    className="text-[11px] font-black text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                    title={
                      language === 'tl'
                        ? 'Linisin ang lahat ng rekord sa iyong cellphone'
                        : 'Clear all records from your phone'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'tl' ? 'I-clear Lahat' : 'Clear All'}</span>
                  </button>
                ))}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                {myStoredReports.length} {language === 'tl' ? 'Tala' : 'Records'}
              </span>
            </div>
          </div>

          {/* Live Pi Cloud Server Connection Status Banner */}
          <div
            className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-3 ${
              piServerOnline === false
                ? 'bg-amber-950 text-amber-100 border border-amber-800'
                : 'bg-slate-900 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {piServerOnline === false ? (
                <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="text-[11px] leading-snug">
                {piServerOnline === false
                  ? language === 'tl'
                    ? 'Pi Cloud Server: Offline — Naka-save sa phone mo ang mga ulat; ipadala kapag online na ang Pi.'
                    : 'Pi Cloud Server: Offline — Reports stay saved on your phone; send once Pi is online.'
                  : language === 'tl'
                  ? 'Pi Cloud Server: Nakakonekta para sa pagpapadala ng mga litrato sa Barangay'
                  : 'Pi Cloud Server: Connected for transmitting report photos to Barangay Officials'}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                piServerOnline === false
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {piServerOnline === false
                ? language === 'tl'
                  ? 'PI OFFLINE'
                  : 'PI OFFLINE'
                : language === 'tl'
                ? 'HANDA'
                : 'READY'}
            </span>
          </div>

          {myStoredReports.length > 0 ? (
            <div className="space-y-4">
              {myStoredReports.map((item) => {
                const isWaitingForPi = item.localSyncStatus === 'SAVED_ON_DEVICE';
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border space-y-3 shadow-2xs transition-colors ${
                      isWaitingForPi
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-slate-200 bg-slate-50 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-mono font-black text-sm text-slate-900">
                          #{formatTicketNumber(item.ticketNumber)}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-2">
                          {new Date(item.createdAt).toLocaleDateString()}{' '}
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(item.needsAssistanceOutside || item.isWithinJurisdiction === false) && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                            {language === 'tl' ? 'TULONG' : 'ASSISTANCE'}
                          </span>
                        )}
                        {isWaitingForPi ? (
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-200 text-amber-950 border border-amber-400">
                            {language === 'tl'
                              ? 'NAKA-SAVE SA PHONE (HINDI PA NAIPADALA)'
                              : 'SAVED ON PHONE (NOT SENT YET)'}
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
                              item.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.status === 'DISPATCHED'
                                ? 'bg-sky-100 text-sky-800 border border-sky-300'
                                : item.status === 'CANCELLED'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {item.status === 'RESOLVED' && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {item.status === 'RESOLVED'
                              ? language === 'tl'
                                ? 'NA-RESOLBA (MAY PROEBA)'
                                : 'RESOLVED (WITH PROOF)'
                              : item.status === 'DISPATCHED'
                              ? language === 'tl'
                                ? 'IPINADALA NA ANG KOLEKTOR'
                                : 'CREW DISPATCHED'
                              : item.status === 'CANCELLED'
                              ? language === 'tl'
                                ? 'KINANSELA'
                                : 'CANCELLED'
                              : 'PENDING'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Retry Send to Pi Cloud Server Banner when saved locally */}
                    {isWaitingForPi && (
                      <div className="p-3 rounded-xl bg-amber-100/80 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <p className="text-[11px] font-bold text-amber-950 leading-snug">
                          {language === 'tl'
                            ? 'Naka-save na ito sa iyong phone. Ipadala kapag online na ang Raspberry Pi Cloud Server upang makita ng Barangay Officials.'
                            : 'Saved on your phone. Send once the Raspberry Pi Cloud Server is online so Barangay Officials can receive the photos.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRetrySendToPi(item)}
                          disabled={retryingReportId === item.id}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {retryingReportId === item.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {retryingReportId === item.id
                              ? language === 'tl'
                                ? 'Ipinapadala...'
                                : 'Sending...'
                              : language === 'tl'
                              ? 'Ipasa sa Barangay Ngayon'
                              : 'Send to Barangay Now'}
                          </span>
                        </button>
                      </div>
                    )}

                    {retryFeedback && retryFeedback.reportId === item.id && (
                      <div
                        className={`p-2.5 rounded-xl text-[11px] font-bold ${
                          retryFeedback.ok
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-50 text-rose-900 border border-rose-300'
                        }`}
                      >
                        {retryFeedback.message}
                      </div>
                    )}

                    {/* Retention / Persistence Notice */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {language === 'tl'
                          ? 'Permanenteng naka-save sa sariling storage ng iyong phone at hindi mabubura ng ibang device.'
                          : 'Permanently saved in your private phone storage and isolated from other devices.'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <strong>{language === 'tl' ? 'Lokasyon:' : 'Location:'}</strong>{' '}
                        {item.purok} ({item.streetAddress || 'Auto-GPS'})
                      </div>
                      <div>
                        <strong>{language === 'tl' ? 'Kalubhaan:' : 'Severity:'}</strong>{' '}
                        {t.severity[item.severityLevel]?.label || item.severityLevel}
                      </div>
                      {item.extraMessage && (
                        <div className="text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                          <strong>
                            {language === 'tl'
                              ? 'Mensahe sa Kagawad:'
                              : 'Message to Barangay Official:'}
                          </strong>{' '}
                          &quot;{item.extraMessage}&quot;
                        </div>
                      )}
                    </div>

                    {/* Resident Photos */}
                    {item.photos && item.photos.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span>
                            {language === 'tl'
                              ? 'Iyong Naipasa na Litrato'
                              : 'Your Attached Photos'}{' '}
                            ({item.photos.length}):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {language === 'tl'
                              ? 'Naka-save sa phone memory'
                              : 'Saved in phone memory'}
                          </span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {item.photos.map((p, idx) => (
                            <div
                              key={idx}
                              onClick={() =>
                                setLightboxState({
                                  photos: item.photos,
                                  index: idx,
                                  title: `#${formatTicketNumber(item.ticketNumber)} • ${
                                    language === 'tl' ? 'Iyong Litrato' : 'Your Photo'
                                  }`,
                                })
                              }
                              className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-300 shrink-0 cursor-pointer group"
                            >
                              <ResolvedPhoto
                                src={p}
                                alt={language === 'tl' ? 'Litrato ng Basura' : 'Waste Photo'}
                                className="w-full h-full"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OFFICIAL ACTION / PROOF PHOTOS & NOTES */}
                    {item.status === 'RESOLVED' && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>
                              {language === 'tl'
                                ? 'PROEBA / KATIBAYAN MULA SA KAGAWAD'
                                : 'OFFICIAL CLEANUP PROOF FROM BARANGAY OFFICIAL'}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 font-extrabold text-[10px]">
                            OFFICIAL PROOF
                          </span>
                        </div>

                        {item.proofPhotos && item.proofPhotos.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] text-emerald-800 font-semibold">
                              {language === 'tl'
                                ? 'Attached na proeba ng Kagawad (Litrato ng nalinis na lugar):'
                                : 'Attached official proof photo (Cleaned location):'}
                            </p>
                            <div className="flex gap-2.5 overflow-x-auto pb-1">
                              {item.proofPhotos.map((proofImg, pIdx) => (
                                <div
                                  key={pIdx}
                                  onClick={() =>
                                    setLightboxState({
                                      photos: item.proofPhotos || [],
                                      index: pIdx,
                                      title: `#${formatTicketNumber(item.ticketNumber)} • ${
                                        language === 'tl' ? 'Proeba ng Kagawad' : 'Official Proof'
                                      }`,
                                    })
                                  }
                                  className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-emerald-500 shrink-0 cursor-pointer shadow-sm group"
                                >
                                  <ResolvedPhoto
                                    src={proofImg}
                                    alt={language === 'tl' ? 'Proeba' : 'Proof'}
                                    className="w-full h-full"
                                  />
                                  <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-emerald-900/80 text-white text-[9px] font-black text-center py-0.5">
                                    {language === 'tl' ? 'Proeba' : 'Proof'} #{pIdx + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.resolutionNotes && (
                          <div className="text-xs text-emerald-900 bg-white/90 p-2.5 rounded-xl border border-emerald-200 space-y-1">
                            <div className="font-extrabold text-[11px] text-emerald-800 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>
                                {language === 'tl'
                                  ? 'Mensahe / Rason ng Kagawad:'
                                  : 'Barangay Official Message / Notes:'}
                              </span>
                            </div>
                            <p className="leading-relaxed">{item.resolutionNotes}</p>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-500">
                          {language === 'tl' ? 'Inaksyunan ni:' : 'Action taken by:'}{' '}
                          <strong>
                            {item.resolvedBy ||
                              item.proofKagawadName ||
                              (language === 'tl' ? 'Barangay Kagawad' : 'Barangay Official')}
                          </strong>{' '}
                          {item.resolvedAt ? `• ${new Date(item.resolvedAt).toLocaleString()}` : ''}
                        </div>
                      </div>
                    )}

                    {/* Actions for Resident */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => openInteractiveStreetView(item)}
                        className="text-xs text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>
                          {language === 'tl'
                            ? 'Buksan sa 360° Street View'
                            : 'Open in 360° Street View'}
                        </span>
                      </button>

                      <button
                        onClick={() => setReportToDelete(item)}
                        className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                        title={
                          language === 'tl'
                            ? 'Burahin sa sariling cellphone'
                            : 'Delete from phone'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {language === 'tl' ? 'Burahin sa Phone' : 'Delete from Phone'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs space-y-3 flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-md flex items-center justify-center p-3">
                <ThreeDHouseholdTrash className="w-full h-full select-none" />
              </div>
              <p className="max-w-xs text-slate-500 font-medium leading-relaxed">
                {language === 'tl'
                  ? 'Wala ka pang naka-save na ulat sa iyong telepono.'
                  : 'You do not have any saved reports on this device yet.'}
              </p>
              <button
                onClick={() => setResidentTab('form')}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {language === 'tl' ? 'Mag-report ng Basura Ngayon' : 'Report Waste Now'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: RESIDENT REPORT FORM */
        <form onSubmit={handleSubmitReport} className="space-y-4 sm:space-y-5">
          {/* Clean Notice */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <strong>
                {language === 'tl'
                  ? 'Ligtas na Pagpasa at Sariling Phone Storage:'
                  : 'Secure Submission & Private Phone Storage:'}
              </strong>{' '}
              {language === 'tl'
                ? 'Ang bawat ulat at litrato ay pribadong mase-save sa iyong sariling cellphone kahit offline ang server, at ipapadala sa Raspberry Pi Cloud Server upang makita ng mga Barangay Officials.'
                : 'Every report and photo is privately saved to your own phone even if the server is offline, and transmitted through the Raspberry Pi Cloud Server for Barangay Officials.'}
            </div>
          </div>

          {/* Step 1: Waste Types */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  {language === 'tl' ? 'Hakbang 1' : 'Step 1'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {t.household.wasteTypeTitle}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-bold">1-Tap</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COMMON_WASTE_BUTTONS.map((item) => {
                const isSelected = selectedTypes.includes(item.title);
                const localizedTitle =
                  item.id === 'household'
                    ? t.wasteTypes.household.title
                    : item.id === 'bulky'
                    ? t.wasteTypes.bulky.title
                    : item.id === 'yard'
                    ? t.wasteTypes.yard.title
                    : t.wasteTypes.hazardous.title;
                const localizedDesc =
                  item.id === 'household'
                    ? t.wasteTypes.household.desc
                    : item.id === 'bulky'
                    ? t.wasteTypes.bulky.desc
                    : item.id === 'yard'
                    ? t.wasteTypes.yard.desc
                    : t.wasteTypes.hazardous.desc;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleWasteType(item.title)}
                    className={`p-3 sm:p-4 rounded-3xl border-2 text-left transition-all flex items-center gap-3.5 relative cursor-pointer group ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 shadow-2xs'
                    }`}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                      <item.IconComponent className="w-full h-full select-none" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                        {localizedTitle}
                      </div>
                      <div className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-snug">
                        {localizedDesc}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Photos Attachment (Required) */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    {language === 'tl' ? 'Hakbang 2' : 'Step 2'}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    * {language === 'tl' ? 'KINAKAILANGAN' : 'REQUIRED'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {t.household.photoTitle}
                </h3>
              </div>
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-full ${
                  photos.length > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {photos.length} / 15 {language === 'tl' ? 'litrato' : 'photos'}
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 shadow-xs flex items-center justify-center p-1 shrink-0">
                  <ThreeDCamera className="w-full h-full" />
                </div>
                <span>
                  {language === 'tl'
                    ? 'Kinakailangang maglagay ng sariling litrato ng basura. Bawal mag-submit nang walang litrato.'
                    : 'A photo of the waste is required before submitting.'}
                </span>
              </div>
            ) : null}

            {photoError ? (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-extrabold flex items-center gap-2">
                <span>⚠️ {photoError}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsLiveCameraOpen(true)}
                className="p-3.5 sm:p-4 rounded-3xl border-2 border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-left transition-all flex items-center gap-3.5 group cursor-pointer shadow-sm hover:shadow-md active:scale-98"
              >
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                  <ThreeDCamera className="w-full h-full select-none" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-xs sm:text-sm text-emerald-950 flex items-center gap-1.5 flex-wrap">
                    <span>{t.household.takeLivePhoto}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black">
                      LIVE
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1 leading-snug">
                    {language === 'tl'
                      ? 'Diretso kuha gamit ang camera'
                      : 'Instant camera snapshot'}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="p-3.5 sm:p-4 rounded-3xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-left transition-all flex items-center gap-3.5 group cursor-pointer shadow-2xs hover:shadow-sm active:scale-98"
              >
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                  <ThreeDFolderGallery className="w-full h-full select-none" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-xs sm:text-sm text-slate-900">
                    {t.household.uploadFromFiles}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {language === 'tl'
                      ? 'Pumili sa gallery o file storage'
                      : 'Choose files from gallery'}
                  </div>
                </div>
              </button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                handlePhotoFiles(e.target.files);
                e.currentTarget.value = '';
              }}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                handlePhotoFiles(e.target.files);
                e.currentTarget.value = '';
              }}
              className="hidden"
            />

            <LiveCameraModal
              isOpen={isLiveCameraOpen}
              onClose={() => setIsLiveCameraOpen(false)}
              onCapture={handleLiveCameraCapture}
              onFallbackToFile={() => galleryInputRef.current?.click()}
            />

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
                {photos.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      setLightboxState({
                        photos,
                        index: idx,
                        title: t.household.photoTitle,
                      })
                    }
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-2xs cursor-pointer group"
                  >
                    <ResolvedPhoto src={imgUrl} className="w-full h-full" showExpandHint />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(idx);
                      }}
                      className="absolute top-1.5 right-1.5 z-10 p-1 bg-red-600 text-white rounded-full shadow-md cursor-pointer hover:bg-red-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Severity */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3.5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                {language === 'tl' ? 'Hakbang 3' : 'Step 3'}
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {t.household.severityTitle}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SEVERITY_LEVELS.map((sev) => {
                const isSelected = severityLevel === sev.id;
                const localizedLabel = t.severity[sev.id]?.label || sev.label;
                const localizedDesc = t.severity[sev.id]?.desc || sev.tagalog;
                return (
                  <button
                    key={sev.id}
                    type="button"
                    onClick={() => setSeverityLevel(sev.id)}
                    className={`p-3 sm:p-4 rounded-3xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer group ${
                      isSelected
                        ? `${sev.color} ring-2 ring-slate-900 shadow-md`
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50 text-slate-700 shadow-2xs'
                    }`}
                  >
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                      <sev.IconComponent className="w-full h-full select-none" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-xs sm:text-sm leading-tight">
                        {localizedLabel}
                      </div>
                      <div className="text-[11px] opacity-80 mt-1 leading-snug">
                        {localizedDesc}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Senior Citizen Priority Flag */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsElderly(!isElderly)}
                className={`w-full p-3.5 sm:p-4 rounded-3xl border-2 flex items-center justify-between transition-all cursor-pointer group ${
                  isElderly
                    ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-2 ring-purple-500 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3.5 text-left">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-purple-100 shadow-xs flex items-center justify-center p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                    <ThreeDSeniorHeart className="w-full h-full select-none" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-slate-900">
                      {t.household.elderlyPriorityTitle}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {t.household.elderlyPrioritySubtitle}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shadow-xs shrink-0 ${
                    isElderly
                      ? 'bg-purple-700 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {isElderly
                    ? language === 'tl'
                      ? 'NAKA-ON'
                      : 'ACTIVE'
                    : language === 'tl'
                    ? 'NAKA-OFF (Opsyonal)'
                    : 'OFF (Optional)'}
                </span>
              </button>
            </div>
          </div>

          {/* Step 4: Location, Interactive Mobile Street View & Extra Message */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                  {language === 'tl' ? 'Hakbang 4' : 'Step 4'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>{t.household.locationTitle}</span>
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openInteractiveStreetView()}
                  className="text-[11px] font-black px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>
                    {language === 'tl'
                      ? '360° Street View at Mapa'
                      : '360° Street View & Map'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNeedsAssistanceOutside(!needsAssistanceOutside)}
              className={`w-full p-3.5 sm:p-4 rounded-3xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer group ${
                needsAssistanceOutside
                  ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-600 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
              }`}
            >
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-purple-100 shadow-xs flex items-center justify-center p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                <ThreeDAssistanceBeacon className="w-full h-full select-none" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                  <span>
                    {language === 'tl'
                      ? 'Nangangailangan ng Assistance'
                      : 'Requires Special Assistance'}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                    {language === 'tl'
                      ? 'Taga-Brgy 40 o 41 (Nasa Labas ng Sakop)'
                      : 'Resident Outside Immediate Boundary'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  {t.household.outsideJurisdictionWarning}
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${
                  needsAssistanceOutside
                    ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                    : 'border-slate-300 bg-white text-transparent'
                }`}
              >
                ✓
              </div>
            </button>

            {/* Real-time GPS Pin details with Calibration & Street View access */}
            {isLocationEnabled && coords ? (
              <div
                className={`p-3.5 sm:p-4 rounded-3xl border-2 text-xs flex flex-col sm:flex-row items-start sm:items-center gap-3.5 ${
                  gpsWithinJurisdiction && !needsAssistanceOutside
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-sm'
                    : 'bg-purple-50/90 border-purple-300 text-purple-950 shadow-sm'
                }`}
              >
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-emerald-100 shadow-md flex items-center justify-center p-2 shrink-0">
                  <ThreeDLocationPin className="w-full h-full drop-shadow-sm select-none" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center justify-between gap-2 flex-wrap font-extrabold text-[11px] sm:text-xs">
                    <span className="flex items-center gap-1.5">
                      <span>
                        {language === 'tl'
                          ? 'Kasalukuyang Real-Time GPS Mo'
                          : 'Your Live Detected GPS Pin'}
                      </span>
                    </span>
                    <span
                      className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full ${
                        gpsWithinJurisdiction && !needsAssistanceOutside
                          ? barangay.includes('40')
                            ? 'bg-cyan-200 text-cyan-900 border border-cyan-300'
                            : 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                          : 'bg-purple-200 text-purple-900 border border-purple-300'
                      }`}
                    >
                      {gpsWithinJurisdiction && !needsAssistanceOutside
                        ? barangay.includes('40')
                          ? language === 'tl'
                            ? '✓ Sakop ng Barangay 40'
                            : '✓ Within Barangay 40'
                          : language === 'tl'
                          ? '✓ Sakop ng Barangay 41'
                          : '✓ Within Barangay 41'
                        : language === 'tl'
                        ? '⚠️ Nangangailangan ng Assistance'
                        : '⚠️ Special Assistance Needed'}
                    </span>
                  </div>
                  <div className="mt-2 p-2.5 sm:p-3 rounded-2xl bg-white/95 border border-emerald-200 shadow-2xs space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                      {language === 'tl'
                        ? 'Eksaktong Address na Na-detect ng GPS:'
                        : 'Exact GPS-Detected Street Address:'}
                    </span>
                    <div className="font-black text-slate-900 text-xs sm:text-sm leading-snug break-words">
                      {liveGpsAddress || barangay}
                    </div>
                  </div>
                  {liveGpsAccuracy !== null && (
                    <div className="text-[10px] sm:text-[11px] text-slate-600 font-semibold mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span>
                        {language === 'tl' ? 'Katumpakan ng Signal' : 'Signal Precision'}: ±
                        {liveGpsAccuracy}m
                      </span>
                      {isGpsRefining && (
                        <span className="text-emerald-700 font-bold animate-pulse">
                          •{' '}
                          {language === 'tl'
                            ? 'Pinapatalas ang satellite lock...'
                            : 'Sharpening satellite lock...'}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] text-emerald-800 font-semibold">
                      ✓{' '}
                      {language === 'tl'
                        ? 'Tumpak na GPS address nakakabit'
                        : 'Precise GPS address attached'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => refreshLocation()}
                        disabled={locationStatus === 'requesting'}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        title={language === 'tl' ? 'I-refresh ang GPS' : 'Refresh GPS'}
                      >
                        <RotateCcw
                          className={`w-3 h-3 ${
                            locationStatus === 'requesting' || isGpsRefining
                              ? 'animate-spin text-emerald-600'
                              : ''
                          }`}
                        />
                        <span>{language === 'tl' ? 'I-refresh' : 'Refresh'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          userEditedStreetRef.current = false;
                          userEditedHouseRef.current = false;
                          resetLocation();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title={language === 'tl' ? 'I-reset ang GPS' : 'Reset GPS'}
                      >
                        <X className="w-3 h-3" />
                        <span>{language === 'tl' ? 'I-reset' : 'Reset'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/80 text-xs text-slate-600 space-y-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white border border-slate-200/90 shadow-md flex items-center justify-center p-2 shrink-0">
                    <ThreeDLocationPin className="w-full h-full drop-shadow-sm select-none" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-900 block text-xs sm:text-sm">
                        {language === 'tl'
                          ? 'GPS Lokasyon: Walang Signal / Naka-off'
                          : 'GPS Location: Blank / Turned Off'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 shrink-0">
                        BLANK
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                      {language === 'tl'
                        ? 'Walang aktibong GPS signal'
                        : 'No active GPS signal'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {language === 'tl'
                    ? 'Pindutin ang Payagan ang Lokasyon para sa eksaktong satellite GPS pin, o piliin ang Barangay Hall reference sa ibaba.'
                    : 'Tap Allow Location Access for a precise satellite GPS pin, or select a Barangay Hall reference below.'}
                </p>

                {locationErrorMessage && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
                    <span>
                      ⚠️{' '}
                      {locationStatus === 'denied'
                        ? language === 'tl'
                          ? 'Naka-block ang GPS permission. Pakipayagan ang Location access sa settings ng iyong browser o telepono.'
                          : 'GPS permission is blocked. Please allow Location access in your browser or phone settings.'
                        : language === 'tl'
                        ? 'Hindi agad makakuha ng GPS signal. Pakisiguradong naka-ON ang Location/GPS ng iyong device.'
                        : 'Unable to lock GPS signal right now. Please make sure Location/GPS is turned ON on your device.'}
                    </span>
                  </div>
                )}

                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => requestLocation()}
                    disabled={locationStatus === 'requesting'}
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Navigation
                      className={`w-4 h-4 ${
                        locationStatus === 'requesting' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {locationStatus === 'requesting'
                        ? language === 'tl'
                          ? 'Kumukonekta sa GPS...'
                          : 'Detecting GPS...'
                        : language === 'tl'
                        ? 'Payagan ang Lokasyon (Auto-GPS)'
                        : 'Allow Location Access (Auto-GPS)'}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setManualLocation('Barangay 40');
                        setBarangay('Barangay 40 (Gumamela), Cavite City');
                        setPurok('Barangay 40 (Gumamela), Cavite City');
                      }}
                      className="p-2.5 rounded-2xl bg-white hover:bg-cyan-50 text-cyan-900 border border-cyan-200 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-2 shadow-2xs group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform">
                        <ThreeDBarangayHall className="w-full h-full" />
                      </div>
                      <span className="truncate">Barangay 40 (Gumamela)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualLocation('Barangay 41');
                        setBarangay('Barangay 41 (Rosal), Cavite City');
                        setPurok('Barangay 41 (Rosal), Cavite City');
                      }}
                      className="p-2.5 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-bold cursor-pointer transition-all flex items-center gap-2 shadow-2xs group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform">
                        <ThreeDBarangayHall className="w-full h-full" />
                      </div>
                      <span className="truncate">Barangay 41 (Rosal)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.household.barangayLabel}
                </label>
                <select
                  value={barangay}
                  onChange={(e) => {
                    setBarangay(e.target.value);
                    setPurok(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-slate-50"
                >
                  {BARANGAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'tl' ? 'Kalsada / Street' : 'Street Name'}{' '}
                  <span className="font-normal text-slate-400">
                    ({language === 'tl' ? 'Opsyonal' : 'Optional'})
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={t.household.streetPlaceholder}
                  value={streetAddress}
                  onChange={(e) => {
                    userEditedStreetRef.current = e.target.value.trim().length > 0;
                    setStreetAddress(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'tl' ? 'House # / Palatandaan' : 'House # / Landmark'}{' '}
                  <span className="font-normal text-slate-400">
                    ({language === 'tl' ? 'Opsyonal' : 'Optional'})
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={t.household.landmarkPlaceholder}
                  value={houseNumber}
                  onChange={(e) => {
                    userEditedHouseRef.current = e.target.value.trim().length > 0;
                    setHouseNumber(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.household.residentNameLabel}{' '}
                  <span className="font-normal text-slate-400">
                    ({language === 'tl' ? 'Opsyonal' : 'Optional'})
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={t.household.residentNamePlaceholder}
                  value={residentName}
                  onChange={(e) => setResidentName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs bg-slate-50"
                />
              </div>
            </div>

            {/* Extra Message */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t.household.notesLabel}:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {language === 'tl' ? 'Opsyonal' : 'Optional'}
                </span>
              </label>
              <textarea
                rows={2}
                value={extraMessage}
                onChange={(e) => setExtraMessage(e.target.value)}
                placeholder={t.household.notesPlaceholder}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting || photos.length === 0}
              className={`w-full py-4 sm:py-5 px-6 rounded-3xl font-black text-base sm:text-xl shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer ${
                photos.length === 0
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-emerald-600/30 active:scale-98'
              }`}
            >
              {photos.length === 0 ? (
                <div className="w-8 h-8 rounded-xl bg-white/80 border border-slate-300 flex items-center justify-center p-1 shrink-0">
                  <ThreeDCamera className="w-full h-full" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-2xl bg-white border border-emerald-300 shadow-sm flex items-center justify-center p-1 shrink-0">
                  <ThreeDCheckShield className="w-full h-full" />
                </div>
              )}
              <span>
                {isSubmitting
                  ? t.household.submittingReport
                  : photos.length === 0
                  ? language === 'tl'
                    ? 'KUMUHA MUNA NG LITRATO BAGO IPASA'
                    : 'ATTACH PHOTO BEFORE SUBMITTING'
                  : t.household.submitReportBtn}
              </span>
            </button>
            {photos.length === 0 && (
              <p className="text-center text-[11px] text-rose-600 font-bold mt-2">
                *{' '}
                {language === 'tl'
                  ? 'Kailangang maglagay ng 1 hanggang 15 sariling litrato ng basura bago maipadala.'
                  : 'Must attach 1 to 15 photos of the waste before submitting.'}
              </p>
            )}
          </div>
        </form>
      )}

      {/* Mobile & Desktop Interactive 360° Street View & Barangay Map Modal */}
      {streetViewModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto">
            <StreetView360
              target={streetViewModalTarget}
              onSwitchTarget={(nextTarget) => {
                setStreetViewModalTarget(nextTarget);
                if (
                  residentTab === 'form' &&
                  !streetViewModalTarget.id.startsWith('res-') &&
                  nextTarget.id.startsWith('point-')
                ) {
                  setPinpointLocation(nextTarget.lat, nextTarget.lng);
                }
              }}
              onClose={() => setStreetViewModalTarget(null)}
              hideCoordinates={true}
            />
          </div>
        </div>
      )}

      {/* Delete Single Confirmation Modal */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {language === 'tl' ? 'Burahin ang Rekord na Ito?' : 'Delete This Record?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Ticket <strong>#{formatTicketNumber(reportToDelete.ticketNumber)}</strong>{' '}
                {language === 'tl' ? 'sa' : 'in'} {reportToDelete.purok}
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                {language === 'tl' ? 'Bumalik' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md active:scale-98 cursor-pointer"
              >
                {language === 'tl' ? 'Burahin' : 'Delete'}
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
