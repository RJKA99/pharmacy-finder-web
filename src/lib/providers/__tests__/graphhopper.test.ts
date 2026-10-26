import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GraphHopper provider", () => {
  const originalKey = process.env.GRAPHHOPPER_API_KEY;

  beforeEach(() => {
    process.env.GRAPHHOPPER_API_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.GRAPHHOPPER_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("parses geocode hits into GeocodeResult, building a readable label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          hits: [
            {
              name: "Mannerheimintie",
              street: "Mannerheimintie",
              housenumber: "5",
              postcode: "00100",
              city: "Helsinki",
              country: "Finland",
              point: { lat: 60.17, lng: 24.94 },
            },
          ],
        }),
      }),
    );

    const { geocode } = await import("../graphhopper");
    const results = await geocode("Mannerheimintie 5");

    expect(results).toEqual([
      { label: "Mannerheimintie 5, 00100, Helsinki, Finland", lat: 60.17, lon: 24.94 },
    ]);
  });

  it("parses a route response, converting [lon, lat] points to [lat, lon] and ms to seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paths: [
            {
              distance: 250.4,
              time: 180000,
              points: { coordinates: [[24.94, 60.17, 10], [24.941, 60.171, 11]] },
              instructions: [{ text: "Head north", distance: 250.4 }],
            },
          ],
        }),
      }),
    );

    const { fetchWalkingRoute } = await import("../graphhopper");
    const route = await fetchWalkingRoute({ lat: 60.17, lon: 24.94 }, { lat: 60.171, lon: 24.941 });

    expect(route.coordinates).toEqual([[60.17, 24.94], [60.171, 24.941]]);
    expect(route.distanceMeters).toBe(250);
    expect(route.durationSeconds).toBe(180);
    expect(route.steps).toEqual([{ instruction: "Head north", distanceMeters: 250 }]);
  });

  it("throws when the API key env var is missing, without making a request", async () => {
    delete process.env.GRAPHHOPPER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { geocode } = await import("../graphhopper");
    await expect(geocode("Helsinki")).rejects.toThrow(/GRAPHHOPPER_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a descriptive error on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { geocode } = await import("../graphhopper");
    await expect(geocode("Helsinki")).rejects.toThrow(/responded 401/);
  });
});
