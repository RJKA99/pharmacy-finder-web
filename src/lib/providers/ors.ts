// Server-only: never import this from a "use client" component. The API key
// must never reach the browser bundle - see docs/adr/0002-routing-and-security.md.

import type { GeocodeResult, RouteResult, RouteStep, TravelMode } from "../types";

const ORS_BASE_URL = "https://api.openrouteservice.org";
const REQUEST_TIMEOUT_MS = 8_000;

const ORS_PROFILE: Record<TravelMode, string> = {
  foot: "foot-walking",
  bike: "cycling-regular",
  car: "driving-car",
};

function getApiKey(): string {
  const key = process.env.ORS_API_KEY;
  if (!key) {
    throw new Error("ORS_API_KEY is not configured");
  }
  return key;
}

interface OrsGeocodeFeature {
  properties: { label: string };
  geometry: { coordinates: [number, number] };
}

interface OrsGeocodeResponse {
  features: OrsGeocodeFeature[];
}

/** Forward-geocodes a free-text address/place query to coordinates, restricted to Finland. */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  const url = new URL(`${ORS_BASE_URL}/geocode/search`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("text", query);
  url.searchParams.set("size", "5");
  url.searchParams.set("boundary.country", "FIN");

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`ORS geocode responded ${response.status}`);
  }

  const data = (await response.json()) as OrsGeocodeResponse;
  return data.features.map((feature) => ({
    label: feature.properties.label,
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
  }));
}

interface OrsRouteStep {
  instruction: string;
  distance: number;
}

interface OrsRouteSegment {
  steps: OrsRouteStep[];
}

interface OrsDirectionsFeature {
  geometry: { coordinates: [number, number][] };
  properties: {
    summary: { distance: number; duration: number };
    segments: OrsRouteSegment[];
  };
}

interface OrsDirectionsResponse {
  features: OrsDirectionsFeature[];
}

/** Fetches a route and turn-by-turn steps between two points for a given travel mode. */
export async function fetchRoute(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  mode: TravelMode,
): Promise<RouteResult> {
  const response = await fetch(`${ORS_BASE_URL}/v2/directions/${ORS_PROFILE[mode]}/geojson`, {
    method: "POST",
    headers: {
      Authorization: getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [start.lon, start.lat],
        [end.lon, end.lat],
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`ORS directions (${mode}) responded ${response.status}`);
  }

  const data = (await response.json()) as OrsDirectionsResponse;
  const feature = data.features[0];
  if (!feature) {
    throw new Error("ORS directions returned no route");
  }

  const coordinates: [number, number][] = feature.geometry.coordinates.map(
    ([lon, lat]) => [lat, lon],
  );
  const steps: RouteStep[] = feature.properties.segments.flatMap((segment) =>
    segment.steps.map((step) => ({
      instruction: step.instruction,
      distanceMeters: Math.round(step.distance),
    })),
  );

  return {
    coordinates,
    distanceMeters: Math.round(feature.properties.summary.distance),
    durationSeconds: Math.round(feature.properties.summary.duration),
    steps,
  };
}
