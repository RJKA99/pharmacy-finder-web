import { formatDistance } from "@/lib/format";
import type { Pharmacy } from "@/lib/types";

export function PharmacyList({ pharmacies }: { pharmacies: Pharmacy[] }) {
  if (pharmacies.length === 0) {
    return (
      <p className="text-sm text-gray-600" role="status">
        No pharmacies found nearby. Try again from a different location.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
      {pharmacies.map((pharmacy) => (
        <li key={pharmacy.id} className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-medium text-gray-900">{pharmacy.name}</p>
            {pharmacy.address && (
              <p className="text-sm text-gray-500">{pharmacy.address}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold text-emerald-700">
            {formatDistance(pharmacy.distanceMeters)}
          </span>
        </li>
      ))}
    </ul>
  );
}
