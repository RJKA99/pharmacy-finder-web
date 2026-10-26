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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  function closeResults() {
    setResults([]);
    setHighlightedIndex(-1);
  }

  function handleChange(value: string) {
    setQuery(value);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      closeResults();
      setStatus("idle");
    }
  }

  function pick(result: GeocodeResult) {
    onPick({ lat: result.lat, lon: result.lon });
    setQuery(result.label);
    closeResults();
  }

  function handleClear() {
    setQuery("");
    closeResults();
    setStatus("idle");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeResults();
      return;
    }
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      pick(results[highlightedIndex]);
    }
  }

  // Close the dropdown on an outside click - otherwise stale results stay
  // open after the user interacts with something else, like the map.
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeResults();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      return;
    }

    clearTimeout(debounceRef.current);
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(() => {
      setStatus("loading");
      fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("search failed");
          const body = (await response.json()) as { results: GeocodeResult[] };
          // Guards against a slow earlier response resolving after a newer
          // one and overwriting it - belt-and-suspenders alongside the
          // AbortController below, since not every environment a fetch call
          // passes through is guaranteed to honor the abort signal.
          if (requestIdRef.current !== requestId) return;
          setResults(body.results);
          setHighlightedIndex(-1);
          setStatus("idle");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (requestIdRef.current !== requestId) return;
          setResults([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    // Cancels both the debounce timer and an in-flight request from a
    // previous keystroke, so a slow earlier response can never overwrite
    // the results for what the user is searching for now.
    return () => {
      clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="address-search" className="sr-only">
        Search for a starting address
      </label>
      <input
        id="address-search"
        type="text"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search for a starting address…"
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="address-search-results"
        aria-activedescendant={highlightedIndex >= 0 ? `address-search-option-${highlightedIndex}` : undefined}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      {query.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          ✕
        </button>
      )}

      {status === "loading" && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Searching…</p>
      )}

      {status === "error" && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          Address search failed. Please try again.
        </p>
      )}

      {results.length > 0 && (
        <ul
          id="address-search-results"
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {results.map((result, index) => (
            <li key={`${result.lat},${result.lon}`} role="presentation">
              <button
                type="button"
                id={`address-search-option-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => pick(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full px-3 py-2 text-left text-sm ${
                  index === highlightedIndex
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
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
