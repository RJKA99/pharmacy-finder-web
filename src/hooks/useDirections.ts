"use client";

import { useCallback, useState } from "react";
import type { DirectionsResult, TravelMode } from "@/lib/types";

export type DirectionsState =
  | { status: "idle" }
  | { status: "loading"; pharmacyId: string }
  | { status: "loaded"; pharmacyId: string; directions: DirectionsResult }
  | { status: "error"; pharmacyId: string };

export function useDirections() {
  const [state, setState] = useState<DirectionsState>({ status: "idle" });
  const [mode, setMode] = useState<TravelMode>("foot");

  const fetchDirections = useCallback(
    (origin: { lat: number; lon: number }, pharmacyId: string) => {
      setState({ status: "loading", pharmacyId });
      setMode("foot");

      fetch(
        `/api/directions?lat=${origin.lat}&lon=${origin.lon}&pharmacyId=${encodeURIComponent(pharmacyId)}`,
      )
        .then(async (response) => {
          if (!response.ok) {
            setState({ status: "error", pharmacyId });
            return;
          }
          const directions = (await response.json()) as DirectionsResult;
          setState({ status: "loaded", pharmacyId, directions });
        })
        .catch(() => {
          setState({ status: "error", pharmacyId });
        });
    },
    [],
  );

  const clear = useCallback(() => {
    setState({ status: "idle" });
    setMode("foot");
  }, []);

  return { state, mode, setMode, fetchDirections, clear };
}
