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

/** Above this, "nearest" is far enough that it's worth explaining why. */
const LONG_DISTANCE_NOTE_METERS = 30_000;

export function PharmacyFinder() {
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  // Bumped only when the origin changes via GPS or the map - not via
  // AddressSearch's own pick - to force it to remount and clear its stale
  // query text instead of showing an address that no longer matches.
  const [addressSearchResetKey, setAddressSearchResetKey] = useState(0);
  const { state: searchState, search } = usePharmacySearch();
  const { error: geoError, requestLocation } = useGeolocation();
  const {
    state: directionsState,
    mode: directionsMode,
    setMode: setDirectionsMode,
    fetchDirections,
    clear: clearDirections,
  } = useDirections();

  const pharmacies: Pharmacy[] =
    searchState.status === "success" ? searchState.result.pharmacies : [];

  const activePharmacyId =
    directionsState.status === "loading" || directionsState.status === "loaded"
      ? directionsState.pharmacyId
      : null;

  function handleOriginChange(nextOrigin: { lat: number; lon: number }) {
    setOrigin(nextOrigin);
    clearDirections();
    search(nextOrigin);
  }

  function handleExternalOriginChange(nextOrigin: { lat: number; lon: number }) {
    setAddressSearchResetKey((key) => key + 1);
    handleOriginChange(nextOrigin);
  }

  function handleUseMyLocation() {
    requestLocation(handleExternalOriginChange);
  }

  function handleDirections(pharmacy: Pharmacy) {
    if (!origin) return;
    fetchDirections(origin, pharmacy.id);
  }

  const isSearching = searchState.status === "loading";
  const activePharmacy =
    activePharmacyId !== null ? pharmacies.find((pharmacy) => pharmacy.id === activePharmacyId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <AddressSearch key={addressSearchResetKey} onPick={handleOriginChange} />
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
        activePharmacyId={activePharmacyId}
        routeCoordinates={
          directionsState.status === "loaded"
            ? directionsState.directions[directionsMode]?.coordinates
            : undefined
        }
        onOriginPick={handleExternalOriginChange}
        onSelectPharmacy={(pharmacyId) => {
          const pharmacy = pharmacies.find((candidate) => candidate.id === pharmacyId);
          if (pharmacy) handleDirections(pharmacy);
        }}
      />

      {directionsState.status === "loaded" && activePharmacy && (
        <DirectionsPanel
          pharmacyName={activePharmacy.name}
          directions={directionsState.directions}
          mode={directionsMode}
          onModeChange={setDirectionsMode}
          onClose={clearDirections}
        />
      )}

      {directionsState.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t calculate directions right now. Please try again shortly.
        </p>
      )}

      {origin && searchState.status === "success" && (
        <>
          {searchState.result.searchRadiusMeters > LONG_DISTANCE_NOTE_METERS && pharmacies.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You&apos;re far from most pharmacies, so these are the nearest ones available, however far
              away.
            </p>
          )}
          <PharmacyList
            pharmacies={pharmacies}
            onDirections={handleDirections}
            loadingDirectionsId={directionsState.status === "loading" ? directionsState.pharmacyId : null}
            activePharmacyId={activePharmacyId}
          />
        </>
      )}
    </div>
  );
}
