import React from 'react';

// 1. 3D HOUSEHOLD TRASH (Glossy Volumetric Wheelie Bin with Embossed Recycle Crest)
export const ThreeDHouseholdTrash: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hBinBody" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="25%" stopColor="#10b981" />
        <stop offset="70%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="hBinLid" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="40%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="hLidRim" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a7f3d0" />
        <stop offset="50%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#065f46" />
      </linearGradient>
      <radialGradient id="hWheel" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#cbd5e1" />
        <stop offset="50%" stopColor="#475569" />
        <stop offset="100%" stopColor="#0f172a" />
      </radialGradient>
      <linearGradient id="hBinGlint" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Wheels */}
    <circle cx="17" cy="52" r="5" fill="url(#hWheel)" />
    <circle cx="17" cy="52" r="2" fill="#e2e8f0" />
    <circle cx="47" cy="52" r="5" fill="url(#hWheel)" />
    <circle cx="47" cy="52" r="2" fill="#e2e8f0" />
    {/* Bin Body (Tapered) */}
    <path
      d="M17 22 L20.5 53 Q21 56 24 56 L40 56 Q43 56 43.5 53 L47 22 Z"
      fill="url(#hBinBody)"
    />
    {/* Vertical 3D Ribs */}
    <path d="M24 24 L26 52" stroke="#a7f3d0" strokeWidth="1.2" strokeOpacity="0.6" />
    <path d="M32 24 L32 52" stroke="#a7f3d0" strokeWidth="1.2" strokeOpacity="0.5" />
    <path d="M40 24 L38 52" stroke="#064e3b" strokeWidth="1.4" strokeOpacity="0.6" />
    {/* Gloss reflection line */}
    <path d="M19 23 L22 53" stroke="url(#hBinGlint)" strokeWidth="2" strokeLinecap="round" />
    {/* Recycle Symbol Embossed */}
    <g transform="translate(32, 38) scale(0.7)">
      <path
        d="M-4 -7 C-2 -10 2 -10 4 -7 L6 -10 L7 -4 L1 -4 L3 -7 C2 -8 -2 -8 -3 -6 Z"
        fill="#ecfdf5"
      />
      <path
        d="M7 -1 C9 3 6 8 2 9 L3 12 L-2 10 L0 5 L1 7 C4 6 6 2 4 -1 Z"
        fill="#ecfdf5"
      />
      <path
        d="M-2 9 C-6 8 -8 4 -7 0 L-10 0 L-7 -4 L-4 0 L-6 0 C-6 3 -4 6 -2 7 Z"
        fill="#ecfdf5"
      />
    </g>
    {/* Bin Rim Upper Collar */}
    <rect x="15" y="20" width="34" height="4" rx="2" fill="url(#hLidRim)" />
    {/* Bin 3D Curved Heavy Lid */}
    <path
      d="M14 20 C14 16 18 12 32 12 C46 12 50 16 50 20 Z"
      fill="url(#hBinLid)"
    />
    {/* Lid Highlight Crest */}
    <path
      d="M18 18 C22 14 27 13.5 32 13.5 C37 13.5 42 14 46 18"
      stroke="#ffffff"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeOpacity="0.8"
    />
    {/* Lid Front Grip */}
    <rect x="27" y="19" width="10" height="2.5" rx="1" fill="#047857" />
    {/* Rear Hinges */}
    <rect x="22" y="11" width="3" height="3" rx="1" fill="#334155" />
    <rect x="39" y="11" width="3" height="3" rx="1" fill="#334155" />
  </svg>
);

