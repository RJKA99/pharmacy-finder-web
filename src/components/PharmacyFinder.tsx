"use client";

import { usePharmacyFinder, type FinderErrorReason } from "@/hooks/usePharmacyFinder";
import { PharmacyList } from "./PharmacyList";
import { PharmacyMap } from "./PharmacyMap";

const ERROR_MESSAGES: Record<FinderErrorReason, string> = {
  unsupported: "Your browser doesn't support location lookup.",
  "permission-denied": "Location permission was denied. Allow location access and try again.",
  "position-unavailable": "We couldn't determine your location. Please try again.",
  network: "Couldn't reach the pharmacy lookup service. Please try again shortly.",
};

export function PharmacyFinder() {
  const { state, search } = usePharmacyFinder();
  const isBusy = state.status === "locating" || state.status === "loading";

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={search}
        disabled={isBusy}
        className="self-start rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {isBusy ? "Searching…" : "Find nearest pharmacy"}
      </button>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {ERROR_MESSAGES[state.reason]}
        </p>
      )}

      {state.status === "success" && (
        <div className="flex flex-col gap-4">
          <PharmacyMap origin={state.origin} pharmacies={state.result.pharmacies} />
          <PharmacyList pharmacies={state.result.pharmacies} />
        </div>
      )}
    </div>
  );
}
