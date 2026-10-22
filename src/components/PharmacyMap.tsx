import { buildOsmEmbedUrl } from "@/lib/map";
import type { Pharmacy } from "@/lib/types";

export function PharmacyMap({
  origin,
  pharmacies,
}: {
  origin: { lat: number; lon: number };
  pharmacies: Pharmacy[];
}) {
  return (
    <iframe
      title="Map of nearby pharmacies"
      src={buildOsmEmbedUrl(origin, pharmacies)}
      className="h-64 w-full rounded-lg border border-gray-200 dark:border-gray-700"
    />
  );
}
