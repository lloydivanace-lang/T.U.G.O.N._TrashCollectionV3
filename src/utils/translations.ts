export type Language = 'tl' | 'en';

export interface Translations {
  common: {
    language: string;
    tagalog: string;
    english: string;
    switchLanguage: string;
    cancel: string;
    close: string;
    save: string;
    copied: string;
    copy: string;
    loading: string;
    refresh: string;
    confirm: string;
    status: string;
    actions: string;
    view: string;
    delete: string;
    back: string;
    success: string;
    error: string;
    search: string;
    online: string;
    offline: string;
    active: string;
    sync: string;
    synced: string;
  };
  header: {
    systemTitle: string;
    jurisdictionBadge: string;
    residentView: string;
    kagawadPortal: string;
    pendingBadge: string;
    soundOn: string;
    soundOff: string;
    calibrateScreen: string;
    calibrateToast: string;
    kagawadLogin: string;
    loginTitle: string;
    loginSubtitle: string;
    username: string;
    usernamePlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    loginBtn: string;
    enterCredentials: string;
    invalidCredentials: string;
    activeAccount: string;
    logout: string;
    changePassword: string;
    changePasswordTitle: string;
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
    passwordChangedSuccess: string;
    installApp: string;
    installSubtitle: string;
  };
  household: {
    bannerTitle: string;
    bannerSubtitle: string;
    reportWasteTab: string;
    myReportsTab: string;
    myReportsCount: string;
    wasteTypeTitle: string;
    wasteTypeSubtitle: string;
    severityTitle: string;
    severitySubtitle: string;
    photoTitle: string;
    photoSubtitle: string;
    addPhotoCamera: string;
    addPhotoGallery: string;
    takeLivePhoto: string;
    uploadFromFiles: string;
    photosAdded: string;
    locationTitle: string;
    locationSubtitle: string;
    detectGps: string;
    detectingGps: string;
    gpsDetected: string;
    gpsError: string;
    withinJurisdiction: string;
    outsideJurisdiction: string;
    outsideJurisdictionWarning: string;
    outsideAssistanceCheckbox: string;
    barangayLabel: string;
    streetPlaceholder: string;
    landmarkPlaceholder: string;
    contactInfoTitle: string;
    residentNameLabel: string;
    residentNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    elderlyPriorityTitle: string;
    elderlyPrioritySubtitle: string;
    elderlyPriorityActive: string;
    elderlyPriorityToggle: string;
    submitReportBtn: string;
    submittingReport: string;
    successModalTitle: string;
    successModalSubtitle: string;
    ticketNumberLabel: string;
    trackStatusText: string;
    doneBtn: string;
    noPersonalReports: string;
    noPersonalReportsSub: string;
    statusPending: string;
    statusDispatched: string;
    statusResolved: string;
    statusCancelled: string;
    viewProofBtn: string;
    proofModalTitle: string;
    proofModalSubtitle: string;
    resolvedByLabel: string;
    collectedAtLabel: string;
    kagawadNotesLabel: string;
    storageSyncBadge: string;
    piCloudSaved: string;
  };
  wasteTypes: {
    household: { title: string; desc: string };
    bulky: { title: string; desc: string };
    yard: { title: string; desc: string };
    hazardous: { title: string; desc: string };
  };
  severity: {
    MILD: { label: string; desc: string };
    MODERATE: { label: string; desc: string };
    OVERFLOWING: { label: string; desc: string };
    EMERGENCY: { label: string; desc: string };
  };
  dashboard: {
    operationsTitle: string;
    operationsSubtitle: string;
    tabMap: string;
    tabLogs: string;
    tabPi: string;
    tabTelegram: string;
    tabSource: string;
    statTotal: string;
    statPending: string;
    statDispatched: string;
    statResolved: string;
    statPiSync: string;
    statElderly: string;
    filterAll: string;
    filterPending: string;
    filterDispatched: string;
    filterResolved: string;
    filterCancelled: string;
    filterBrgy40: string;
    filterBrgy41: string;
    filterElderly: string;
    searchPlaceholder: string;
    emptyQueue: string;
    emptyQueueSub: string;
    actionDispatch: string;
    actionResolve: string;
    actionCancel: string;
    actionDelete: string;
    ticketDetails: string;
    reportedBy: string;
    reportedAt: string;
    locationAddress: string;
    severityLabel: string;
    wasteTypesLabel: string;
    bagsEstimate: string;
    residentPhotosTitle: string;
    resolveModalTitle: string;
    resolveModalSubtitle: string;
    proofRequiredWarning: string;
    addProofPhotos: string;
    kagawadNameLabel: string;
    kagawadNotesPlaceholder: string;
    submitProofBtn: string;
    submittingProof: string;
    cancelModalTitle: string;
    cancelModalSubtitle: string;
    cancelPresetReason: string;
    cancelCustomReason: string;
    confirmCancelBtn: string;
    deleteModalTitle: string;
    deleteModalSubtitle: string;
    confirmDeleteBtn: string;
  };
  piCenter: {
    centerTitle: string;
    centerSubtitle: string;
    connectionStatus: string;
    piOnline: string;
    piOffline: string;
    activeEndpoint: string;
    testPingBtn: string;
    testingPing: string;
    connectBtn: string;
    disconnectBtn: string;
    urlPlaceholder: string;
    hardwareTitle: string;
    specsRam: string;
    specsStorage: string;
    specsCpuTemp: string;
    specsHostname: string;
    specsIp: string;
    photosStoredTitle: string;
    residentPhotosCount: string;
    proofPhotosCount: string;
    savedLogbooksCount: string;
    livePingLatency: string;
    disconnectModalTitle: string;
    disconnectModalDesc: string;
    confirmDisconnect: string;
    reconnectPrompt: string;
    safePowerTitle: string;
    safeShutdownBtn: string;
    safeRebootBtn: string;
  };
  logs: {
    logsTitle: string;
    logsSubtitle: string;
    searchPlaceholder: string;
    exportCsv: string;
    printReport: string;
    totalResolved: string;
    allProofAvailable: string;
    resolvedDate: string;
    ticketCol: string;
    residentCol: string;
    addressCol: string;
    kagawadCol: string;
    proofCol: string;
    noLogsFound: string;
  };
  sourceCode: {
    centerTitle: string;
    centerSubtitle: string;
    downloadZipServer: string;
    downloadZipClient: string;
    viewExplorer: string;
    hideExplorer: string;
    githubGuideTab: string;
    renderGuideTab: string;
    piGuideTab: string;
    apkGuideTab: string;
    renderTipTitle: string;
    renderTipBody: string;
    buildCommandLabel: string;
    startCommandLabel: string;
    copyCommands: string;
  };
  telegram: {
    centerTitle: string;
    centerSubtitle: string;
    botStatus: string;
    botConfigured: string;
    botNotConfigured: string;
    botTokenLabel: string;
    chatIdLabel: string;
    sendTestBtn: string;
    sendingTest: string;
    testSuccess: string;
    setupGuideTitle: string;
  };
}