// 2. 3D BULKY WASTE / FURNITURE (Isometric Lounge Armchair with Wood Base)
export const ThreeDBulkyFurniture: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fCushionTop" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="fBackrest" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="35%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="fArmrest" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#93c5fd" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
      <linearGradient id="fWoodLeg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
    </defs>
    {/* Wood Legs */}
    <polygon points="17,48 14,56 16.5,56 19,48" fill="url(#fWoodLeg)" />
    <polygon points="47,48 50,56 47.5,56 45,48" fill="url(#fWoodLeg)" />
    <polygon points="23,48 21,54 23,54 25,48" fill="#78350f" />
    <polygon points="41,48 43,54 41,54 39,48" fill="#78350f" />
    {/* Wooden Underframe Plinth */}
    <rect x="16" y="45" width="32" height="3" rx="1.5" fill="url(#fWoodLeg)" />
    {/* Backrest Cushion */}
    <rect x="18" y="12" width="28" height="26" rx="6" fill="url(#fBackrest)" />
    {/* Tufting Buttons on Backrest */}
    <circle cx="26" cy="22" r="1.8" fill="#1e3a8a" />
    <circle cx="26" cy="22" r="0.8" fill="#bfdbfe" />
    <circle cx="38" cy="22" r="1.8" fill="#1e3a8a" />
    <circle cx="38" cy="22" r="0.8" fill="#bfdbfe" />
    <circle cx="32" cy="28" r="1.8" fill="#1e3a8a" />
    <circle cx="32" cy="28" r="0.8" fill="#bfdbfe" />
    {/* Thick Seat Cushion */}
    <rect x="15" y="32" width="34" height="15" rx="5" fill="url(#fCushionTop)" />
    {/* Seat Top Highlight */}
    <ellipse cx="32" cy="35" rx="14" ry="2" fill="#ffffff" opacity="0.45" />
    {/* Left Rounded Armrest */}
    <rect x="10" y="24" width="9" height="21" rx="4.5" fill="url(#fArmrest)" />
    <ellipse cx="14.5" cy="26" rx="3.5" ry="2" fill="#ffffff" opacity="0.6" />
    {/* Right Rounded Armrest */}
    <rect x="45" y="24" width="9" height="21" rx="4.5" fill="url(#fArmrest)" />
    <ellipse cx="49.5" cy="26" rx="3.5" ry="2" fill="#ffffff" opacity="0.6" />
  </svg>
);

// 3. 3D YARD & GARDEN TRIMMINGS (Lush Botanical Palm Leaf & Fresh Foliage)
export const ThreeDYardGarden: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="yLeafGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="45%" stopColor="#22c55e" />
        <stop offset="85%" stopColor="#15803d" />
        <stop offset="100%" stopColor="#14532d" />
      </linearGradient>
      <linearGradient id="yLeafGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#86efac" />
        <stop offset="60%" stopColor="#16a34a" />
        <stop offset="100%" stopColor="#166534" />
      </linearGradient>
      <linearGradient id="yStemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a3e635" />
        <stop offset="100%" stopColor="#4d7c0f" />
      </linearGradient>
    </defs>
    {/* Background Secondary Leaf */}
    <path
      d="M24 48 C16 36 12 24 22 14 C34 20 32 36 28 50 Z"
      fill="url(#yLeafGrad2)"
      opacity="0.9"
    />
    {/* Main Curved Stem */}
    <path
      d="M18 56 Q30 42 46 16"
      stroke="url(#yStemGrad)"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Primary Big Lush Leaf */}
    <path
      d="M20 54 C24 38 34 22 50 14 C48 30 40 44 26 56 Z"
      fill="url(#yLeafGrad1)"
    />
    {/* Midrib Stem Ridge */}
    <path
      d="M23 52 Q35 34 49 16"
      stroke="#dcfce7"
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.9"
    />
    {/* Leaf Side Veins */}
    <path d="M28 44 Q36 40 42 45" stroke="#bbf7d0" strokeWidth="1.2" strokeOpacity="0.7" strokeLinecap="round" />
    <path d="M33 36 Q40 31 46 35" stroke="#bbf7d0" strokeWidth="1.2" strokeOpacity="0.7" strokeLinecap="round" />
    <path d="M38 27 Q44 23 48 26" stroke="#bbf7d0" strokeWidth="1.2" strokeOpacity="0.7" strokeLinecap="round" />
    {/* Specular Dew Drop Highlight */}
    <ellipse cx="40" cy="22" rx="2.5" ry="1.8" fill="#ffffff" opacity="0.9" />
    <circle cx="39" cy="21.5" r="0.8" fill="#ffffff" />
  </svg>
);

