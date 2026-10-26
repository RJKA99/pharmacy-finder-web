// Tries OpenRouteService first, falls back to GraphHopper if it fails - see
// docs/adr/0003-routing-provider-fallback.md for why (ORS had two separate
// multi-day outages during development). Mirrors the mirror-fallback
// pattern originally used for the pharmacy data source (ADR 0001).

import * as graphhopper from "./providers/graphhopper";
import * as ors from "./providers/ors";
import type { GeocodeResult, RouteResult, TravelMode } from "./types";

async function withFallback<T>(
  label: string,
  providers: Array<() => Promise<T>>,
): Promise<T> {
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      return await provider();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`All ${label} providers failed: ${errors.join(" | ")}`);
}

export function geocode(query: string): Promise<GeocodeResult[]> {
  return withFallback("geocoding", [
    () => ors.geocode(query),
    () => graphhopper.geocode(query),
  ]);
}

export function fetchRoute(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number },
  mode: TravelMode,
): Promise<RouteResult> {
  return withFallback(`routing (${mode})`, [
    () => ors.fetchRoute(start, end, mode),
    () => graphhopper.fetchRoute(start, end, mode),
  ]);
}
