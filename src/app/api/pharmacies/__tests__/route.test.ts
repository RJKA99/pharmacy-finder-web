import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PharmacySearchResult } from "@/lib/types";

const findNearestPharmacies = vi.fn<
  (origin: { lat: number; lon: number }) => PharmacySearchResult
>();

vi.mock("@/lib/pharmacies", () => ({
  findNearestPharmacies,
}));

const SAMPLE_RESULT: PharmacySearchResult = {
  pharmacies: [
    {
      id: "overture:1",
      name: "Testiapteekki",
      lat: 60.17,
      lon: 24.94,
      distanceMeters: 120,
      address: "Testikatu 1, 00100 Helsinki",
      openingHours: "Mo-Fr 08:00-18:00",
      isOpenNow: true,
      source: "overture",
    },
  ],
  searchRadiusMeters: 1500,
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("GET /api/pharmacies", () => {
  beforeEach(() => {
    vi.resetModules();
    findNearestPharmacies.mockReset();
  });

  it("returns 400 when lat/lon are missing", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/pharmacies"));
    expect(response.status).toBe(400);
  });

  it("returns 400 for out-of-range coordinates", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://localhost/api/pharmacies?lat=999&lon=24.94"),
    );
    expect(response.status).toBe(400);
  });

  it("returns pharmacies for valid coordinates", async () => {
    findNearestPharmacies.mockReturnValue(SAMPLE_RESULT);
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/pharmacies?lat=60.17&lon=24.94"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pharmacies).toHaveLength(1);
    expect(body.pharmacies[0].name).toBe("Testiapteekki");
  });

  it("returns an empty list rather than an error when nothing is found", async () => {
    findNearestPharmacies.mockReturnValue({
      pharmacies: [],
      searchRadiusMeters: 20000,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/pharmacies?lat=0&lon=0"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pharmacies).toHaveLength(0);
  });

  it("returns 500 when the lookup throws unexpectedly", async () => {
    findNearestPharmacies.mockImplementation(() => {
      throw new Error("unexpected failure");
    });
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/pharmacies?lat=60.17&lon=24.94"),
    );

    expect(response.status).toBe(500);
  });
});