// 4. 3D HAZARDOUS / E-WASTE (Glowing Lithium Battery & Neon Hazard Capsule)
export const ThreeDHazardous: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hazBody" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="30%" stopColor="#f59e0b" />
        <stop offset="70%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
      <linearGradient id="hazTerminal" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f1f5f9" />
        <stop offset="50%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
      <linearGradient id="hazWarning" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
    </defs>
    {/* Battery Top Terminal Nipple */}
    <rect x="28" y="11" width="8" height="5" rx="2" fill="url(#hazTerminal)" />
    {/* Main Cylindrical Battery Body */}
    <rect x="18" y="15" width="28" height="38" rx="6" fill="url(#hazBody)" />
    {/* Specular Highlight Strip */}
    <rect x="21" y="17" width="3" height="34" rx="1.5" fill="#ffffff" opacity="0.55" />
    {/* Lower Terminal Ring */}
    <rect x="18" y="47" width="28" height="6" rx="3" fill="url(#hazTerminal)" />
    {/* Warning Shield Badge */}
    <polygon points="32,24 43,42 21,42" fill="#1e293b" stroke="url(#hazWarning)" strokeWidth="2.5" strokeLinejoin="round" />
    {/* Lightning bolt / Exclamation */}
    <path
      d="M32 28 L32 35 M32 38.5 L32 39.5"
      stroke="#facc15"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

// 5. 3D CAMERA (Glossy Volumetric DSLR with Glass Optics, Flash & Red Accent)
export const ThreeDCamera: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="camBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#64748b" />
        <stop offset="25%" stopColor="#475569" />
        <stop offset="80%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="camTopGrip" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <radialGradient id="camLensBezel" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#cbd5e1" />
        <stop offset="40%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#1e293b" />
      </radialGradient>
      <radialGradient id="camGlassLens" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#67e8f9" />
        <stop offset="35%" stopColor="#0284c7" />
        <stop offset="70%" stopColor="#0369a1" />
        <stop offset="100%" stopColor="#082f49" />
      </radialGradient>
    </defs>
    {/* Top Pentaprism Housing & Hotshoe */}
    <polygon points="21,18 25,12 39,12 43,18" fill="url(#camTopGrip)" />
    <rect x="28" y="10" width="8" height="3" rx="1" fill="#0f172a" />
    {/* Shutter Button */}
    <rect x="13" y="14" width="7" height="4" rx="1.5" fill="#ef4444" />
    {/* Mode Dial */}
    <rect x="44" y="14" width="6" height="4" rx="1" fill="#94a3b8" />
    {/* Main Camera Body */}
    <rect x="8" y="17" width="48" height="36" rx="8" fill="url(#camBodyGrad)" />
    {/* Leatherette Textured Grip */}
    <rect x="10" y="22" width="10" height="28" rx="4" fill="#0f172a" opacity="0.8" />
    {/* Red Accent Ring / Stripe */}
    <rect x="23.5" y="20.5" width="25" height="2" fill="#ef4444" opacity="0.9" />
    {/* Flash Diffuser */}
    <rect x="45" y="21" width="7" height="5" rx="1.5" fill="#fef08a" stroke="#d97706" strokeWidth="0.8" />
    {/* Big 3D Lens Outer Bezel */}
    <circle cx="36" cy="35" r="15" fill="url(#camLensBezel)" />
    <circle cx="36" cy="35" r="12.5" fill="#0f172a" />
    <circle cx="36" cy="35" r="11" fill="url(#camGlassLens)" />
    {/* Aperture ring reflection */}
    <circle cx="36" cy="35" r="7" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.5" fill="none" />
    {/* Lens Specular Curved Glints */}
    <path
      d="M31 28 C34 26 39 26 42 29"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.9"
    />
    <circle cx="41" cy="39" r="1.5" fill="#ffffff" opacity="0.8" />
  </svg>
);

