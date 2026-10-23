export interface PharmacyLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  source: "overture";
}

export interface Pharmacy extends PharmacyLocation {
  distanceMeters: number;
}

export interface PharmacySearchResult {
  pharmacies: Pharmacy[];
  searchRadiusMeters: number;
  generatedAt: string;
}

/** Shared with the client: a single address/place search match. */
export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

/** Shared with the client: a single turn-by-turn walking instruction. */
export interface RouteStep {
  instruction: string;
  distanceMeters: number;
}

/** Shared with the client: the `GET /api/directions` response shape. */
export interface RouteResult {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}
