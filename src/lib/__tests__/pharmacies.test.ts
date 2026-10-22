import { describe, expect, it } from "vitest";
import { dedupePharmacies, normalizePharmacyElements } from "../pharmacies";
import type { OverpassElement } from "../types";

const HELSINKI = { lat: 60.1699, lon: 24.9384 };

describe("normalizePharmacyElements", () => {
  it("maps node elements with full tags into a Pharmacy", () => {
    const elements: OverpassElement[] = [
      {
        type: "node",
        id: 1,
        lat: 60.171,
        lon: 24.94,
        tags: {
          amenity: "pharmacy",
          name: "Rautatientorin apteekki",
          "addr:street": "Kaivokatu",
          "addr:housenumber": "1",
          "addr:postcode": "00100",
          "addr:city": "Helsinki",
        },
      },
    ];

    const [pharmacy] = normalizePharmacyElements(elements, HELSINKI);

    expect(pharmacy.name).toBe("Rautatientorin apteekki");
    expect(pharmacy.address).toBe("Kaivokatu 1, 00100 Helsinki");
    expect(pharmacy.source).toBe("osm");
    expect(pharmacy.distanceMeters).toBeGreaterThan(0);
  });

  it("falls back to a generic name when the name tag is missing", () => {
    const elements: OverpassElement[] = [
      { type: "node", id: 2, lat: 60.17, lon: 24.94, tags: { amenity: "pharmacy" } },
    ];

    const [pharmacy] = normalizePharmacyElements(elements, HELSINKI);
    expect(pharmacy.name).toBe("Apteekki");
    expect(pharmacy.address).toBeNull();
  });

  it("reads way centroid coordinates when lat/lon are absent", () => {
    const elements: OverpassElement[] = [
      {
        type: "way",
        id: 3,
        center: { lat: 60.172, lon: 24.941 },
        tags: { name: "Way-apteekki" },
      },
    ];

    const [pharmacy] = normalizePharmacyElements(elements, HELSINKI);
    expect(pharmacy.lat).toBe(60.172);
    expect(pharmacy.lon).toBe(24.941);
  });

  it("drops elements with no usable coordinates", () => {
    const elements: OverpassElement[] = [{ type: "node", id: 4, tags: { name: "No coords" } }];
    expect(normalizePharmacyElements(elements, HELSINKI)).toHaveLength(0);
  });
});

describe("dedupePharmacies", () => {
  it("merges two OSM nodes within 25m into one, keeping the more complete entry", () => {
    const sparse: OverpassElement[] = [
      { type: "node", id: 10, lat: 60.1700, lon: 24.9384, tags: {} },
    ];
    const complete: OverpassElement[] = [
      {
        type: "node",
        id: 11,
        lat: 60.17002,
        lon: 24.93842,
        tags: { name: "Yliopiston apteekki", "addr:street": "Mannerheimintie" },
      },
    ];

    const normalized = [
      ...normalizePharmacyElements(sparse, HELSINKI),
      ...normalizePharmacyElements(complete, HELSINKI),
    ];

    const deduped = dedupePharmacies(normalized);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].name).toBe("Yliopiston apteekki");
  });

  it("keeps separate entries when pharmacies are farther than 25m apart", () => {
    const elements: OverpassElement[] = [
      { type: "node", id: 20, lat: 60.1699, lon: 24.9384, tags: { name: "A" } },
      { type: "node", id: 21, lat: 60.18, lon: 24.95, tags: { name: "B" } },
    ];

    const normalized = normalizePharmacyElements(elements, HELSINKI);
    expect(dedupePharmacies(normalized)).toHaveLength(2);
  });
});