// 6. 3D FOLDER (Glossy Golden & Emerald Tabbed Explorer Folder with Photos)
export const ThreeDFolderGallery: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="folBackG" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="folFrontG" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="45%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="picSky" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#bae6fd" />
        <stop offset="100%" stopColor="#e0f2fe" />
      </linearGradient>
    </defs>
    {/* Back tab */}
    <path
      d="M8 18 C8 15 10 13 13 13 L24 13 L29 18 L51 18 C54 18 56 20 56 23 L56 46 C56 49 54 51 51 51 L13 51 C10 51 8 49 8 46 Z"
      fill="url(#folBackG)"
    />
    {/* Photo Sheet 1 (Tilted Right) */}
    <g transform="rotate(7 35 25)">
      <rect x="22" y="14" width="26" height="22" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
      <rect x="24" y="16" width="22" height="14" rx="1.5" fill="url(#picSky)" />
      <circle cx="28" cy="20" r="2.5" fill="#f59e0b" />
      <polygon points="25,30 31,23 37,28 41,24 45,30" fill="#10b981" />
    </g>
    {/* Photo Sheet 2 (Tilted Left) */}
    <g transform="rotate(-5 28 26)">
      <rect x="14" y="16" width="26" height="22" rx="3" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <rect x="16" y="18" width="22" height="14" rx="1.5" fill="#ecfdf5" />
      <circle cx="21" cy="22" r="2.5" fill="#38bdf8" />
      <polygon points="17,32 24,25 31,31 34,27 37,32" fill="#059669" />
    </g>
    {/* Front Flap */}
    <path
      d="M6 26 C6 23 8 21 11 21 L53 21 C56 21 58 23 58 26 L54 50 C54 53 51 55 48 55 L10 55 C7 55 5 53 5 50 Z"
      fill="url(#folFrontG)"
    />
    {/* Gloss Highlight line on rim */}
    <path d="M10 24 L52 24" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.75" />
    {/* Embossed Gallery/Image symbol on front */}
    <g transform="translate(32, 38) scale(0.85)">
      <circle cx="0" cy="0" r="8" fill="#047857" opacity="0.6" />
      <path d="M-4 -2 L4 -2 M0 -6 L0 2" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </g>
  </svg>
);

// 7. 3D SEVERITY: MILD (Glossy Green Eco Sacks)
export const ThreeDSeverityMild: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="mildBagG" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#a7f3d0" />
        <stop offset="35%" stopColor="#34d399" />
        <stop offset="80%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </radialGradient>
      <linearGradient id="mildKnotG" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#d1fae5" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
    </defs>
    {/* Top Knot / Tie */}
    <ellipse cx="32" cy="17" rx="5" ry="3" fill="url(#mildKnotG)" />
    <rect x="29" y="18" width="6" height="5" rx="2" fill="#047857" />
    {/* Main Sack Body */}
    <path
      d="M24 21 C18 27 12 36 12 45 C12 54 20 57 32 57 C44 57 52 54 52 45 C52 36 46 27 40 21 Z"
      fill="url(#mildBagG)"
    />
    {/* Fold Crease & Gloss Highlight */}
    <path d="M19 35 Q32 42 45 35" stroke="#ecfdf5" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.75" />
    <ellipse cx="26" cy="30" rx="5" ry="2.5" fill="#ffffff" opacity="0.55" />
    {/* Checkmark Badge */}
    <circle cx="32" cy="44" r="5" fill="#ffffff" />
    <path d="M29.5 44 L31.5 46 L34.5 42" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 8. 3D SEVERITY: MODERATE (2 Amber Medium Sacks)
export const ThreeDSeverityModerate: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="modBagG" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="35%" stopColor="#facc15" />
        <stop offset="80%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#a16207" />
      </radialGradient>
    </defs>
    {/* Background Sack (Offset Right) */}
    <g transform="translate(14, -2) scale(0.85)">
      <ellipse cx="32" cy="18" rx="4.5" ry="2.5" fill="#fef08a" />
      <path
        d="M24 22 C18 28 13 36 13 45 C13 53 20 56 32 56 C44 56 51 53 51 45 C51 36 46 28 40 22 Z"
        fill="url(#modBagG)"
      />
    </g>
    {/* Foreground Sack */}
    <g transform="translate(-4, 2) scale(0.92)">
      <ellipse cx="32" cy="18" rx="4.5" ry="2.5" fill="#fef08a" />
      <path
        d="M24 22 C18 28 13 36 13 45 C13 53 20 56 32 56 C44 56 51 53 51 45 C51 36 46 28 40 22 Z"
        fill="url(#modBagG)"
      />
      <ellipse cx="25" cy="32" rx="5" ry="2.5" fill="#ffffff" opacity="0.6" />
      <path d="M19 37 Q32 44 45 37" stroke="#fef9c3" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8" />
      {/* 2 Dots indicator */}
      <circle cx="30" cy="46" r="2" fill="#ffffff" />
      <circle cx="35" cy="46" r="2" fill="#ffffff" />
    </g>
  </svg>
);

