"use client";

import { useState } from "react";
import { useDirections } from "@/hooks/useDirections";
import { useGeolocation, type GeolocationErrorReason } from "@/hooks/useGeolocation";
import { usePharmacySearch } from "@/hooks/usePharmacySearch";
import type { Pharmacy } from "@/lib/types";
import { AddressSearch } from "./AddressSearch";
import { DirectionsPanel } from "./DirectionsPanel";
import { PharmacyList } from "./PharmacyList";
import { PharmacyMap } from "./PharmacyMap";

const GEOLOCATION_ERROR_MESSAGES: Record<GeolocationErrorReason, string> = {
  unsupported: "Your browser doesn't support location lookup. Search for an address or click the map instead.",
  "permission-denied": "Location permission was denied. Search for an address or click the map instead.",
  "position-unavailable": "We couldn't determine your location. Search for an address or click the map instead.",
};

export function PharmacyFinder() {
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const { state: searchState, search } = usePharmacySearch();
  const { error: geoError, requestLocation } = useGeolocation();
  const { state: directionsState, fetchDirections, clear: clearDirections } = useDirections();

  const pharmacies: Pharmacy[] =
    searchState.status === "success" ? searchState.result.pharmacies : [];

  function handleOriginChange(nextOrigin: { lat: number; lon: number }) {
    setOrigin(nextOrigin);
    clearDirections();
    search(nextOrigin);
  }

  function handleUseMyLocation() {
    requestLocation(handleOriginChange);
  }

  function handleDirections(pharmacy: Pharmacy) {
    if (!origin) return;
    fetchDirections(origin, pharmacy.id);
  }

  const isSearching = searchState.status === "loading";
  const activePharmacy =
    directionsState.status === "loaded" || directionsState.status === "loading"
      ? pharmacies.find((pharmacy) => pharmacy.id === directionsState.pharmacyId)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <AddressSearch onPick={handleOriginChange} />
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isSearching}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {isSearching ? "Searching…" : "Use my location"}
        </button>
      </div>

      {geoError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {GEOLOCATION_ERROR_MESSAGES[geoError]}
        </p>
      )}

      {searchState.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t reach the pharmacy lookup service. Please try again shortly.
        </p>
      )}

      <PharmacyMap
        origin={origin}
        pharmacies={pharmacies}
        routeCoordinates={directionsState.status === "loaded" ? directionsState.route.coordinates : undefined}
        onOriginPick={handleOriginChange}
      />

      {directionsState.status === "loaded" && activePharmacy && (
        <DirectionsPanel
          pharmacyName={activePharmacy.name}
          route={directionsState.route}
          onClose={clearDirections}
        />
      )}

      {directionsState.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t calculate directions right now. Please try again shortly.
        </p>
      )}

      {origin && searchState.status === "success" && (
        <PharmacyList
          pharmacies={pharmacies}
          onDirections={handleDirections}
          loadingDirectionsId={directionsState.status === "loading" ? directionsState.pharmacyId : null}
        />
      )}
    </div>
  );
}
