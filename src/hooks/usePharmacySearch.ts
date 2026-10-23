"use client";

import { useCallback, useState } from "react";
import type { PharmacySearchResult } from "@/lib/types";

export type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: PharmacySearchResult }
  | { status: "error" };

export function usePharmacySearch() {
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const search = useCallback((origin: { lat: number; lon: number }) => {
    setState({ status: "loading" });

    fetch(`/api/pharmacies?lat=${origin.lat}&lon=${origin.lon}`)
      .then(async (response) => {
        if (!response.ok) {
          setState({ status: "error" });
          return;
        }
        const result = (await response.json()) as PharmacySearchResult;
        setState({ status: "success", result });
      })
      .catch(() => {
        setState({ status: "error" });
      });
  }, []);

  return { state, search };
}