// 9. 3D SEVERITY: OVERFLOWING (Overflowing Bin with Spilling Bags)
export const ThreeDSeverityOverflowing: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="overBinG" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="40%" stopColor="#f43f5e" />
        <stop offset="80%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#9f1239" />
      </linearGradient>
      <radialGradient id="spillBagG" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fecdd3" />
        <stop offset="40%" stopColor="#fb7185" />
        <stop offset="100%" stopColor="#be123c" />
      </radialGradient>
    </defs>
    {/* Piled bags overflowing */}
    <circle cx="25" cy="20" r="9" fill="url(#spillBagG)" />
    <circle cx="39" cy="18" r="9.5" fill="url(#spillBagG)" />
    <circle cx="32" cy="13" r="8" fill="#fda4af" />
    {/* Tilted Open Bin Lid */}
    <polygon points="12,22 50,11 52,16 14,27" fill="#f43f5e" />
    <polygon points="14,22 48,12 50,14 16,24" fill="#ffffff" opacity="0.5" />
    {/* Bin Body */}
    <path
      d="M17 26 L20.5 54 Q21 57 25 57 L39 57 Q43 57 43.5 54 L47 26 Z"
      fill="url(#overBinG)"
    />
    {/* Highlights & Warning */}
    <path d="M19 28 L22 53" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
    {/* Exclamation badge */}
    <circle cx="32" cy="42" r="5" fill="#ffffff" />
    <path d="M32 39.5 L32 42.5 M32 45 L32 45.5" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 10. 3D SEVERITY: EMERGENCY (3D Red Siren Beacon with Pulse Rays)
export const ThreeDSeverityEmergency: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sirenGlow" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#fecaca" />
        <stop offset="30%" stopColor="#f87171" />
        <stop offset="70%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#991b1b" />
      </radialGradient>
      <linearGradient id="sirenBase" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="35%" stopColor="#475569" />
        <stop offset="70%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>
    {/* Siren Pulse Rays */}
    <path d="M32 4 L32 10 M14 12 L18 16 M50 12 L46 16 M8 26 L14 26 M56 26 L50 26" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
    {/* Red Glass Dome */}
    <path
      d="M20 44 C20 26 25 14 32 14 C39 14 44 26 44 44 Z"
      fill="url(#sirenGlow)"
    />
    {/* Specular curved glint */}
    <path
      d="M24 38 C24 28 27 20 30 18"
      stroke="#ffffff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeOpacity="0.9"
    />
    {/* Metallic Chrome Base Collar */}
    <rect x="16" y="44" width="32" height="10" rx="3" fill="url(#sirenBase)" />
    <line x1="16" y1="47" x2="48" y2="47" stroke="#cbd5e1" strokeWidth="1.5" />
    <circle cx="32" cy="49" r="1.5" fill="#ef4444" />
  </svg>
);

// 11. 3D SENIOR CITIZEN HEART SHIELD (Volumetric Purple & Gold Heart)
export const ThreeDSeniorHeart: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="snrHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f3e8ff" />
        <stop offset="25%" stopColor="#d8b4fe" />
        <stop offset="60%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
    </defs>
    {/* 3D Heart */}
    <path
      d="M32 18 C25 9 12 13 12 26 C12 39 28 50 32 54 C36 50 52 39 52 26 C52 13 39 9 32 18 Z"
      fill="url(#snrHeartGrad)"
    />
    {/* Glossy Curve Glint */}
    <path
      d="M18 22 C18 15 25 13 29 18"
      stroke="#ffffff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeOpacity="0.85"
    />
    {/* Golden Caring Person Emblem */}
    <circle cx="32" cy="27" r="4.5" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
    <path
      d="M24 41 C24 34 40 34 40 41"
      stroke="#fde047"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

