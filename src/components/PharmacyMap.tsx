"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { escapeHtml } from "@/lib/format";
import type { Pharmacy } from "@/lib/types";

interface PharmacyMapProps {
  /** The chosen starting point, or null before the user has picked one. */
  origin: { lat: number; lon: number } | null;
  pharmacies: Pharmacy[];
  activePharmacyId?: string | null;
  routeCoordinates?: [number, number][];
  onOriginPick: (origin: { lat: number; lon: number }) => void;
  onSelectPharmacy: (pharmacyId: string) => void;
}

/** Shown before the user has picked a starting point - roughly centers Finland. */
const DEFAULT_CENTER: [number, number] = [64.5, 26.0];
const DEFAULT_ZOOM = 5;
const ORIGIN_ZOOM = 14;

const ORIGIN_MARKER_STYLE = {
  radius: 10,
  color: "#047857",
  weight: 2,
  fillColor: "#10b981",
  fillOpacity: 1,
};

const ACTIVE_PHARMACY_MARKER_STYLE = {
  radius: 10,
  color: "#9a3412",
  weight: 2,
  fillColor: "#f97316",
  fillOpacity: 1,
};

const DIRECTIONS_BUTTON_CLASS = "pharmacy-popup-directions";

function buildPopupHtml(pharmacy: Pharmacy): string {
  return `
    <div class="text-sm">
      <p class="font-medium text-gray-900">${escapeHtml(pharmacy.name)}</p>
      <button type="button" class="${DIRECTIONS_BUTTON_CLASS} mt-2 rounded-md border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50" data-pharmacy-id="${escapeHtml(pharmacy.id)}">
        Directions
      </button>
    </div>
  `;
}

export function PharmacyMap({
  origin,
  pharmacies,
  activePharmacyId = null,
  routeCoordinates,
  onOriginPick,
  onSelectPharmacy,
}: PharmacyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const originMarkerRef = useRef<Leaflet.CircleMarker | null>(null);
  const pharmacyLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const routeLayerRef = useRef<Leaflet.Polyline | null>(null);
  const onOriginPickRef = useRef(onOriginPick);
  const onSelectPharmacyRef = useRef(onSelectPharmacy);
  useEffect(() => {
    onOriginPickRef.current = onOriginPick;
  }, [onOriginPick]);
  useEffect(() => {
    onSelectPharmacyRef.current = onSelectPharmacy;
  }, [onSelectPharmacy]);

  // Initialize the map once. Leaflet touches `window` at import time, so it
  // must only ever be loaded inside an effect (client-only), never at module
  // scope - that would break server rendering.
  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      L.Icon.Default.mergeOptions({
        iconUrl: "/leaflet/marker-icon.png",
        iconRetinaUrl: "/leaflet/marker-icon-2x.png",
        shadowUrl: "/leaflet/marker-shadow.png",
      });

      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      pharmacyLayerRef.current = L.layerGroup().addTo(map);

      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        onOriginPickRef.current({ lat: event.latlng.lat, lon: event.latlng.lng });
      });

      // Delegated listener: popup content is raw HTML (not React), so its
      // "Directions" button is wired up this way instead of a JSX handler.
      map.getContainer().addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest(`.${DIRECTIONS_BUTTON_CLASS}`);
        const pharmacyId = button instanceof HTMLElement ? button.dataset.pharmacyId : undefined;
        if (pharmacyId) onSelectPharmacyRef.current(pharmacyId);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Place/move the origin marker and zoom in once a starting point is set.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !origin) return;

    import("leaflet").then((L) => {
      if (originMarkerRef.current) {
        originMarkerRef.current.setLatLng([origin.lat, origin.lon]);
      } else {
        originMarkerRef.current = L.circleMarker([origin.lat, origin.lon], ORIGIN_MARKER_STYLE)
          .bindTooltip("Starting point")
          .addTo(map);
      }
      map.setView([origin.lat, origin.lon], Math.max(map.getZoom(), ORIGIN_ZOOM));
    });
  }, [origin]);

  // Redraw pharmacy markers when the result list or the active pharmacy
  // (highlighted in a different color) changes.
  useEffect(() => {
    const layer = pharmacyLayerRef.current;
    if (!layer) return;
    import("leaflet").then((L) => {
      layer.clearLayers();
      for (const pharmacy of pharmacies) {
        const marker =
          pharmacy.id === activePharmacyId
            ? L.circleMarker([pharmacy.lat, pharmacy.lon], ACTIVE_PHARMACY_MARKER_STYLE)
            : L.marker([pharmacy.lat, pharmacy.lon]);
        marker.bindPopup(buildPopupHtml(pharmacy)).addTo(layer);
      }
    });
  }, [pharmacies, activePharmacyId]);

  // Draw (or clear) the walking-directions polyline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      if (routeCoordinates && routeCoordinates.length > 0) {
        const polyline = L.polyline(routeCoordinates, { color: "#059669", weight: 4 }).addTo(map);
        routeLayerRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [32, 32] });
      }
    });
  }, [routeCoordinates]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map showing nearby pharmacies - click anywhere to set your starting point"
      className="h-80 w-full rounded-lg border border-gray-200 dark:border-gray-700"
    />
  );
}
