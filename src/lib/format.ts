/** Formats a distance in meters the way a user expects to read it: "350 m" or "1.2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
