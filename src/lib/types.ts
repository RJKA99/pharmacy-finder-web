export interface PharmacyLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  /** Raw OSM opening_hours syntax, e.g. "Mo-Fr 08:00-19:00; Sa 09:00-17:00". Null if unknown. */
  openingHours: string | null;
  source: "overture";
}

export interface Pharmacy extends PharmacyLocation {
  distanceMeters: number;
  /** Whether it's open right now. Null if opening hours are unknown. */
  isOpenNow: boolean | null;
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

/** Shared with the client: a single turn-by-turn instruction. */
export interface RouteStep {
  instruction: string;
  distanceMeters: number;
}

export type TravelMode = "foot" | "bike" | "car";

/** A route for one travel mode, as returned by a routing provider - no
 * opening-hours awareness, providers don't know about pharmacies. */
export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  steps: RouteStep[];
}

/** Shared with the client: one mode's result in the `GET /api/directions`
 * response - a RouteResult plus whether the pharmacy will still be open
 * after a trip of this duration (null if hours are unknown). */
export interface DirectionsModeResult extends RouteResult {
  isOpenOnArrival: boolean | null;
}

/** Shared with the client: the full `GET /api/directions` response shape.
 * Each mode is null if that specific mode's route couldn't be computed, so
 * one failing provider call doesn't take down the other two modes. */
export type DirectionsResult = Record<TravelMode, DirectionsModeResult | null>;
