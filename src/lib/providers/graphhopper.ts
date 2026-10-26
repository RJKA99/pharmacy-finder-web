// Server-only: never import this from a "use client" component. The API key
// must never reach the browser bundle - see docs/adr/0002-routing-and-security.md.
//
// Fallback provider for src/lib/routing.ts, used only when OpenRouteService
// fails - see docs/adr/0003-routing-provider-fallback.md for why.

import type { GeocodeResult, RouteResult, RouteStep, TravelMode } from "../types";

const GRAPHHOPPER_BASE_URL = "https://graphhopper.com/api/1";
const REQUEST_TIMEOUT_MS = 8_000;

const GRAPHHOPPER_PROFILE: Record<TravelMode, string> = {
  foot: "foot",
  bike: "bike",
  car: "car",
};

function getApiKey(): string {
  const key = process.env.GRAPHHOPPER_API_KEY;
  if (!key) {
    throw new Error("GRAPHHOPPER_API_KEY is not configured");
  }
  return key;
}

interface GraphHopperHit {
  name: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  country?: string;
  point: { lat: number; lng: number };
}

interface GraphHopperGeocodeResponse {
  hits: GraphHopperHit[];
}

// Multiple venues (a pharmacy, a hotel, a bar...) can share the same street
// address, so the address alone isn't enough to tell results apart in a
// search dropdown - lead with the place name whenever it adds information
// the address doesn't already have.
function buildLabel(hit: GraphHopperHit): string {
  const streetLine = [hit.street, hit.housenumber].filter(Boolean).join(" ");
  const cityLine = [hit.postcode, hit.city].filter(Boolean).join(" ");
  const addressLabel = [streetLine, cityLine, hit.country].filter(Boolean).join(", ");

  if (hit.name && !addressLabel.includes(hit.name)) {
    return addressLabel ? `${hit.name}, ${addressLabel}` : hit.name;
  }
  return addressLabel || hit.name;
}

/** Forward-geocodes a free-text address/place query to coordinates. */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  const url = new URL(`${GRAPHHOPPER_BASE_URL}/geocode`);
  url.searchParams.set("key", getApiKey());
  url.searchParams.set("q", query);
  url.searchParams.set("locale", "fi");
  url.searchParams.set("limit", "5");

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`GraphHopper geocode responded ${response.status}`);
  }

  const data = (await response.json()) as GraphHopperGeocodeResponse;
  return data.hits.map((hit) => ({
    label: buildLabel(hit),
    lat: hit.point.lat,
    lon: hit.point.lng,
  }));
}

interface GraphHopperInstruction {
  text: string;
  distance: number;
}

interface GraphHopperPath {
  distance: number;
  time: number;
  points: { coordinates: [number, number, number?][] };
  instructions: GraphHopperInstruction[];
}

interface GraphHopperRouteResponse {
  paths: GraphHopperPath[];
}

/** Fetches a route and turn-by-turn steps between two points for a given travel mode. */
export async function fetchRoute(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  mode: TravelMode,
): Promise<RouteResult> {
  const url = new URL(`${GRAPHHOPPER_BASE_URL}/route`);
  url.searchParams.set("key", getApiKey());
  url.searchParams.append("point", `${start.lat},${start.lon}`);
  url.searchParams.append("point", `${end.lat},${end.lon}`);
  url.searchParams.set("profile", GRAPHHOPPER_PROFILE[mode]);
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "true");
  url.searchParams.set("locale", "en");

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`GraphHopper route (${mode}) responded ${response.status}`);
  }

  const data = (await response.json()) as GraphHopperRouteResponse;
  const path = data.paths[0];
  if (!path) {
    throw new Error("GraphHopper route returned no path");
  }

  const coordinates: [number, number][] = path.points.coordinates.map(
    ([lon, lat]) => [lat, lon],
  );
  const steps: RouteStep[] = path.instructions.map((instruction) => ({
    instruction: instruction.text,
    distanceMeters: Math.round(instruction.distance),
  }));

  return {
    coordinates,
    distanceMeters: Math.round(path.distance),
    durationSeconds: Math.round(path.time / 1000),
    steps,
  };
}
