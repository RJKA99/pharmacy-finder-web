"use client";

import { useCallback, useState } from "react";
import type { PharmacySearchResult } from "@/lib/types";

export type FinderErrorReason =
  | "unsupported"
  | "permission-denied"
  | "position-unavailable"
  | "network";

export type FinderState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "loading" }
  | { status: "success"; result: PharmacySearchResult; origin: { lat: number; lon: number } }
  | { status: "error"; reason: FinderErrorReason };

export function usePharmacyFinder() {
  const [state, setState] = useState<FinderState>({ status: "idle" });

  const search = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", reason: "unsupported" });
      return;
    }

    setState({ status: "locating" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = { lat: position.coords.latitude, lon: position.coords.longitude };
        setState({ status: "loading" });

        fetch(`/api/pharmacies?lat=${origin.lat}&lon=${origin.lon}`)
          .then(async (response) => {
            if (!response.ok) {
              setState({ status: "error", reason: "network" });
              return;
            }
            const result = (await response.json()) as PharmacySearchResult;
            setState({ status: "success", result, origin });
          })
          .catch(() => {
            setState({ status: "error", reason: "network" });
          });
      },
      (positionError) => {
        setState({
          status: "error",
          reason:
            positionError.code === positionError.PERMISSION_DENIED
              ? "permission-denied"
              : "position-unavailable",
        });
      },
    );
  }, []);

  return { state, search };
}
