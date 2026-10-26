import { formatDistance } from "@/lib/format";
import type { Pharmacy } from "@/lib/types";

function OpenStatusBadge({ isOpenNow }: { isOpenNow: boolean | null }) {
  if (isOpenNow === null) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        Hours unknown
      </span>
    );
  }

  return isOpenNow ? (
    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-400">
      Open now
    </span>
  ) : (
    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-400">
      Closed now
    </span>
  );
}

export function PharmacyList({
  pharmacies,
  onDirections,
  loadingDirectionsId,
  activePharmacyId,
}: {
  pharmacies: Pharmacy[];
  onDirections: (pharmacy: Pharmacy) => void;
  loadingDirectionsId: string | null;
  activePharmacyId?: string | null;
}) {
  if (pharmacies.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400" role="status">
        No pharmacies found nearby. Try again from a different location.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
      {pharmacies.map((pharmacy) => (
        <li
          key={pharmacy.id}
          className={`flex items-center justify-between gap-4 p-4 ${
            activePharmacyId === pharmacy.id ? "bg-emerald-50 dark:bg-emerald-950" : ""
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{pharmacy.name}</p>
              <OpenStatusBadge isOpenNow={pharmacy.isOpenNow} />
            </div>
            {pharmacy.address && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{pharmacy.address}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {formatDistance(pharmacy.distanceMeters)}
            </span>
            <button
              type="button"
              onClick={() => onDirections(pharmacy)}
              disabled={loadingDirectionsId === pharmacy.id}
              className="rounded-md border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
            >
              {loadingDirectionsId === pharmacy.id ? "Loading…" : "Directions"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
