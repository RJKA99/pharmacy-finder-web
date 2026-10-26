// Server-only. The `opening_hours` library has no explicit timezone option -
// it reads the Node process's local timezone to interpret OSM opening_hours
// strings (which are always local wall-clock time) and to report "next
// change" times. Every pharmacy in this app's dataset is in Finland, and
// Vercel's functions run in UTC by default, so without this the computed
// open/closed state would be off by Finland's UTC offset (2-3 hours).
process.env.TZ = "Europe/Helsinki";

// The package's .d.ts declares `opening_hours` as a named export, but both
// its actual CJS and ESM builds only export the class as the module's
// default - a named import type-checks but throws "not a constructor" at
// runtime under Vite/Vitest's ESM resolution. Default import is correct.
import OpeningHoursParser from "opening_hours";

function parse(
  openingHours: string,
  location: { lat: number; lon: number },
): InstanceType<typeof OpeningHoursParser> | null {
  try {
    // "PH" (public holiday) selectors - common in Finnish pharmacy hours -
    // can't be resolved without a country, and the library throws rather
    // than returning "unknown" in that case. lat/lon also feed sun-relative
    // rules (e.g. "sunset-sunrise"), rare but valid OSM syntax.
    return new OpeningHoursParser(openingHours, {
      lat: location.lat,
      lon: location.lon,
      address: { country_code: "fi", state: "" },
    });
  } catch {
    return null;
  }
}

/** Whether a pharmacy is open at a given time. Null if hours are unknown or unparseable. */
export function isOpenAt(
  openingHours: string | null,
  location: { lat: number; lon: number },
  at: Date,
): boolean | null {
  if (!openingHours) return null;
  const parsed = parse(openingHours, location);
  if (!parsed) return null;
  try {
    return parsed.getState(at);
  } catch {
    return null;
  }
}

/** The next time the open/closed state changes after `at`. Null if unknown. */
export function nextChangeAfter(
  openingHours: string | null,
  location: { lat: number; lon: number },
  at: Date,
): Date | null {
  if (!openingHours) return null;
  const parsed = parse(openingHours, location);
  if (!parsed) return null;
  try {
    return parsed.getNextChange(at) ?? null;
  } catch {
    return null;
  }
}
