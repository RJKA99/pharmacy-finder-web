import type { OverpassElement, OverpassResponse } from "./types";

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 8_000;

function buildQuery(lat: number, lon: number, radiusMeters: number): string {
  return `[out:json][timeout:25];
(
  node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
  way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
);
out center tags;`;
}

async function queryMirror(url: string, query: string): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Overpass mirror ${url} responded ${response.status}`);
    }

    const payload = (await response.json()) as OverpassResponse;
    return payload.elements ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Queries OSM Overpass for amenity=pharmacy elements near a point, trying
 * mirrors in order since the public Overpass instances have no uptime SLA.
 */
export async function fetchPharmacyElements(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<OverpassElement[]> {
  const query = buildQuery(lat, lon, radiusMeters);
  let lastError: unknown;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      return await queryMirror(mirror, query);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `All Overpass mirrors failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
