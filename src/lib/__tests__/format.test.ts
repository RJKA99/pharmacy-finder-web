import { describe, expect, it } from "vitest";
import { formatDistance } from "../format";

describe("formatDistance", () => {
  it("renders sub-kilometer distances in meters", () => {
    expect(formatDistance(350)).toBe("350 m");
    expect(formatDistance(0)).toBe("0 m");
  });

  it("renders distances of 1km or more in kilometers with one decimal", () => {
    expect(formatDistance(1200)).toBe("1.2 km");
    expect(formatDistance(1000)).toBe("1.0 km");
  });
});
