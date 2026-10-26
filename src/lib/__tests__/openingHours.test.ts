import { describe, expect, it } from "vitest";
import { isOpenAt, nextChangeAfter } from "../openingHours";

const HELSINKI = { lat: 60.1699, lon: 24.9384 };
const HOURS = "Mo-Fr 08:00-19:00; Sa 09:00-17:00; Su off";

describe("isOpenAt", () => {
  it("returns null when there are no hours to check", () => {
    expect(isOpenAt(null, HELSINKI, new Date())).toBeNull();
  });

  it("returns true during opening hours on a weekday", () => {
    // Wednesday 2026-10-28 13:00 Helsinki time (UTC+2 after DST ends)
    const wednesdayAfternoon = new Date("2026-10-28T11:00:00.000Z");
    expect(isOpenAt(HOURS, HELSINKI, wednesdayAfternoon)).toBe(true);
  });

  it("returns false outside opening hours on a weekday", () => {
    // Wednesday 2026-10-28 21:00 Helsinki time - well after 19:00 closing
    const wednesdayNight = new Date("2026-10-28T19:00:00.000Z");
    expect(isOpenAt(HOURS, HELSINKI, wednesdayNight)).toBe(false);
  });

  it("returns false on a day marked off", () => {
    // Sunday 2026-11-01 13:00 Helsinki time
    const sunday = new Date("2026-11-01T11:00:00.000Z");
    expect(isOpenAt(HOURS, HELSINKI, sunday)).toBe(false);
  });

  it("resolves Finnish public holiday (PH) selectors without throwing", () => {
    expect(isOpenAt("Mo-Fr 08:00-18:00; PH off", HELSINKI, new Date())).not.toBeNull();
  });

  it("returns null instead of throwing for an unparseable string", () => {
    expect(isOpenAt("not a real opening_hours value !!!", HELSINKI, new Date())).toBeNull();
  });
});

describe("nextChangeAfter", () => {
  it("returns the closing time for a currently-open pharmacy", () => {
    const wednesdayAfternoon = new Date("2026-10-28T11:00:00.000Z");
    const next = nextChangeAfter(HOURS, HELSINKI, wednesdayAfternoon);
    expect(next?.toISOString()).toBe("2026-10-28T17:00:00.000Z"); // 19:00 Helsinki (UTC+2)
  });

  it("returns null when there are no hours to check", () => {
    expect(nextChangeAfter(null, HELSINKI, new Date())).toBeNull();
  });
});
