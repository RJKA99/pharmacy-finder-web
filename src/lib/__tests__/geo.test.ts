import { describe, expect, it } from "vitest";
import { haversineDistanceMeters } from "../geo";

describe("haversineDistanceMeters", () => {
  it("returns 0 for identical points", () => {
    const point = { lat: 60.1699, lon: 24.9384 };
    expect(haversineDistanceMeters(point, point)).toBe(0);
  });

  it("returns a plausible distance between two known Helsinki landmarks", () => {
    const helsinkiCathedral = { lat: 60.1699, lon: 24.9522 };
    const senateSquare = { lat: 60.1685, lon: 24.9516 };

    const distance = haversineDistanceMeters(helsinkiCathedral, senateSquare);

    expect(distance).toBeGreaterThan(50);
    expect(distance).toBeLessThan(300);
  });
});
