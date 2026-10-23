import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PharmacyLocation, RouteResult } from "@/lib/types";

const fetchWalkingRoute = vi.fn<
  (start: { lat: number; lon: number }, end: { lat: number; lon: number }) => Promise<RouteResult>
>();
const findPharmacyById = vi.fn<(id: string) => PharmacyLocation | undefined>();
const checkRateLimit = vi.fn<(request: Request) => Response | null>();

vi.mock("@/lib/ors", () => ({ fetchWalkingRoute }));
vi.mock("@/lib/pharmacies", () => ({ findPharmacyById }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));

const PHARMACY: PharmacyLocation = {
  id: "overture:1",
  name: "Testiapteekki",
  lat: 60.17,
  lon: 24.94,
  address: null,
  source: "overture",
};

const SAMPLE_ROUTE: RouteResult = {
  coordinates: [[60.169, 24.938], [60.17, 24.94]],
  distanceMeters: 150,
  durationSeconds: 120,
  steps: [{ instruction: "Head north", distanceMeters: 150 }],
};

describe("GET /api/directions", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchWalkingRoute.mockReset();
    findPharmacyById.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockReturnValue(null);
  });

  it("returns 400 when lat/lon/pharmacyId are missing", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/directions?lat=60.17&lon=24.94"));
    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown pharmacyId without calling the routing API", async () => {
    findPharmacyById.mockReturnValue(undefined);
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.17&lon=24.94&pharmacyId=does-not-exist"),
    );

    expect(response.status).toBe(404);
    expect(fetchWalkingRoute).not.toHaveBeenCalled();
  });

  it("looks up the destination server-side rather than trusting client coordinates", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchWalkingRoute.mockResolvedValue(SAMPLE_ROUTE);
    const { GET } = await import("../route");

    await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );

    expect(fetchWalkingRoute).toHaveBeenCalledWith(
      { lat: 60.169, lon: 24.938 },
      expect.objectContaining({ lat: PHARMACY.lat, lon: PHARMACY.lon }),
    );
  });

  it("returns the route for a known pharmacy", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchWalkingRoute.mockResolvedValue(SAMPLE_ROUTE);
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.distanceMeters).toBe(150);
    expect(body.steps).toHaveLength(1);
  });

  it("returns 502 when the routing API fails", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchWalkingRoute.mockRejectedValue(new Error("ORS down"));
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    expect(response.status).toBe(502);
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimit.mockReturnValue(new Response(null, { status: 429 }));
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    expect(response.status).toBe(429);
    expect(findPharmacyById).not.toHaveBeenCalled();
  });
});
