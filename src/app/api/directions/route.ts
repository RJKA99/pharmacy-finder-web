import { NextResponse } from "next/server";
import { fetchWalkingRoute } from "@/lib/ors";
import { findPharmacyById } from "@/lib/pharmacies";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export async function GET(request: Request): Promise<Response> {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;

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
  // unrestricted relay for arbitrary ORS directions requests.
  const pharmacy = findPharmacyById(pharmacyId);
  if (!pharmacy) {
    return NextResponse.json({ error: "Unknown pharmacyId" }, { status: 404 });
  }

  try {
    const route = await fetchWalkingRoute({ lat, lon }, pharmacy);
    return NextResponse.json(route);
  } catch (error) {
    console.error("directions lookup failed", error);
    return NextResponse.json(
      { error: "Could not calculate directions right now. Please try again shortly." },
      { status: 502 },
    );
  }
}