// 12. 3D ASSISTANCE BEACON (Purple Community Aid Radar Disc)
export const ThreeDAssistanceBeacon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="astOrbG" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fdf4ff" />
        <stop offset="35%" stopColor="#e879f9" />
        <stop offset="75%" stopColor="#c026d3" />
        <stop offset="100%" stopColor="#701a75" />
      </radialGradient>
    </defs>
    {/* Concentric Signal Rings */}
    <ellipse cx="32" cy="50" rx="19" ry="5" stroke="#f0abfc" strokeWidth="2" strokeOpacity="0.6" />
    <ellipse cx="32" cy="50" rx="13" ry="3.5" stroke="#e879f9" strokeWidth="1.5" strokeOpacity="0.4" />
    {/* Supporting Pin Stalk */}
    <path d="M32 40 L32 50" stroke="#86198f" strokeWidth="5" strokeLinecap="round" />
    {/* Sphere Orb */}
    <circle cx="32" cy="27" r="15" fill="url(#astOrbG)" />
    {/* Aid Cross / Plus */}
    <path
      d="M32 19 L32 35 M24 27 L40 27"
      stroke="#ffffff"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Gloss Reflection */}
    <ellipse cx="27" cy="22" rx="3.5" ry="2" fill="#ffffff" opacity="0.85" />
  </svg>
);

// 13. 3D LOCATION PIN (Glossy Volumetric Teardrop GPS Pin)
export const ThreeDLocationPin: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="pinG" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="35%" stopColor="#10b981" />
        <stop offset="75%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </radialGradient>
    </defs>
    {/* Target concentric pulses */}
    <ellipse cx="32" cy="58" rx="18" ry="4.5" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4" />
    {/* 3D Teardrop Pin */}
    <path
      d="M32 55 C32 55 48 37 48 24 C48 14 41 7 32 7 C23 7 16 14 16 24 C16 37 32 55 32 55 Z"
      fill="url(#pinG)"
    />
    {/* Inner Core Circle */}
    <circle cx="32" cy="24" r="8" fill="#ffffff" />
    <circle cx="32" cy="24" r="4.5" fill="#059669" />
    {/* Gloss Curve */}
    <path
      d="M22 19 C25 13 32 11 37 13"
      stroke="#ffffff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeOpacity="0.9"
    />
  </svg>
);

// 14. 3D CIVIC / BARANGAY HALL (Isometric Civic Building with Columns)
export const ThreeDBarangayHall: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pedimentRoof" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="colG" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#f1f5f9" />
        <stop offset="100%" stopColor="#cbd5e1" />
      </linearGradient>
    </defs>
    {/* Triangular Pediment Roof */}
    <polygon points="32,12 8,24 56,24" fill="url(#pedimentRoof)" />
    {/* Seal in Pediment */}
    <circle cx="32" cy="20" r="3" fill="#fef08a" />
    {/* Roof Cornice */}
    <rect x="7" y="24" width="50" height="3" rx="1" fill="#0369a1" />
    {/* 4 Classical Columns */}
    <rect x="12" y="27" width="5" height="21" rx="1.5" fill="url(#colG)" />
    <rect x="23" y="27" width="5" height="21" rx="1.5" fill="url(#colG)" />
    <rect x="36" y="27" width="5" height="21" rx="1.5" fill="url(#colG)" />
    <rect x="47" y="27" width="5" height="21" rx="1.5" fill="url(#colG)" />
    {/* Central Portal / Door */}
    <rect x="29" y="34" width="6" height="14" rx="2" fill="#0f172a" />
    {/* Broad Civic Steps Base */}
    <rect x="8" y="48" width="48" height="4" rx="1.5" fill="#cbd5e1" />
    <rect x="5" y="52" width="54" height="4" rx="1.5" fill="#94a3b8" />
  </svg>
);

// 15. 3D VERIFIED CHECK SHIELD (Glossy Emerald Shield with Checkmark)
export const ThreeDCheckShield: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shldG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="40%" stopColor="#10b981" />
        <stop offset="80%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    {/* 3D Crest Shield */}
    <path
      d="M32 9 L48 15 C48 33 39 47 32 53 C25 47 16 33 16 15 Z"
      fill="url(#shldG)"
    />
    {/* Inner Bevel */}
    <path
      d="M32 13 L44 18 C44 32 37 43 32 48 C27 43 20 32 20 18 Z"
      fill="#047857"
      opacity="0.25"
    />
    {/* Specular Edge Glint */}
    <path
      d="M32 11 L18 16 C18 28 22 38 27 44"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeOpacity="0.85"
    />
    {/* Bold Checkmark */}
    <path
      d="M25 30 L30 35 L39 24"
      stroke="#ffffff"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
