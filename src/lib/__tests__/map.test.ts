import { describe, expect, it } from "vitest";
import { buildOsmEmbedUrl } from "../map";
import type { Pharmacy } from "../types";

const ORIGIN = { lat: 60.1699, lon: 24.9384 };

function makePharmacy(overrides: Partial<Pharmacy>): Pharmacy {
  return {
    id: "osm:node/1",
    name: "Testiapteekki",
    lat: 60.171,
    lon: 24.94,
    distanceMeters: 200,
    address: null,
    source: "overture",
    ...overrides,
  };
}

describe("buildOsmEmbedUrl", () => {
  it("places a marker at the user's origin", () => {
    const url = buildOsmEmbedUrl(ORIGIN, [makePharmacy({})]);
    expect(url).toContain("marker=60.1699%2C24.9384");
  });

  it("produces a bbox that encloses the origin and every pharmacy", () => {
    const pharmacy = makePharmacy({ lat: 60.18, lon: 24.96 });
    const url = buildOsmEmbedUrl(ORIGIN, [pharmacy]);
    const bboxParam = new URL(url).searchParams.get("bbox");
    const [minLon, minLat, maxLon, maxLat] = bboxParam!.split(",").map(Number);

    expect(minLat).toBeLessThanOrEqual(ORIGIN.lat);
    expect(maxLat).toBeGreaterThanOrEqual(pharmacy.lat);
    expect(minLon).toBeLessThanOrEqual(ORIGIN.lon);
    expect(maxLon).toBeGreaterThanOrEqual(pharmacy.lon);
  });

  it("still returns a sensible bbox when there are no pharmacies", () => {
    const url = buildOsmEmbedUrl(ORIGIN, []);
    expect(url).toContain("openstreetmap.org/export/embed.html");
  });
});
