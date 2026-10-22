import { haversineDistanceMeters } from "./geo";
import { fetchPharmacyElements } from "./overpass";
import type { OverpassElement, Pharmacy, PharmacySearchResult } from "./types";

const FALLBACK_NAME = "Apteekki";

/** OSM nodes that are the same physical pharmacy are rarely farther apart than this. */
const DUPLICATE_CLUSTER_RADIUS_METERS = 25;

const INITIAL_RADIUS_METERS = 1_500;
const MAX_RADIUS_METERS = 5_000;
const MIN_RESULTS_BEFORE_WIDENING = 3;

function buildAddress(tags: Record<string, string>): string | null {
  const street = tags["addr:street"];
  const houseNumber = tags["addr:housenumber"];
  const postcode = tags["addr:postcode"];
  const city = tags["addr:city"];

  const streetLine = [street, houseNumber].filter(Boolean).join(" ");
  const cityLine = [postcode, city].filter(Boolean).join(" ");
  const address = [streetLine, cityLine].filter(Boolean).join(", ");

  return address.length > 0 ? address : null;
}

function elementCoordinates(element: OverpassElement): { lat: number; lon: number } | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

/** Converts raw Overpass elements into our Pharmacy shape, dropping anything unusable. */
export function normalizePharmacyElements(
  elements: OverpassElement[],
  origin: { lat: number; lon: number },
): Pharmacy[] {
  const normalized: Pharmacy[] = [];

  for (const element of elements) {
    const coords = elementCoordinates(element);
    if (!coords) continue;

    const tags = element.tags ?? {};
    const name = tags.name || tags["name:fi"] || tags["name:sv"] || FALLBACK_NAME;

    normalized.push({
      id: `osm:${element.type}/${element.id}`,
      name,
      lat: coords.lat,
      lon: coords.lon,
      distanceMeters: Math.round(haversineDistanceMeters(origin, coords)),
      address: buildAddress(tags),
      source: "osm",
    });
  }

  return normalized;
}

function completenessScore(pharmacy: Pharmacy): number {
  let score = 0;
  if (pharmacy.name !== FALLBACK_NAME) score += 2;
  if (pharmacy.address) score += 1;
  return score;
}

/**
 * Collapses OSM duplicate nodes for the same physical pharmacy (a known OSM
 * pharmacy-data quality issue) by clustering entries within ~25m and keeping
 * the most complete one per cluster.
 */
export function dedupePharmacies(pharmacies: Pharmacy[]): Pharmacy[] {
  const clusters: Pharmacy[] = [];

  for (const candidate of pharmacies) {
    const clusterIndex = clusters.findIndex(
      (existing) =>
        haversineDistanceMeters(existing, candidate) <= DUPLICATE_CLUSTER_RADIUS_METERS,
    );

    if (clusterIndex === -1) {
      clusters.push(candidate);
      continue;
    }

    const existing = clusters[clusterIndex];
    if (completenessScore(candidate) > completenessScore(existing)) {
      clusters[clusterIndex] = candidate;
    }
  }

  return clusters;
}

async function searchAtRadius(
  origin: { lat: number; lon: number },
  radiusMeters: number,
): Promise<Pharmacy[]> {
  const elements = await fetchPharmacyElements(origin.lat, origin.lon, radiusMeters);
  const normalized = normalizePharmacyElements(elements, origin);
  return dedupePharmacies(normalized).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * Finds the nearest pharmacies to a point, widening the search radius once
 * if the initial narrow search comes back too sparse.
 */
export async function findNearestPharmacies(
  origin: { lat: number; lon: number },
): Promise<PharmacySearchResult> {
  let radius = INITIAL_RADIUS_METERS;
  let pharmacies = await searchAtRadius(origin, radius);

  if (pharmacies.length < MIN_RESULTS_BEFORE_WIDENING && radius < MAX_RADIUS_METERS) {
    radius = MAX_RADIUS_METERS;
    pharmacies = await searchAtRadius(origin, radius);
  }

  return {
    pharmacies,
    searchRadiusMeters: radius,
    generatedAt: new Date().toISOString(),
  };
}
