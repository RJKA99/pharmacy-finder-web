import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeocodeResult, RouteResult } from "../types";

const orsGeocode = vi.fn<(query: string) => Promise<GeocodeResult[]>>();
const orsFetchWalkingRoute = vi.fn<
  (start: { lat: number; lon: number }, end: { lat: number; lon: number }) => Promise<RouteResult>
>();
const graphhopperGeocode = vi.fn<(query: string) => Promise<GeocodeResult[]>>();
const graphhopperFetchWalkingRoute = vi.fn<
  (start: { lat: number; lon: number }, end: { lat: number; lon: number }) => Promise<RouteResult>
>();

vi.mock("../providers/ors", () => ({
  geocode: orsGeocode,
  fetchWalkingRoute: orsFetchWalkingRoute,
}));
vi.mock("../providers/graphhopper", () => ({
  geocode: graphhopperGeocode,
  fetchWalkingRoute: graphhopperFetchWalkingRoute,
}));

const SAMPLE_RESULTS: GeocodeResult[] = [{ label: "Testikatu 1", lat: 60.17, lon: 24.94 }];
const SAMPLE_ROUTE: RouteResult = {
  coordinates: [[60.17, 24.94]],
  distanceMeters: 100,
  durationSeconds: 60,
  steps: [],
};

describe("routing fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    orsGeocode.mockReset();
    orsFetchWalkingRoute.mockReset();
    graphhopperGeocode.mockReset();
    graphhopperFetchWalkingRoute.mockReset();
  });

  it("uses ORS when it succeeds, without calling GraphHopper", async () => {
    orsGeocode.mockResolvedValue(SAMPLE_RESULTS);
    const { geocode } = await import("../routing");

    const results = await geocode("Testikatu");

    expect(results).toBe(SAMPLE_RESULTS);
    expect(graphhopperGeocode).not.toHaveBeenCalled();
  });

  it("falls back to GraphHopper when ORS geocoding fails", async () => {
    orsGeocode.mockRejectedValue(new Error("ORS geocode responded 403"));
    graphhopperGeocode.mockResolvedValue(SAMPLE_RESULTS);
    const { geocode } = await import("../routing");

    const results = await geocode("Testikatu");

    expect(results).toBe(SAMPLE_RESULTS);
  });

  it("falls back to GraphHopper when ORS routing fails", async () => {
    orsFetchWalkingRoute.mockRejectedValue(new Error("ORS directions responded 403"));
    graphhopperFetchWalkingRoute.mockResolvedValue(SAMPLE_ROUTE);
    const { fetchWalkingRoute } = await import("../routing");

    const route = await fetchWalkingRoute({ lat: 60.17, lon: 24.94 }, { lat: 60.18, lon: 24.95 });

    expect(route).toBe(SAMPLE_ROUTE);
  });

  it("throws a combined error when both providers fail", async () => {
    orsGeocode.mockRejectedValue(new Error("ORS geocode responded 403"));
    graphhopperGeocode.mockRejectedValue(new Error("GraphHopper geocode responded 401"));
    const { geocode } = await import("../routing");

    await expect(geocode("Testikatu")).rejects.toThrow(/ORS geocode responded 403/);
    await expect(geocode("Testikatu")).rejects.toThrow(/GraphHopper geocode responded 401/);
  });
});
