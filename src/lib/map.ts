import type { Pharmacy } from "./types";

/** Fraction of the bounding box's span added as padding on each side. */
const BBOX_PADDING_RATIO = 0.25;
/** Minimum span in degrees so a single-point bbox still renders a sensible zoom level. */
const MIN_SPAN_DEGREES = 0.004;

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function computeBoundingBox(
  origin: { lat: number; lon: number },
  pharmacies: Pharmacy[],
): BoundingBox {
  const lats = [origin.lat, ...pharmacies.map((p) => p.lat)];
  const lons = [origin.lon, ...pharmacies.map((p) => p.lon)];

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latSpan = Math.max(maxLat - minLat, MIN_SPAN_DEGREES);
  const lonSpan = Math.max(maxLon - minLon, MIN_SPAN_DEGREES);
  const latPad = latSpan * BBOX_PADDING_RATIO;
  const lonPad = lonSpan * BBOX_PADDING_RATIO;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
  };
}

/**
 * Builds an openstreetmap.org embed URL covering the user's location and the
 * found pharmacies, with a marker on the user's position. No API key or JS
 * mapping library needed.
 */
export function buildOsmEmbedUrl(
  origin: { lat: number; lon: number },
  pharmacies: Pharmacy[],
): string {
  const bbox = computeBoundingBox(origin, pharmacies);
  const params = new URLSearchParams({
    bbox: `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`,
    layer: "mapnik",
    marker: `${origin.lat},${origin.lon}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}
