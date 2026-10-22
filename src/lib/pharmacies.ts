import pharmacyDataset from "@/data/pharmacies.json";
import { haversineDistanceMeters } from "./geo";
import type { Pharmacy, PharmacyLocation, PharmacySearchResult } from "./types";

const FALLBACK_NAME = "Apteekki";

/** Overture (like OSM) re-surveys the same physical pharmacy more than once. */
const DUPLICATE_CLUSTER_RADIUS_METERS = 25;

/** Widened in order until at least 3 results are found, or the list runs out. */
const SEARCH_RADII_METERS = [1_500, 5_000, 20_000];

function completenessScore(location: PharmacyLocation): number {
  let score = 0;
  if (location.name !== FALLBACK_NAME) score += 2;
  if (location.address) score += 1;
  return score;
}

/**
 * Collapses duplicate place records for the same physical pharmacy (a known
 * data-quality issue in both OSM and Overture) by clustering entries within
 * ~25m and keeping the most complete one per cluster.
 */
export function dedupePharmacies(locations: PharmacyLocation[]): PharmacyLocation[] {
  const clusters: PharmacyLocation[] = [];

  for (const candidate of locations) {
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

// Deduplicated once per warm instance - the dataset is static, so there's no
// need to redo this clustering work on every request.
let dedupedDataset: PharmacyLocation[] | null = null;

function getDedupedDataset(): PharmacyLocation[] {
  if (!dedupedDataset) {
    dedupedDataset = dedupePharmacies(pharmacyDataset as PharmacyLocation[]);
  }
  return dedupedDataset;
}

function withDistance(location: PharmacyLocation, origin: { lat: number; lon: number }): Pharmacy {
  return { ...location, distanceMeters: Math.round(haversineDistanceMeters(origin, location)) };
}

function searchAtRadius(
  origin: { lat: number; lon: number },
  radiusMeters: number,
): Pharmacy[] {
  return getDedupedDataset()
    .map((location) => withDistance(location, origin))
    .filter((pharmacy) => pharmacy.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

const MIN_RESULTS_BEFORE_WIDENING = 3;

/**
 * Finds the nearest pharmacies to a point from the bundled dataset
 * (src/data/pharmacies.json, see scripts/fetch_pharmacies.py), widening the
 * search radius until at least 3 results are found or the radii run out.
 */
export function findNearestPharmacies(
  origin: { lat: number; lon: number },
): PharmacySearchResult {
  let pharmacies: Pharmacy[] = [];
  let radius = SEARCH_RADII_METERS[0];

  for (const candidateRadius of SEARCH_RADII_METERS) {
    radius = candidateRadius;
    pharmacies = searchAtRadius(origin, radius);
    if (pharmacies.length >= MIN_RESULTS_BEFORE_WIDENING) break;
  }

  return {
    pharmacies,
    searchRadiusMeters: radius,
    generatedAt: new Date().toISOString(),
  };
}
