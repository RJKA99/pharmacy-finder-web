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
    openingHours: null,
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

  it("prefers a duplicate that has opening hours over one that doesn't", () => {
    const withoutHours = makeLocation({ id: "overture:1", lat: 60.1700, lon: 24.9384, name: "Same Apteekki" });
    const withHours = makeLocation({
      id: "overture:2",
      lat: 60.17002,
      lon: 24.93842,
      name: "Same Apteekki",
      openingHours: "Mo-Fr 08:00-18:00",
    });

    const deduped = dedupePharmacies([withoutHours, withHours]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].openingHours).toBe("Mo-Fr 08:00-18:00");
  });
});

describe("findNearestPharmacies", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a distance-sorted list of the nearest pharmacies", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [
        makeLocation({ id: "overture:1", lat: HELSINKI.lat + 0.005, lon: HELSINKI.lon, name: "Mid" }),
        makeLocation({ id: "overture:2", lat: HELSINKI.lat + 0.001, lon: HELSINKI.lon, name: "Near" }),
        makeLocation({ id: "overture:3", lat: HELSINKI.lat + 0.009, lon: HELSINKI.lon, name: "Far" }),
      ],
    }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.pharmacies.map((p) => p.name)).toEqual(["Near", "Mid", "Far"]);
    expect(result.searchRadiusMeters).toBe(result.pharmacies.at(-1)?.distanceMeters);
  });

  it("never returns an empty list when the dataset has pharmacies, no matter how far away they are", async () => {
    // ~550km from Helsinki - nothing remotely "nearby", but still a real answer.
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [makeLocation({ id: "overture:far", lat: 65.0, lon: 25.5, name: "Far north" })],
    }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.pharmacies).toHaveLength(1);
    expect(result.pharmacies[0].name).toBe("Far north");
    expect(result.pharmacies[0].distanceMeters).toBeGreaterThan(400_000);
  });

  it("caps the result count even when many pharmacies are nearby", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: Array.from({ length: 20 }, (_, i) =>
        makeLocation({ id: `overture:${i}`, lat: HELSINKI.lat + i * 0.0001, lon: HELSINKI.lon }),
      ),
    }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.pharmacies).toHaveLength(5);
  });

  it("includes isOpenNow for each result, null when hours are unknown", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [
        makeLocation({ id: "overture:1", lat: HELSINKI.lat, lon: HELSINKI.lon, openingHours: null }),
      ],
    }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.pharmacies[0].isOpenNow).toBeNull();
  });

  it("returns an empty list rather than throwing when the dataset itself is empty", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({ default: [] }));

    const { findNearestPharmacies } = await import("../pharmacies");
    const result = findNearestPharmacies(HELSINKI);

    expect(result.pharmacies).toHaveLength(0);
  });
});

describe("findPharmacyById", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the matching location for a known id", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [makeLocation({ id: "overture:known", name: "Known Pharmacy" })],
    }));

    const { findPharmacyById: find } = await import("../pharmacies");
    expect(find("overture:known")?.name).toBe("Known Pharmacy");
  });

  it("returns undefined for an unknown id, never a client-supplied destination", async () => {
    vi.doMock("@/data/pharmacies.json", () => ({
      default: [makeLocation({ id: "overture:known" })],
    }));

    const { findPharmacyById: find } = await import("../pharmacies");
    expect(find("not-a-real-id")).toBeUndefined();
  });
});
