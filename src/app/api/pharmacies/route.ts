import { NextResponse } from "next/server";
import { TtlCache } from "@/lib/cache";
import { findNearestPharmacies } from "@/lib/pharmacies";
import type { PharmacySearchResult } from "@/lib/types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new TtlCache<PharmacySearchResult>(CACHE_TTL_MS);

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/** Rounds to ~111m precision so nearby repeat requests hit the same cache entry. */
function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get("lat"), -90, 90);
  const lon = parseCoordinate(searchParams.get("lon"), -180, 180);

  if (lat === null || lon === null) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required and must be valid coordinates" },
      { status: 400 },
    );
  }

  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const result = await findNearestPharmacies({ lat, lon });
    cache.set(key, result);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to look up pharmacies right now. Please try again shortly." },
      { status: 502 },
    );
  }
}
