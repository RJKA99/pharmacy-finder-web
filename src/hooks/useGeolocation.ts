"use client";

import { useCallback, useState } from "react";

export type GeolocationErrorReason = "unsupported" | "permission-denied" | "position-unavailable";

export function useGeolocation() {
  const [error, setError] = useState<GeolocationErrorReason | null>(null);

  const requestLocation = useCallback((onSuccess: (origin: { lat: number; lon: number }) => void) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("unsupported");
      return;
    }

    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onSuccess({ lat: position.coords.latitude, lon: position.coords.longitude });
      },
      (positionError) => {
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "permission-denied"
            : "position-unavailable",
        );
      },
    );
  }, []);

  return { error, requestLocation };
}