export const translations: Record<Language, Translations> = {
  tl: {
    common: {
      language: 'Wika',
      tagalog: 'Tagalog',
      english: 'English',
      switchLanguage: 'Palitan ang Wika',
      cancel: 'Kanselahin',
      close: 'Isara',
      save: 'I-save',
      copied: 'Kopya na!',
      copy: 'Kopyahin',
      loading: 'Naglo-load...',
      refresh: 'I-refresh',
      confirm: 'Kumpirmahin',
      status: 'Katayuan',
      actions: 'Mga Aksyon',
      view: 'Tingnan',
      delete: 'Burahin',
      back: 'Bumalik',
      success: 'Tagumpay',
      error: 'May Error',
      search: 'Maghanap...',
      online: 'ONLINE',
      offline: 'OFFLINE',
      active: 'Aktibo',
      sync: 'I-sync',
      synced: 'Naka-sync',
    },
    header: {
      systemTitle: 'T.U.G.O.N.',
      jurisdictionBadge: 'Barangay 40 & 41 • Cavite City',
      residentView: 'Resident Report',
      kagawadPortal: 'Barangay Portal',
      pendingBadge: 'Nasa Queue',
      soundOn: 'Tunog: Bukas',
      soundOff: 'Tunog: Naka-mute',
      calibrateScreen: 'I-calibrate ang Screen',
      calibrateToast: 'Na-calibrate ang screen para sa iyong display!',
      kagawadLogin: 'Mag-log in bilang Kagawad',
      loginTitle: 'Opisyal na Kagawad Portal',
      loginSubtitle: 'Ipasok ang opisyal na credentials ng Barangay 40 at 41',
      username: 'Pangalan',
      usernamePlaceholder: 'Input Name',
      password: 'Password',
      passwordPlaceholder: 'Input Password',
      loginBtn: 'Pumasok sa Barangay Portal',
      enterCredentials: 'Paki-lagay ang iyong pangalan at password.',
      invalidCredentials: 'Maling password. Pakisubukan muli.',
      activeAccount: 'Kagawad Account',
      logout: 'Mag-logout',
      changePassword: 'Palitan ang Password',
      changePasswordTitle: 'Palitan ang Kagawad Password',
      oldPassword: 'Kasalukuyang Password',
      newPassword: 'Bagong Password',
      confirmNewPassword: 'Ulitin ang Bagong Password',
      passwordChangedSuccess: 'Matagumpay na napalitan ang password!',
      installApp: 'I-install bilang App',
      installSubtitle: 'Pindutin para ilagay sa Home Screen ng iyong cellphone',
    },
    household: {
      bannerTitle: 'Mabilis na Koleksyon ng Basura',
      bannerSubtitle: 'Magsumite ng ulat para agad mapuntahan at makolekta ng ating Cavite City sanitation truck at Barangay Kagawad.',
      reportWasteTab: 'Mag-ulat ng Basura',
      myReportsTab: 'Aking Mga Ulat',
      myReportsCount: 'Naitalang Ulat',
      wasteTypeTitle: 'Uri ng Basurang Kokolektahin',
      wasteTypeSubtitle: 'Pumili ng isa o higit pang uri ng basura:',
      photoTitle: 'Litrato ng Basura (Katibayan)',
      photoSubtitle: 'Kumuha ng live camera shot o mag-upload mula sa gallery:',
      severityTitle: 'Gaano Kalala ang Tambak?',
      severitySubtitle: 'Piliin ang antas ng pangangailangan upang malaman ang prayoridad:',
      addPhotoCamera: 'Kumuha ng Litrato (Camera)',
      addPhotoGallery: 'Mag-upload mula sa Gallery',
      takeLivePhoto: 'Kumuha ng Litrato',
      uploadFromFiles: 'Pumili sa Gallery',
      photosAdded: 'litrato ang nailakip',
      locationTitle: 'Lokasyon & Tirahan',
      locationSubtitle: 'Awtomatikong kukunin ang iyong tumpak na GPS coordinates o i-type ang landmark:',
      detectGps: 'Kuhanin ang Aking GPS',
      detectingGps: 'Hinahanap ang GPS...',
      gpsDetected: 'Nakuha ang GPS Coordinates',
      gpsError: 'Hindi makuha ang GPS. Paki-type ang address sa ibaba.',
      withinJurisdiction: '✓ Nasa Sakop ng Barangay 40 o 41 (Cavite City)',
      outsideJurisdiction: '⚠️ Nasa labas ng sakop ng Barangay 40/41',
      outsideJurisdictionWarning: 'Ang iyong GPS location ay nasa labas ng Brgy 40 at 41. Kung ikaw ay lehitimong residente, paki-check ang kahon sa ibaba.',
      outsideAssistanceCheckbox: 'Ako ay residente ng Barangay 40 o 41 at humihingi ng tulong sa pamunuan.',
      barangayLabel: 'Barangay Jurisdiction',
      streetPlaceholder: 'Pangalan ng Kalye / House # (hal. Miranda St. / Lopez Jaena)',
      landmarkPlaceholder: 'Kilalang Landmark (hal. Tabi ng Bakery, tapat ng tindahan)',
      contactInfoTitle: 'Impormasyon ng Nag-uulat',
      residentNameLabel: 'Pangalan ng Residente / Household Head',
      residentNamePlaceholder: 'Hal. Juan dela Cruz',
      phoneLabel: 'Cellphone Number (Para sa update text)',
      phonePlaceholder: '0917-XXX-XXXX',
      notesLabel: 'Karagdagang Mensahe o Tagubilin (Opsyonal)',
      notesPlaceholder: 'Hal. Pakibilisan po baka maabutan ng ulan, nasa loob ng gate...',
      elderlyPriorityTitle: 'Prayoridad para sa Senior Citizen o PWD',
      elderlyPrioritySubtitle: 'I-on ito kung ang residente ay nakatatanda o may kapansanan upang unahing puntahan ng sanitation crew.',
      elderlyPriorityActive: 'Naka-on ang Senior Citizen / PWD Priority',
      elderlyPriorityToggle: 'I-toggle ang Senior / PWD Priority',
      submitReportBtn: 'Ipasa ang Ulat ng Basura',
      submittingReport: 'Ipinapasa sa Barangay Server...',
      successModalTitle: 'Matagumpay na Naipasa!',
      successModalSubtitle: 'Nakatala na sa ating system ang iyong ulat at naka-alerto na ang ating mga Barangay Kagawad.',
      ticketNumberLabel: 'Ticket Tracking Number',
      trackStatusText: 'Maaari mong subaybayan ang progreso sa tab na "Aking Mga Ulat".',
      doneBtn: 'Naiintindihan Ko',
      noPersonalReports: 'Wala ka pang naipasang ulat sa device na ito.',
      noPersonalReportsSub: 'Pindutin ang "Mag-ulat ng Basura" sa itaas upang magsumite ng concern.',
      statusPending: 'Nasa Queue (Naghihintay)',
      statusDispatched: 'Papunta na ang Truck',
      statusResolved: 'Nakolekta na (Tapos)',
      statusCancelled: 'Nakansela',
      viewProofBtn: 'Tingnan ang Katibayan (Proof)',
      proofModalTitle: 'Katibayan ng Pagkolekta (Proof of Collection)',
      proofModalSubtitle: 'Ito ang opisyal na litratong kuha ng Barangay Kagawad pagkatapos linisin:',
      resolvedByLabel: 'Kinolekta at Inasikaso ni:',
      collectedAtLabel: 'Oras ng Pagkolekta:',
      kagawadNotesLabel: 'Ulat ng Kagawad:',
      storageSyncBadge: 'Naka-imbak sa Raspberry Pi 4 Local Cloud',
      piCloudSaved: 'Naka-save sa Barangay Local Storage',
    },
    wasteTypes: {
      household: {
        title: 'Pang-araw-araw na Basura',
        desc: 'Pang-araw-araw na basura sa kusina, balat, tira-tirang pagkain',
      },
      bulky: {
        title: 'Malalaking Gamit at Muwebles',
        desc: 'Sirang gamit, kahoy, kutson, sirang upuan o lamesa',
      },
      yard: {
        title: 'Dahon at Sangang Tinalupan',
        desc: 'Dahon, damo, sangang pinutol mula sa bakuran',
      },
      hazardous: {
        title: 'Delikadong Basura at E-Waste',
        desc: 'Baterya, sirang ilaw, pintura, sirang appliances',
      },
    },
    severity: {
      MILD: {
        label: 'Banayad / Kakaunti',
        desc: '1-2 sako lamang ng basura',
      },
      MODERATE: {
        label: 'Katamtaman',
        desc: '3-5 sako, regular na tapon',
      },
      OVERFLOWING: {
        label: 'Malala / Umaapaw',
        desc: 'Tambak na basura sa labas ng bahay o kanto',
      },
      EMERGENCY: {
        label: 'Emergency / Delikado',
        desc: 'Nakaharang sa kalsada, may bubog o amoy',
      },
    },
    dashboard: {
      operationsTitle: 'Barangay Operations Command Center',
      operationsSubtitle: 'Barangay 40 & 41 Cavite City • Real-Time Dispatch at Verification',
      tabMap: 'Mapa & Queue',
      tabLogs: 'Kasaysayan & Logs',
      tabPi: 'Raspberry Pi 4 Hub',
      tabTelegram: 'Telegram Bot',
      tabSource: 'Source Code & Deploy',
      statTotal: 'Kabuuang Ulat',
      statPending: 'Nasa Queue',
      statDispatched: 'Papunta na',
      statResolved: 'Nakolekta na',
      statPiSync: 'Pi 4 Storage',
      statElderly: 'Senior / PWD Priority',
      filterAll: 'Lahat',
      filterPending: 'Pending',
      filterDispatched: 'Dispatched',
      filterResolved: 'Resolved',
      filterCancelled: 'Cancelled',
      filterBrgy40: 'Brgy 40',
      filterBrgy41: 'Brgy 41',
      filterElderly: 'Senior/PWD',
      searchPlaceholder: 'Maghanap gamit ang Ticket, Pangalan, Kalye, o Landmark...',
      emptyQueue: 'Walang ulat sa kategoryang ito.',
      emptyQueueSub: 'Maghintay ng bagong ulat mula sa mga residente ng Barangay 40 at 41.',
      actionDispatch: 'I-dispatch ang Truck',
      actionResolve: 'Kumpirmahing Nakolekta (May Proof)',
      actionCancel: 'Kanselahin',
      actionDelete: 'Burahin (Spam)',
      ticketDetails: 'Detalye ng Ticket',
      reportedBy: 'Nag-ulat',
      reportedAt: 'Oras ng Ulat',
      locationAddress: 'Lokasyon / Landmark',
      severityLabel: 'Antas ng Basura',
      wasteTypesLabel: 'Mga Uri ng Basura',
      bagsEstimate: 'Tantiyang Dami',
      residentPhotosTitle: 'Litratong Ipinasa ng Residente',
      resolveModalTitle: 'Opisyal na Katibayan ng Pagkolekta (Proof)',
      resolveModalSubtitle: 'Kailangang maglakip ng litrato ng nalinis na lugar bilang proeba para sa residente:',
      proofRequiredWarning: 'Kinakailangan ang kahit 1 litrato ng nalinis na lugar bago i-markang RESOLVED.',
      addProofPhotos: 'Mag-upload ng Katibayan (Proof Photos)',
      kagawadNameLabel: 'Pangalan ng Kagawad / Sanitation Crew',
      kagawadNotesPlaceholder: 'Hal. Naitapon na sa Cavite City dumpsite truck, malinis na ang area...',
      submitProofBtn: 'I-save bilang RESOLVED & Ipadala ang Proof',
      submittingProof: 'Ina-upload ang katibayan...',
      cancelModalTitle: 'Kanselahin ang Ulat',
      cancelModalSubtitle: 'Pumili ng dahilan kung bakit hindi makokolekta:',
      cancelPresetReason: 'Pumili ng Karaniwang Dahilan',
      cancelCustomReason: 'Iba pang Dahilan (Opsyonal)',
      confirmCancelBtn: 'Kumpirmahing Kanselahin',
      deleteModalTitle: 'Burahin ang Ulat (Spam Removal)',
      deleteModalSubtitle: 'Sigurado ka bang nais mong permanenteng burahin ang ulat na ito mula sa system?',
      confirmDeleteBtn: 'Oo, Burahin Nang Permanente',
    },
    piCenter: {
      centerTitle: 'Raspberry Pi 4 Interconnection & Local Cloud Hub',
      centerSubtitle: 'Pamamahala ng lokal na server sa Barangay Hall para sa independent data storage',
      connectionStatus: 'Katayuan ng Koneksyon sa Pi',
      piOnline: 'ONLINE AT NAKAKONEKTA',
      piOffline: 'OFFLINE O HINDI MAABOT',
      activeEndpoint: 'Aktibong Pi Server URL',
      testPingBtn: 'I-test ang Koneksyon (Ping)',
      testingPing: 'Sinusuri ang Pi...',
      connectBtn: 'I-save & Ikonekta',
      disconnectBtn: 'Idiskonekta ang Pi',
      urlPlaceholder: 'Hal: http://192.168.1.50:5000 o https://my-pi-tunnel.ngrok-free.dev',
      hardwareTitle: 'Hardware & System Status',
      specsRam: 'Memory (RAM)',
      specsStorage: 'Disk Storage',
      specsCpuTemp: 'CPU Temperatura',
      specsHostname: 'Local Hostname',
      specsIp: 'IP Address',
      photosStoredTitle: 'Mga Litratong Naka-imbak sa Pi',
      residentPhotosCount: 'Litratong Kuha ng Residente',
      proofPhotosCount: 'Proof Photos ng Kagawad',
      savedLogbooksCount: 'Nai-save na Permanent Logbooks',
      livePingLatency: 'Bilis ng Tugon (Latency)',
      disconnectModalTitle: 'Sigurado ka bang ididiskonekta ang Pi?',
      disconnectModalDesc: 'Maaari mo itong muling ikonekta anumang oras sa pamamagitan ng paglalagay muli ng Pi URL.',
      confirmDisconnect: 'Idiskonekta Ngayon',
      reconnectPrompt: 'I-paste ang bagong Ngrok o Cloudflare link kapag binuksan ang Pi.',
      safePowerTitle: 'Ligtas na Pamamahala ng Pi',
      safeShutdownBtn: 'Ligtas na I-shutdown ang Pi',
      safeRebootBtn: 'I-restart ang Pi Server',
    },
    logs: {
      logsTitle: 'Kasaysayan ng mga Nakolektang Basura (Resolution Logbook)',
      logsSubtitle: 'Permanenteng talaan ng lahat ng nalinis na basura kasama ang opisyal na proof photos ng Kagawad',
      searchPlaceholder: 'Maghanap sa logs ayon sa Ticket, Residente, o Kalye...',
      exportCsv: 'I-export bilang CSV',
      printReport: 'I-print ang Logbook',
      totalResolved: 'Kabuuang Nakolekta',
      allProofAvailable: 'May Buong Katibayan',
      resolvedDate: 'Petsa ng Pagkolekta',
      ticketCol: 'Ticket #',
      residentCol: 'Residente & Kalye',
      addressCol: 'Barangay & Lokasyon',
      kagawadCol: 'Nag-asikaso',
      proofCol: 'Katibayan (Proof)',
      noLogsFound: 'Walang natagpuang records sa logbook.',
    },
    sourceCode: {
      centerTitle: 'Sentro ng Source Code at Gabay sa Pag-deploy',
      centerSubtitle: '100% Buo, Malinis, at Subok na Code para sa GitHub, Render.com, at Raspberry Pi',
      downloadZipServer: 'Direktang I-download ang Buong Source Code (.ZIP)',
      downloadZipClient: 'Client-Side Backup (.ZIP)',
      viewExplorer: 'Buksan ang File Explorer & Code Viewer',
      hideExplorer: 'Itago ang Code Viewer',
      githubGuideTab: '1. I-push sa GitHub',
      renderGuideTab: '2. I-deploy sa Render',
      piGuideTab: 'Raspberry Pi 4',
      apkGuideTab: 'APK Mobile App',
      renderTipTitle: 'Mahalagang Paalala para sa Render.com:',
      renderTipBody: 'Tiyaking ang "Start Command" sa Render dashboard ay "npm start" (at hindi "nmp start"). Kasama rin ang render.yaml para sa awtomatikong pagsasaayos.',
      buildCommandLabel: 'Build Command',
      startCommandLabel: 'Start Command',
      copyCommands: 'Kopyahin ang Mga Utos',
    },
    telegram: {
      centerTitle: 'Telegram Alert Bot ng Barangay Kagawad',
      centerSubtitle: 'Awtomatikong abiso sa cellphone ng mga Kagawad kapag may bagong ulat ng basura',
      botStatus: 'Katayuan ng Telegram Bot',
      botConfigured: 'NAKA-SETUP AT AKTIBO',
      botNotConfigured: 'HINDI PA NAKA-SETUP',
      botTokenLabel: 'Telegram Bot Token',
      chatIdLabel: 'Barangay Group Chat ID',
      sendTestBtn: 'Magpadala ng Test Alert',
      sendingTest: 'Ipinapadala ang test alert...',
      testSuccess: '✓ Matagumpay na naipadala ang alert sa Telegram!',
      setupGuideTitle: 'Paano I-setup ang Telegram Bot sa 3 Hakbang',
    },
  },
  en: {
    common: {
      language: 'Language',
      tagalog: 'Tagalog',
      english: 'English',
      switchLanguage: 'Switch Language',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      copied: 'Copied!',
      copy: 'Copy',
      loading: 'Loading...',
      refresh: 'Refresh',
      confirm: 'Confirm',
      status: 'Status',
      actions: 'Actions',
      view: 'View',
      delete: 'Delete',
      back: 'Back',
      success: 'Success',
      error: 'Error',
      search: 'Search...',
      online: 'ONLINE',
      offline: 'OFFLINE',
      active: 'Active',
      sync: 'Sync',
      synced: 'Synced',
    },
    header: {
      systemTitle: 'T.U.G.O.N.',
      jurisdictionBadge: 'Barangay 40 & 41 • Cavite City',
      residentView: 'Resident Report',
      kagawadPortal: 'Barangay Portal',
      pendingBadge: 'In Queue',
      soundOn: 'Sound: On',
      soundOff: 'Sound: Muted',
      calibrateScreen: 'Calibrate Screen Display',
      calibrateToast: 'Screen calibrated to fit your display!',
      kagawadLogin: 'Official Login',
      loginTitle: 'Official Barangay Portal',
      loginSubtitle: 'Enter official credentials for Barangay 40 & 41',
      username: 'Name',
      usernamePlaceholder: 'Input Name',
      password: 'Password',
      passwordPlaceholder: 'Input Password',
      loginBtn: 'Enter Barangay Portal',
      enterCredentials: 'Please enter your name and password.',
      invalidCredentials: 'Incorrect password. Please try again.',
      activeAccount: 'Official Account',
      logout: 'Log Out',
      changePassword: 'Change Password',
      changePasswordTitle: 'Change Official Password',
      oldPassword: 'Current Password',
      newPassword: 'New Password',
      confirmNewPassword: 'Confirm New Password',
      passwordChangedSuccess: 'Password changed successfully!',
      installApp: 'Install as App',
      installSubtitle: 'Tap to add to your mobile phone Home Screen',
    },
    household: {
      bannerTitle: 'Fast Waste Collection Reporting',
      bannerSubtitle: 'Submit a report so our Cavite City sanitation truck and Barangay Officials can collect waste promptly.',
      reportWasteTab: 'Report Waste',
      myReportsTab: 'My Reports',
      myReportsCount: 'Submitted Reports',
      wasteTypeTitle: 'Waste Type to Collect',
      wasteTypeSubtitle: 'Select one or more waste categories:',
      photoTitle: 'Photo Evidence',
      photoSubtitle: 'Capture a live camera photo or upload from your gallery:',
      severityTitle: 'Severity & Pile Size',
      severitySubtitle: 'Select urgency level to determine collection priority:',
      addPhotoCamera: 'Take Photo (Camera)',
      addPhotoGallery: 'Upload from Gallery',
      takeLivePhoto: 'Take Live Photo',
      uploadFromFiles: 'Choose from Gallery',
      photosAdded: 'photos attached',
      locationTitle: 'Location & Address',
      locationSubtitle: 'We will automatically detect your accurate GPS coordinates or enter landmarks:',
      detectGps: 'Detect My GPS',
      detectingGps: 'Detecting GPS...',
      gpsDetected: 'GPS Coordinates Acquired',
      gpsError: 'Could not acquire GPS. Please enter your address below.',
      withinJurisdiction: '✓ Within Barangay 40 or 41 (Cavite City)',
      outsideJurisdiction: '⚠️ Outside Barangay 40/41 Jurisdiction',
      outsideJurisdictionWarning: 'Your GPS location is outside Barangay 40 & 41. If you are a resident, please check the box below.',
      outsideAssistanceCheckbox: 'I am a resident of Barangay 40 or 41 requesting collection assistance.',
      barangayLabel: 'Barangay Jurisdiction',
      streetPlaceholder: 'Street Name / House # (e.g., Miranda St. / Lopez Jaena)',
      landmarkPlaceholder: 'Notable Landmark (e.g., Beside Bakery, across the store)',
      contactInfoTitle: 'Reporter Contact Information',
      residentNameLabel: 'Resident / Household Head Name',
      residentNamePlaceholder: 'E.g., Juan Santos',
      phoneLabel: 'Cellphone Number (For SMS updates)',
      phonePlaceholder: '0917-XXX-XXXX',
      notesLabel: 'Additional Instructions or Notes (Optional)',
      notesPlaceholder: 'E.g., Please collect before it rains, inside front gate...',
      elderlyPriorityTitle: 'Senior Citizen or PWD Priority',
      elderlyPrioritySubtitle: 'Turn this on if the resident is elderly or PWD so the sanitation crew prioritizes collection.',
      elderlyPriorityActive: 'Senior Citizen / PWD Priority Active',
      elderlyPriorityToggle: 'Toggle Senior / PWD Priority',
      submitReportBtn: 'Submit Waste Report',
      submittingReport: 'Submitting to Barangay Server...',
      successModalTitle: 'Report Submitted Successfully!',
      successModalSubtitle: 'Your report is recorded in the system and Barangay Officials have been alerted.',
      ticketNumberLabel: 'Ticket Tracking Number',
      trackStatusText: 'You can monitor real-time collection progress under the "My Reports" tab.',
      doneBtn: 'I Understand',
      noPersonalReports: 'No reports submitted from this device yet.',
      noPersonalReportsSub: 'Click "Report Waste" above to submit a new ticket.',
      statusPending: 'In Queue (Waiting)',
      statusDispatched: 'Truck En Route',
      statusResolved: 'Collected (Resolved)',
      statusCancelled: 'Cancelled',
      viewProofBtn: 'View Official Proof',
      proofModalTitle: 'Proof of Collection',
      proofModalSubtitle: 'Official verification photo taken by the Barangay Official upon cleanup:',
      resolvedByLabel: 'Collected and Handled by:',
      collectedAtLabel: 'Collection Timestamp:',
      kagawadNotesLabel: 'Official Field Report:',
      storageSyncBadge: 'Stored on Raspberry Pi 4 Local Cloud',
      piCloudSaved: 'Saved to Barangay Local Storage',
    },
    wasteTypes: {
      household: {
        title: 'Household Trash',
        desc: 'Daily kitchen waste, peelings, food leftovers, packaging',
      },
      bulky: {
        title: 'Bulky Waste / Furniture',
        desc: 'Broken appliances, wood scraps, old mattress, chairs/tables',
      },
      yard: {
        title: 'Yard & Garden Trimmings',
        desc: 'Fallen leaves, grass clippings, cut tree branches',
      },
      hazardous: {
        title: 'Hazardous / E-Waste',
        desc: 'Batteries, broken bulbs, paints, damaged electronics',
      },
    },
    severity: {
      MILD: {
        label: 'Mild / Light Pile',
        desc: '1-2 sacks of waste only',
      },
      MODERATE: {
        label: 'Moderate',
        desc: '3-5 sacks, regular household pile',
      },
      OVERFLOWING: {
        label: 'Severe / Overflowing',
        desc: 'Heavy pile blocking sidewalk or street corner',
      },
      EMERGENCY: {
        label: 'Emergency / Hazardous',
        desc: 'Blocking road access, broken glass, foul odor',
      },
    },
    dashboard: {
      operationsTitle: 'Barangay Operations Command Center',
      operationsSubtitle: 'Barangay 40 & 41 Cavite City • Real-Time Dispatch and Proof Verification',
      tabMap: 'Map & Queue',
      tabLogs: 'History & Logs',
      tabPi: 'Raspberry Pi 4 Hub',
      tabTelegram: 'Telegram Bot',
      tabSource: 'Source Code & Deploy',
      statTotal: 'Total Reports',
      statPending: 'In Queue',
      statDispatched: 'Dispatched',
      statResolved: 'Resolved',
      statPiSync: 'Pi 4 Storage',
      statElderly: 'Senior / PWD Priority',
      filterAll: 'All',
      filterPending: 'Pending',
      filterDispatched: 'Dispatched',
      filterResolved: 'Resolved',
      filterCancelled: 'Cancelled',
      filterBrgy40: 'Brgy 40',
      filterBrgy41: 'Brgy 41',
      filterElderly: 'Senior/PWD',
      searchPlaceholder: 'Search by Ticket #, Resident, Street, or Landmark...',
      emptyQueue: 'No reports found in this category.',
      emptyQueueSub: 'Waiting for new reports from Barangay 40 & 41 residents.',
      actionDispatch: 'Dispatch Sanitation Crew',
      actionResolve: 'Mark as Resolved (Attach Proof)',
      actionCancel: 'Cancel Ticket',
      actionDelete: 'Delete (Spam Removal)',
      ticketDetails: 'Ticket Details',
      reportedBy: 'Reported By',
      reportedAt: 'Report Timestamp',
      locationAddress: 'Location / Landmark',
      severityLabel: 'Waste Severity',
      wasteTypesLabel: 'Waste Categories',
      bagsEstimate: 'Estimated Volume',
      residentPhotosTitle: 'Photos Submitted by Resident',
      resolveModalTitle: 'Official Proof of Collection',
      resolveModalSubtitle: 'You must attach at least 1 photo of the cleaned site as proof for the resident:',
      proofRequiredWarning: 'At least 1 photo of the cleaned site is required before marking as RESOLVED.',
      addProofPhotos: 'Upload Proof Photos',
      kagawadNameLabel: 'Official / Sanitation Crew Name',
      kagawadNotesPlaceholder: 'E.g., Disposed into Cavite City dumpsite truck, area thoroughly cleared...',
      submitProofBtn: 'Save as RESOLVED & Deliver Proof',
      submittingProof: 'Uploading proof photo...',
      cancelModalTitle: 'Cancel Report',
      cancelModalSubtitle: 'Select a reason why this report cannot be collected:',
      cancelPresetReason: 'Select Common Reason',
      cancelCustomReason: 'Other Reason (Optional)',
      confirmCancelBtn: 'Confirm Cancellation',
      deleteModalTitle: 'Delete Report (Spam Removal)',
      deleteModalSubtitle: 'Are you sure you want to permanently delete this report from the system?',
      confirmDeleteBtn: 'Yes, Delete Permanently',
    },
    piCenter: {
      centerTitle: 'Raspberry Pi 4 Interconnection & Local Cloud Hub',
      centerSubtitle: 'Manage the Barangay Hall local server for sovereign and independent data storage',
      connectionStatus: 'Pi Server Connection Status',
      piOnline: 'ONLINE AND CONNECTED',
      piOffline: 'OFFLINE OR UNREACHABLE',
      activeEndpoint: 'Active Pi Server URL',
      testPingBtn: 'Test Connection (Ping)',
      testingPing: 'Testing Pi Connection...',
      connectBtn: 'Save & Connect',
      disconnectBtn: 'Disconnect Pi',
      urlPlaceholder: 'e.g. https://my-pi-tunnel.trycloudflare.com or https://my-pi.ngrok-free.dev',
      hardwareTitle: 'Hardware & System Status',
      specsRam: 'Memory (RAM)',
      specsStorage: 'Disk Storage',
      specsCpuTemp: 'CPU Temperature',
      specsHostname: 'Local Hostname',
      specsIp: 'IP Address',
      photosStoredTitle: 'Photos Stored on Pi',
      residentPhotosCount: 'Resident Waste Photos',
      proofPhotosCount: 'Official Proof Photos',
      savedLogbooksCount: 'Saved Permanent Logbooks',
      livePingLatency: 'Response Latency',
      disconnectModalTitle: 'Are you sure you want to disconnect the Pi?',
      disconnectModalDesc: 'You can reconnect at any time by entering the Pi server URL again.',
      confirmDisconnect: 'Disconnect Now',
      reconnectPrompt: 'Paste your Cloud Server URL link to connect.',
      safePowerTitle: 'Safe Pi Power Management',
      safeShutdownBtn: 'Safely Shutdown Pi',
      safeRebootBtn: 'Restart Pi Server',
    },
    logs: {
      logsTitle: 'Waste Collection History (Resolution Logbook)',
      logsSubtitle: 'Permanent record of all cleared waste with official cleanup proof photos',
      searchPlaceholder: 'Search logs by Ticket #, Resident, or Street...',
      exportCsv: 'Export as CSV',
      printReport: 'Print Logbook',
      totalResolved: 'Total Resolved',
      allProofAvailable: 'Full Proof Available',
      resolvedDate: 'Collection Date',
      ticketCol: 'Ticket #',
      residentCol: 'Resident & Street',
      addressCol: 'Barangay & Location',
      kagawadCol: 'Handled By',
      proofCol: 'Proof of Cleanup',
      noLogsFound: 'No resolved records found in logbook.',
    },
    sourceCode: {
      centerTitle: 'Source Code Archive & File Explorer',
      centerSubtitle: 'Complete project source code package and live file viewer',
      downloadZipServer: 'Direct Download Full Source Code (.ZIP)',
      downloadZipClient: 'Client-Side Backup (.ZIP)',
      viewExplorer: 'Open File Explorer & Code Viewer',
      hideExplorer: 'Hide Code Viewer',
      githubGuideTab: 'GitHub',
      renderGuideTab: 'Cloud',
      piGuideTab: 'Raspberry Pi 4',
      apkGuideTab: 'APK Mobile App',
      renderTipTitle: 'Source Archive Notice:',
      renderTipBody: 'Download the complete source archive below or inspect any file directly.',
      buildCommandLabel: 'Build Command',
      startCommandLabel: 'Start Command',
      copyCommands: 'Copy Commands',
    },
    telegram: {
      centerTitle: 'Barangay Official Telegram Alert Bot',
      centerSubtitle: 'Instant phone push notifications to Barangay Officials when a new waste report is filed',
      botStatus: 'Telegram Bot Status',
      botConfigured: 'CONFIGURED & ACTIVE',
      botNotConfigured: 'NOT CONFIGURED',
      botTokenLabel: 'Telegram Bot Token',
      chatIdLabel: 'Barangay Group Chat ID',
      sendTestBtn: 'Send Test Alert',
      sendingTest: 'Sending test alert...',
      testSuccess: '✓ Test alert successfully delivered to Telegram!',
      setupGuideTitle: 'How to Setup Telegram Bot in 3 Easy Steps',
    },
  },
};
