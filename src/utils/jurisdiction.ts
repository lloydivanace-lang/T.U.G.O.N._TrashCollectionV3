/**
 * Official Cadastral / OpenStreetMap Administrative Boundaries & Geolocation Utilities
 * for Barangay 40 (Gumamela) and Barangay 41 (Rosal), Zone 5, Caridad, Cavite City (4100).
 *
 * Grounded in PSA / OpenStreetMap Administrative Level 10 Relations:
 * - Barangay 40 (Gumamela): Relation #9660088 (Cruz Herrera St, Molina St, Lopez Jaena St, Crescini St / Padre Pio St)
 * - Barangay 41 (Rosal):    Relation #20616338 (A. del Rosario St, A. Del Trabajo St, P. Burgos Ave, Molina St, Garcia St, CNHS)
 */

export const BRGY_40_HALL_COORDS: [number, number] = [14.4818738, 120.896097];
export const BRGY_41_HALL_COORDS: [number, number] = [14.483031, 120.8977309];

export const BRGY_40_CENTER: [number, number] = [14.48108, 120.89605];
export const BRGY_41_CENTER: [number, number] = [14.48235, 120.89755];
export const COMBINED_JURISDICTION_CENTER: [number, number] = [14.48185, 120.89685];

/**
 * Barangay 40 (Gumamela), Zone 5, Caridad, Cavite City
 * Bounded by:
 * - North: Cruz Herrera St (encompassing Barangay 40 Hall & Tanod Outpost at 14.4818738, 120.896097)
 * - East:  Molina St (shared border with Barangay 41 Rosal)
 * - South: Boundary with Barangay 39 (Jasmin) from Molina St to Padre Pio St
 * - West:  Crescini St & Padre Pio St (shared border with Barangay 38-A)
 */
export const BRGY_40_POLYGON: [number, number][] = [
  [14.4806235, 120.8948308], // SW corner at Lopez Jaena St & Padre Pio St
  [14.4806479, 120.8950040], // South border (with Brgy 39 Jasmin)
  [14.4804997, 120.8954953],
  [14.4803757, 120.8959029],
  [14.4801551, 120.8966039],
  [14.4799565, 120.8971974],
  [14.4799361, 120.8972488],
  [14.4799112, 120.8973018], // SE corner at Molina St
  [14.4805625, 120.8970902], // East border along Molina St (shared with Brgy 41)
  [14.4812398, 120.8968901], // Molina St & Lopez Jaena St intersection
  [14.4820150, 120.8966720], // NE corner at Molina St & Cruz Herrera St
  [14.4819950, 120.8966250], // North border along Cruz Herrera St north edge (shared with Brgy 41)
  [14.4819550, 120.8963600],
  [14.4819250, 120.8960900], // Encompasses Brgy 40 (Gumamela) Hall & Outpost [14.4818738, 120.896097]
  [14.4817150, 120.8954200],
  [14.4815950, 120.8950480], // NW corner at Crescini St & Cruz Herrera St
  [14.4809064, 120.8951825], // West border along Crescini St (shared with Brgy 38-A)
  [14.4808661, 120.8951037], // Lopez Jaena St jog
  [14.4806235, 120.8948308], // Close at SW corner
];

/**
 * Barangay 41 (Rosal), Zone 5, Caridad, Cavite City
 * Bounded by:
 * - North: A. del Rosario St (shared border with Barangay 47-A & Barangay 47)
 * - East:  A. Del Trabajo St (shared border with Barangay 56 Labanos)
 * - South: P. Burgos Ave (from A. Del Trabajo St to Molina St)
 * - Inner SW: Molina St & Cruz Herrera St (seamless shared border with Barangay 40 Gumamela)
 * - West:  Crescini St (along Cavite National High School, shared with Barangay 38-A)
 */
