import pharmacyDataset from "@/data/pharmacies.json";
import { haversineDistanceMeters } from "./geo";
import type { Pharmacy, PharmacyLocation, PharmacySearchResult } from "./types";

const FALLBACK_NAME = "Apteekki";

/** Overture (like OSM) re-surveys the same physical pharmacy more than once. */
const DUPLICATE_CLUSTER_RADIUS_METERS = 25;

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

/** Looks up a pharmacy by id in the bundled dataset - used to constrain the
 * directions API to known destinations instead of accepting arbitrary
 * caller-supplied coordinates. */
export function findPharmacyById(id: string): PharmacyLocation | undefined {
  return getDedupedDataset().find((location) => location.id === id);
}

/** How many of the nearest pharmacies to return. */
const RESULT_COUNT = 5;

/**
 * Finds the nearest pharmacies to a point from the bundled dataset
 * (src/data/pharmacies.json, see scripts/fetch_pharmacies.py).
 *
 * This always returns the closest pharmacies that exist, however far away
 * they are - there is no distance cutoff. Finland's pharmacy coverage is
 * uneven (rural areas can have the nearest one 30km+ away), and "find the
 * nearest pharmacy" should never come back empty just because nothing was
 * within an arbitrary radius.
 */
export function findNearestPharmacies(
  origin: { lat: number; lon: number },
): PharmacySearchResult {
  const pharmacies = getDedupedDataset()
    .map((location) => withDistance(location, origin))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, RESULT_COUNT);

  const searchRadiusMeters = pharmacies.at(-1)?.distanceMeters ?? 0;

  return {
    pharmacies,
    searchRadiusMeters,
    generatedAt: new Date().toISOString(),
  };
}
