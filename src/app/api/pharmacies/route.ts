import { NextResponse } from "next/server";
import { findNearestPharmacies } from "@/lib/pharmacies";

// Every request has different lat/lon; never let a static-looking GET get
// cached across coordinates.
export const dynamic = "force-dynamic";

function parseCoordinate(value: string | null, min: number, max: number): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
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

  try {
    const result = findNearestPharmacies({ lat, lon });
    return NextResponse.json(result);
  } catch (error) {
    console.error("pharmacy lookup failed", error);
    return NextResponse.json(
      { error: "Failed to look up pharmacies right now. Please try again shortly." },
      { status: 500 },
    );
  }
}