export const BRGY_41_POLYGON: [number, number][] = [
  [14.4834146, 120.8946901], // West border along Crescini St
  [14.4831835, 120.8947356],
  [14.4826814, 120.8948344],
  [14.4821774, 120.8949335], // Crescini St & Santiago St
  [14.4819173, 120.8949847],
  [14.4815950, 120.8950480], // Shared corner with Brgy 40 at Crescini St & Cruz Herrera St
  [14.4817150, 120.8954200], // Shared border with Brgy 40 along Cruz Herrera St
  [14.4819250, 120.8960900], // Shared border just north of Brgy 40 Hall & Outpost
  [14.4819550, 120.8963600],
  [14.4819950, 120.8966250],
  [14.4820150, 120.8966720], // Shared corner at Molina St & Cruz Herrera St
  [14.4812398, 120.8968901], // Shared border with Brgy 40 along Molina St
  [14.4805625, 120.8970902],
  [14.4799112, 120.8973018], // Shared SE corner of Brgy 40 at Molina St
  [14.4793305, 120.8974967], // SW tip of Brgy 41 at Molina St & P. Burgos Ave
  [14.4794976, 120.8978946], // South border along P. Burgos Ave
  [14.4797600, 120.8984893],
  [14.4799393, 120.8988947],
  [14.4799816, 120.8989903], // SE corner at P. Burgos Ave & A. Del Trabajo St
  [14.4804916, 120.8988820], // East border along A. Del Trabajo St
  [14.4806026, 120.8988688],
  [14.4812199, 120.8988019], // A. Del Trabajo St & Lopez Jaena St
  [14.4814984, 120.8987929],
  [14.4820125, 120.8988099],
  [14.4824366, 120.8988536],
  [14.4831723, 120.8988940],
  [14.4832706, 120.8988992], // NE corner at A. Del Trabajo St & A. del Rosario St
  [14.4833036, 120.8988244], // North border along A. del Rosario St
  [14.4834757, 120.8984350],
  [14.4836792, 120.8979706],
  [14.4838515, 120.8975173], // A. del Rosario St & Garcia St (north of Brgy 41 Hall)
  [14.4838769, 120.8974356],
  [14.4838968, 120.8973504],
  [14.4839594, 120.8970567],
  [14.4840224, 120.8967615], // A. del Rosario St & Kapayapaan St Ext
  [14.4841036, 120.8960406], // A. del Rosario St & M. Rodriguez St
  [14.4841206, 120.8955745], // Northernmost vertex on A. del Rosario St
  [14.4836861, 120.8956762], // NW step around Brgy 38-A / 47-B corner
  [14.4836095, 120.8953813],
  [14.4835712, 120.8952083],
  [14.4835316, 120.8950649],
  [14.4834537, 120.8948311],
  [14.4834146, 120.8946901], // Close at Crescini St
];

/**
 * Verified OpenStreetMap street centerlines in Barangay 40 (Gumamela) & Barangay 41 (Rosal)
 * for instantaneous (<1ms) zero-latency street matching before/alongside cloud geocoding.
 */
interface StreetPolyline {
  name: string;
  points: [number, number][];
}

const CAVITE_JURISDICTION_STREETS: StreetPolyline[] = [
  {
    name: 'Cruz Herrera St.',
    points: [
      [14.481595, 120.895048],
      [14.481715, 120.89542],
      [14.4819, 120.89609],
      [14.482015, 120.896672],
      [14.48215, 120.89775],
      [14.48224, 120.89882],
    ],
  },
  {
    name: 'Molina St.',
    points: [
      [14.4793305, 120.8974967],
      [14.4799112, 120.8973018],
      [14.4805625, 120.8970902],
      [14.4812398, 120.8968901],
      [14.482015, 120.896672],
      [14.48305, 120.89636],
      [14.48406, 120.89608],
    ],
  },
  {
    name: 'Garcia St.',
    points: [
      [14.48122, 120.89815],
      [14.48215, 120.89795],
      [14.483031, 120.8977309],
      [14.4838515, 120.8975173],
    ],
  },
  {
    name: 'Lopez Jaena St.',
    points: [
      [14.4806235, 120.8948308],
      [14.4808661, 120.8951037],
      [14.48105, 120.89601],
      [14.4812398, 120.8968901],
      [14.48123, 120.89785],
      [14.4812199, 120.8988019],
    ],
  },
  {
    name: 'Crescini St.',
    points: [
      [14.4809064, 120.8951825],
      [14.481595, 120.895048],
      [14.4821774, 120.8949335],
      [14.4826814, 120.8948344],
      [14.4834146, 120.8946901],
    ],
  },
  {
    name: 'A. del Rosario St.',
    points: [
      [14.4841206, 120.8955745],
      [14.4841036, 120.8960406],
      [14.4840224, 120.8967615],
      [14.4838515, 120.8975173],
      [14.4834757, 120.898435],
      [14.4832706, 120.8988992],
    ],
  },
  {
    name: 'A. Del Trabajo St.',
    points: [
      [14.4799816, 120.8989903],
      [14.4806026, 120.8988688],
      [14.4812199, 120.8988019],
      [14.4820125, 120.8988099],
      [14.4832706, 120.8988992],
    ],
  },
  {
    name: 'P. Burgos Ave.',
    points: [
      [14.4793305, 120.8974967],
      [14.4794976, 120.8978946],
      [14.47976, 120.8984893],
      [14.4799816, 120.8989903],
    ],
  },
  {
    name: 'Santiago St.',
    points: [
      [14.4821774, 120.8949335],
      [14.48238, 120.89575],
      [14.48256, 120.89652],
    ],
  },
  {
    name: 'Kapayapaan St.',
    points: [
      [14.48212, 120.89726],
      [14.48305, 120.89701],
      [14.4840224, 120.8967615],
    ],
  },
  {
    name: 'M. Rodriguez St.',
    points: [
      [14.48256, 120.89645],
      [14.48335, 120.89624],
      [14.4841036, 120.8960406],
    ],
  },
  {
    name: 'Padre Pio St.',
    points: [
      [14.4806235, 120.8948308],
      [14.4802, 120.89496],
    ],
  },
];

