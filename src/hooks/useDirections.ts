"use client";

import { useCallback, useState } from "react";
import type { RouteResult } from "@/lib/types";

export type DirectionsState =
  | { status: "idle" }
  | { status: "loading"; pharmacyId: string }
  | { status: "loaded"; pharmacyId: string; route: RouteResult }
  | { status: "error"; pharmacyId: string };

export function useDirections() {
  const [state, setState] = useState<DirectionsState>({ status: "idle" });

  const fetchDirections = useCallback(
    (origin: { lat: number; lon: number }, pharmacyId: string) => {
      setState({ status: "loading", pharmacyId });

      fetch(
        `/api/directions?lat=${origin.lat}&lon=${origin.lon}&pharmacyId=${encodeURIComponent(pharmacyId)}`,
      )
        .then(async (response) => {
          if (!response.ok) {
            setState({ status: "error", pharmacyId });
            return;
          }
          const route = (await response.json()) as RouteResult;
          setState({ status: "loaded", pharmacyId, route });
        })
        .catch(() => {
          setState({ status: "error", pharmacyId });
        });
    },
    [],
  );

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { state, fetchDirections, clear };
}
