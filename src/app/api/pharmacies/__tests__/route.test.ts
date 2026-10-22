import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PharmacySearchResult } from "@/lib/types";

const findNearestPharmacies = vi.fn<
  (origin: { lat: number; lon: number }) => Promise<PharmacySearchResult>
>();

vi.mock("@/lib/pharmacies", () => ({
  findNearestPharmacies,
}));

const SAMPLE_RESULT: PharmacySearchResult = {
  pharmacies: [
    {
      id: "osm:node/1",
      name: "Testiapteekki",
      lat: 60.17,
      lon: 24.94,
      distanceMeters: 120,
      address: "Testikatu 1, 00100 Helsinki",
      source: "osm",
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
    findNearestPharmacies.mockResolvedValue(SAMPLE_RESULT);
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
    findNearestPharmacies.mockResolvedValue({
      pharmacies: [],
      searchRadiusMeters: 5000,
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

  it("returns 502 when the upstream lookup fails", async () => {
    findNearestPharmacies.mockRejectedValue(new Error("Overpass down"));
    const { GET } = await import("../route");

    const response = await GET(
      new Request("http://localhost/api/pharmacies?lat=60.17&lon=24.94"),
    );

    expect(response.status).toBe(502);
  });

  it("caches a repeat request for the same coordinates", async () => {
    findNearestPharmacies.mockResolvedValue(SAMPLE_RESULT);
    const { GET } = await import("../route");

    await GET(new Request("http://localhost/api/pharmacies?lat=60.1700&lon=24.9400"));
    await GET(new Request("http://localhost/api/pharmacies?lat=60.1701&lon=24.9401"));

    expect(findNearestPharmacies).toHaveBeenCalledTimes(1);
  });
});
