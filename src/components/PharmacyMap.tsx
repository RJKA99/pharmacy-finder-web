"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type { Pharmacy } from "@/lib/types";

interface PharmacyMapProps {
  /** The chosen starting point, or null before the user has picked one. */
  origin: { lat: number; lon: number } | null;
  pharmacies: Pharmacy[];
  routeCoordinates?: [number, number][];
  onOriginPick: (origin: { lat: number; lon: number }) => void;
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

export function PharmacyMap({ origin, pharmacies, routeCoordinates, onOriginPick }: PharmacyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const originMarkerRef = useRef<Leaflet.CircleMarker | null>(null);
  const pharmacyLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const routeLayerRef = useRef<Leaflet.Polyline | null>(null);
  const onOriginPickRef = useRef(onOriginPick);
  useEffect(() => {
    onOriginPickRef.current = onOriginPick;
  }, [onOriginPick]);

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

  // Redraw pharmacy markers when the result list changes.
  useEffect(() => {
    const layer = pharmacyLayerRef.current;
    if (!layer) return;
    import("leaflet").then((L) => {
      layer.clearLayers();
      for (const pharmacy of pharmacies) {
        L.marker([pharmacy.lat, pharmacy.lon]).bindPopup(pharmacy.name).addTo(layer);
      }
    });
  }, [pharmacies]);

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