/**
 * Exact Haversine distance in meters between two WGS84 coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Standard ray-casting point-in-polygon test for [lat, lng] coordinates.
 */
export function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToPolylineMeters(lat: number, lng: number, points: [number, number][]): number {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const metersPerDegLat = 111132;
  const metersPerDegLng = 111320 * cosLat;

  let minDistSq = Infinity;
  for (let i = 1; i < points.length; i++) {
    const ax = (points[i - 1][1] - lng) * metersPerDegLng;
    const ay = (points[i - 1][0] - lat) * metersPerDegLat;
    const bx = (points[i][1] - lng) * metersPerDegLng;
    const by = (points[i][0] - lat) * metersPerDegLat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    }
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const distSq = projX * projX + projY * projY;
    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }
  return Math.sqrt(minDistSq);
}

/**
 * Approximate minimum distance in meters from a [lat, lng] point to any edge of a polygon.
 * Used to provide a small street-width tolerance (~18m) for mobile GPS drift along boundary roads.
 */
export function distanceToPolygonMeters(lat: number, lng: number, polygon: [number, number][]): number {
  if (isPointInPolygon(lat, lng, polygon)) return 0;
  return distanceToPolylineMeters(lat, lng, polygon);
}

/**
 * Evaluates whether a GPS coordinate falls within Barangay 40 (Gumamela) or Barangay 41 (Rosal)
 * using exact polygon containment plus an adaptive curbside GPS tolerance on outer boundary streets.
 */
export function evaluateJurisdiction(
  lat: number,
  lng: number,
  specifiedBarangay?: string,
  gpsBufferMeters = 18
): {
  isWithinBrgy40: boolean;
  isWithinBrgy41: boolean;
  isWithinJurisdiction: boolean;
  detectedBarangay: 'Barangay 40' | 'Barangay 41' | 'Outside Jurisdiction';
} {
  const exactB40 = isPointInPolygon(lat, lng, BRGY_40_POLYGON);
  const exactB41 = !exactB40 && isPointInPolygon(lat, lng, BRGY_41_POLYGON);

  let isWithinBrgy40 = exactB40;
  let isWithinBrgy41 = exactB41;

  if (!exactB40 && !exactB41 && gpsBufferMeters > 0) {
    const dist40 = distanceToPolygonMeters(lat, lng, BRGY_40_POLYGON);
    const dist41 = distanceToPolygonMeters(lat, lng, BRGY_41_POLYGON);
    if (dist40 <= gpsBufferMeters && dist40 <= dist41) {
      isWithinBrgy40 = true;
    } else if (dist41 <= gpsBufferMeters) {
      isWithinBrgy41 = true;
    }
  }

  const isWithinJurisdiction = isWithinBrgy40 || isWithinBrgy41;

  let detectedBarangay: 'Barangay 40' | 'Barangay 41' | 'Outside Jurisdiction' = 'Outside Jurisdiction';
  if (isWithinBrgy40) {
    detectedBarangay = 'Barangay 40';
  } else if (isWithinBrgy41) {
    detectedBarangay = 'Barangay 41';
  } else if (specifiedBarangay?.includes('40')) {
    detectedBarangay = 'Barangay 40';
  } else if (specifiedBarangay?.includes('41')) {
    detectedBarangay = 'Barangay 41';
  }

  return {
    isWithinBrgy40,
    isWithinBrgy41,
    isWithinJurisdiction,
    detectedBarangay,
  };
}

/**
 * Instant (<1ms) local cadastral street resolver for Barangay 40 (Gumamela) & Barangay 41 (Rosal).
 * Returns null when outside the immediate Caridad Brgy 40/41 area so external reverse-geocoding
 * accurately names outside locations without delay.
 */
export function resolveLocalCaviteStreet(
  lat: number,
  lng: number
): {
  streetName: string;
  barangayLabel: string;
  fullAddress: string;
  distanceMeters: number;
} | null {
  const juris = evaluateJurisdiction(lat, lng, undefined, 28);
  if (!juris.isWithinJurisdiction) {
    return null;
  }

  const barangayLabel = juris.isWithinBrgy40
    ? 'Barangay 40 (Gumamela)'
    : 'Barangay 41 (Rosal)';

  let nearestStreet = '';
  let nearestDist = Infinity;

  for (const st of CAVITE_JURISDICTION_STREETS) {
    const d = distanceToPolylineMeters(lat, lng, st.points);
    if (d < nearestDist) {
      nearestDist = d;
      nearestStreet = st.name;
    }
  }

  if (nearestStreet && nearestDist <= 55) {
    return {
      streetName: nearestStreet,
      barangayLabel,
      fullAddress: `${nearestStreet}, ${barangayLabel}, Caridad, Cavite City`,
      distanceMeters: Math.round(nearestDist),
    };
  }

  return {
    streetName: '',
    barangayLabel,
    fullAddress: `${barangayLabel}, Caridad, Cavite City`,
    distanceMeters: Math.round(nearestDist),
  };
}
