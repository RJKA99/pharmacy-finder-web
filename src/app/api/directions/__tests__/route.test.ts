import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PharmacyLocation, RouteResult, TravelMode } from "@/lib/types";

const fetchRoute = vi.fn<
  (
    start: { lat: number; lon: number },
    end: { lat: number; lon: number },
    mode: TravelMode,
  ) => Promise<RouteResult>
>();
const findPharmacyById = vi.fn<(id: string) => PharmacyLocation | undefined>();
const checkRateLimit = vi.fn<(request: Request) => Response | null>();
const checkDailyLimit = vi.fn<(request: Request) => Response | null>();
const isOpenAt = vi.fn<
  (openingHours: string | null, location: { lat: number; lon: number }, at: Date) => boolean | null
>();

vi.mock("@/lib/routing", () => ({ fetchRoute }));
vi.mock("@/lib/pharmacies", () => ({ findPharmacyById }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit, checkDailyLimit }));
vi.mock("@/lib/openingHours", () => ({ isOpenAt }));

const PHARMACY: PharmacyLocation = {
  id: "overture:1",
  name: "Testiapteekki",
  lat: 60.17,
  lon: 24.94,
  address: null,
  openingHours: "Mo-Fr 08:00-18:00",
  source: "overture",
};

function sampleRoute(distanceMeters: number): RouteResult {
  return {
    coordinates: [[60.169, 24.938], [60.17, 24.94]],
    distanceMeters,
    durationSeconds: 120,
    steps: [{ instruction: "Head north", distanceMeters }],
  };
}

describe("GET /api/directions", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchRoute.mockReset();
    findPharmacyById.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockReturnValue(null);
    checkDailyLimit.mockReset();
    checkDailyLimit.mockReturnValue(null);
    isOpenAt.mockReset();
    isOpenAt.mockReturnValue(true);
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
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it("looks up the destination server-side rather than trusting client coordinates", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchRoute.mockResolvedValue(sampleRoute(150));
    const { GET } = await import("../route");

    await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );

    expect(fetchRoute).toHaveBeenCalledWith(
      { lat: 60.169, lon: 24.938 },
      expect.objectContaining({ lat: PHARMACY.lat, lon: PHARMACY.lon }),
      "foot",
    );
  });

  it("fetches all three travel modes and includes isOpenOnArrival for each", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchRoute.mockResolvedValue(sampleRoute(150));
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(fetchRoute).toHaveBeenCalledTimes(3);
    expect(["foot", "bike", "car"]).toEqual(expect.arrayContaining(Object.keys(body)));
    expect(body.foot.isOpenOnArrival).toBe(true);
    expect(body.car.distanceMeters).toBe(150);
  });

  it("returns a mode as null when only that mode's provider call fails", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchRoute.mockImplementation(async (_start, _end, mode) => {
      if (mode === "car") throw new Error("all providers down for car");
      return sampleRoute(150);
    });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.car).toBeNull();
    expect(body.foot).not.toBeNull();
    expect(body.bike).not.toBeNull();
  });

  it("returns 502 only when every mode fails", async () => {
    findPharmacyById.mockReturnValue(PHARMACY);
    fetchRoute.mockRejectedValue(new Error("all providers down"));
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    expect(response.status).toBe(502);
  });

  it("returns 400 without calling the routing API when the pharmacy is over 300km away", async () => {
    findPharmacyById.mockReturnValue({ ...PHARMACY, lat: 65.0, lon: 25.5 }); // far north
    const { GET } = await import("../route");

    // Origin: Helsinki - genuinely ~550km from the mocked pharmacy.
    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.1699&lon=24.9384&pharmacyId=overture:1"),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/too far away/i);
    expect(fetchRoute).not.toHaveBeenCalled();
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

  it("returns 429 when the daily limit is exceeded", async () => {
    checkDailyLimit.mockReturnValue(new Response(null, { status: 429 }));
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/directions?lat=60.169&lon=24.938&pharmacyId=overture:1"),
    );
    expect(response.status).toBe(429);
    expect(findPharmacyById).not.toHaveBeenCalled();
  });
});
