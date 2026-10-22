import { beforeEach, describe, expect, it, vi } from "vitest";
import { dedupePharmacies } from "../pharmacies";
import type { PharmacyLocation } from "../types";

const HELSINKI = { lat: 60.1699, lon: 24.9384 };

function makeLocation(overrides: Partial<PharmacyLocation>): PharmacyLocation {
  return {
    id: "overture:1",
    name: "Apteekki",
    lat: 60.17,
    lon: 24.94,
    address: null,
    source: "overture",
    ...overrides,
  };
}

describe("dedupePharmacies", () => {
  it("merges two records within 25m into one, keeping the more complete entry", () => {
    const sparse = makeLocation({ id: "overture:1", lat: 60.1700, lon: 24.9384 });
    const complete = makeLocation({
      id: "overture:2",
      lat: 60.17002,
      lon: 24.93842,
      name: "Yliopiston apteekki",
      address: "Mannerheimintie 1",
    });

    const deduped = dedupePharmacies([sparse, complete]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].name).toBe("Yliopiston apteekki");
  });

  it("keeps separate entries when pharmacies are farther than 25m apart", () => {
    const a = makeLocation({ id: "overture:1", lat: 60.1699, lon: 24.9384, name: "A" });
    const b = makeLocation({ id: "overture:2", lat: 60.18, lon: 24.95, name: "B" });

    expect(dedupePharmacies([a, b])).toHaveLength(2);
  });
});

describe("findNearestPharmacies", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("widens the search radius when the nearest radius has too few results", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [
        makeLocation({ id: "overture:1", lat: HELSINKI.lat + 0.001, lon: HELSINKI.lon, name: "Close" }),
        makeLocation({ id: "overture:2", lat: HELSINKI.lat + 0.03, lon: HELSINKI.lon, name: "Far" }),
        makeLocation({ id: "overture:3", lat: HELSINKI.lat + 0.04, lon: HELSINKI.lon, name: "Far2" }),
      ],
    }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.searchRadiusMeters).toBeGreaterThan(1_500);
    expect(result.pharmacies.length).toBeGreaterThanOrEqual(3);
  });

  it("returns a distance-sorted list without widening when the first radius is enough", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [
        makeLocation({ id: "overture:1", lat: HELSINKI.lat + 0.005, lon: HELSINKI.lon, name: "Mid" }),
        makeLocation({ id: "overture:2", lat: HELSINKI.lat + 0.001, lon: HELSINKI.lon, name: "Near" }),
        makeLocation({ id: "overture:3", lat: HELSINKI.lat + 0.009, lon: HELSINKI.lon, name: "Far" }),
      ],
    }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.searchRadiusMeters).toBe(1_500);
    expect(result.pharmacies.map((p) => p.name)).toEqual(["Near", "Mid", "Far"]);
  });

  it("returns an empty list rather than throwing when nothing is nearby", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({ default: [] }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.pharmacies).toHaveLength(0);
  });
});
