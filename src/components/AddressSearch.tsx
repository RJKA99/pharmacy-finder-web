"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/types";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

export function AddressSearch({
  onPick,
}: {
  onPick: (location: { lat: number; lon: number }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setStatus("loading");
      fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("search failed");
          const body = (await response.json()) as { results: GeocodeResult[] };
          setResults(body.results);
          setStatus("idle");
        })
        .catch(() => {
          setResults([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div className="relative">
      <label htmlFor="address-search" className="sr-only">
        Search for a starting address
      </label>
      <input
        id="address-search"
        type="text"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Search for a starting address…"
        autoComplete="off"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      {status === "error" && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          Address search failed. Please try again.
        </p>
      )}

      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {results.map((result) => (
            <li key={`${result.lat},${result.lon}`}>
              <button
                type="button"
                onClick={() => {
                  onPick({ lat: result.lat, lon: result.lon });
                  setQuery(result.label);
                  setResults([]);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
