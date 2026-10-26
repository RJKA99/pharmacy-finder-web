// Server-only: never import this from a "use client" component. The API key
// must never reach the browser bundle - see docs/adr/0002-routing-and-security.md.
//
// Fallback provider for src/lib/routing.ts, used only when OpenRouteService
// fails - see docs/adr/0003-routing-provider-fallback.md for why.

import type { GeocodeResult, RouteResult, RouteStep } from "../types";

const GRAPHHOPPER_BASE_URL = "https://graphhopper.com/api/1";
const REQUEST_TIMEOUT_MS = 8_000;

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

function buildLabel(hit: GraphHopperHit): string {
  const streetLine = [hit.street, hit.housenumber].filter(Boolean).join(" ");
  const parts = [streetLine || hit.name, hit.postcode, hit.city, hit.country].filter(Boolean);
  return parts.join(", ");
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

/** Fetches a walking route and turn-by-turn steps between two points. */
export async function fetchWalkingRoute(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
): Promise<RouteResult> {
  const url = new URL(`${GRAPHHOPPER_BASE_URL}/route`);
  url.searchParams.set("key", getApiKey());
  url.searchParams.append("point", `${start.lat},${start.lon}`);
  url.searchParams.append("point", `${end.lat},${end.lon}`);
  url.searchParams.set("profile", "foot");
  url.searchParams.set("points_encoded", "false");
  url.searchParams.set("instructions", "true");
  url.searchParams.set("locale", "en");

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`GraphHopper route responded ${response.status}`);
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
