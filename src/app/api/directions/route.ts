import { NextResponse } from "next/server";
import { haversineDistanceMeters } from "@/lib/geo";
import { isOpenAt } from "@/lib/openingHours";
import { findPharmacyById } from "@/lib/pharmacies";
import { checkDailyLimit, checkRateLimit } from "@/lib/rateLimit";
import { fetchRoute } from "@/lib/routing";
import type { DirectionsModeResult, DirectionsResult, TravelMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const TRAVEL_MODES: TravelMode[] = ["foot", "bike", "car"];

// A route this long is never a real request - it's a slow, timeout-prone
// call to the routing providers (and, during an outage, a wasted attempt
// against both providers' quota) for a trip nothing in this app's scope
// would actually make. 300km comfortably covers rural Finland by car.
const MAX_DIRECTIONS_DISTANCE_METERS = 300_000;

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

async function fetchModeResult(
  origin: { lat: number; lon: number },
  pharmacy: { lat: number; lon: number; openingHours: string | null },
  mode: TravelMode,
): Promise<DirectionsModeResult | null> {
  try {
    const route = await fetchRoute(origin, pharmacy, mode);
    const arrivalTime = new Date(Date.now() + route.durationSeconds * 1000);
    return {
      ...route,
      isOpenOnArrival: isOpenAt(pharmacy.openingHours, pharmacy, arrivalTime),
    };
  } catch (error) {
    console.error(`directions lookup failed (${mode})`, error);
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;
  const dailyLimited = checkDailyLimit(request);
  if (dailyLimited) return dailyLimited;

  const { searchParams } = new URL(request.url);
  const lat = parseCoordinate(searchParams.get("lat"), -90, 90);
  const lon = parseCoordinate(searchParams.get("lon"), -180, 180);
  const pharmacyId = searchParams.get("pharmacyId");

  if (lat === null || lon === null || !pharmacyId) {
    return NextResponse.json(
      { error: "lat, lon and pharmacyId are required" },
      { status: 400 },
    );
  }

  // Destination is always looked up server-side from our own dataset, never
  // taken directly from the caller - this proxy must not become a free,
  // unrestricted relay for arbitrary directions requests against either
  // routing provider's key.
  const pharmacy = findPharmacyById(pharmacyId);
  if (!pharmacy) {
    return NextResponse.json({ error: "Unknown pharmacyId" }, { status: 404 });
  }

  const origin = { lat, lon };
  const distanceMeters = haversineDistanceMeters(origin, pharmacy);
  if (distanceMeters > MAX_DIRECTIONS_DISTANCE_METERS) {
    return NextResponse.json(
      {
        error: `That pharmacy is too far away (${Math.round(distanceMeters / 1000)}km) to get directions.`,
      },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    TRAVEL_MODES.map((mode) => fetchModeResult(origin, pharmacy, mode)),
  );

  const directions = Object.fromEntries(
    TRAVEL_MODES.map((mode, index) => [mode, results[index]]),
  ) as DirectionsResult;

  if (TRAVEL_MODES.every((mode) => directions[mode] === null)) {
    return NextResponse.json(
      { error: "Could not calculate directions right now. Please try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json(directions);
}
