# Pharmacy Finder (web)

Finds the nearest pharmacies to the user's current location.

**Live demo:** _(added after deploy)_

## How it works

1. The browser asks for the user's location via the [Geolocation
   API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).
2. The frontend calls this app's own `GET /api/pharmacies?lat=..&lon=..`
   route.
3. That route queries [OpenStreetMap's Overpass
   API](https://wiki.openstreetmap.org/wiki/Overpass_API) for
   `amenity=pharmacy` within 1.5km, widening to 5km if fewer than 3 results
   come back, normalizes/deduplicates the raw OSM data, and returns a
   distance-sorted list.
4. The same `/api/pharmacies` endpoint is also what the companion
   [iOS app](https://github.com/RJKA99/pharmacy-finder-ios) calls — see
   [`docs/adr/0001-pharmacy-data-source.md`](docs/adr/0001-pharmacy-data-source.md)
   for why OSM was chosen and how its data-quality quirks are handled.

## Tech stack

| Layer      | Choice                                   |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 16 (App Router), TypeScript       |
| Styling    | Tailwind CSS v4                           |
| Data       | OpenStreetMap / Overpass API              |
| Map        | openstreetmap.org embed (no JS map lib)   |
| Tests      | Vitest + React Testing Library            |
| CI         | GitHub Actions                            |
| Hosting    | Vercel                                    |

## Project layout

```
src/
  app/
    api/pharmacies/route.ts   # GET endpoint: lat/lon -> nearest pharmacies
    page.tsx                 # single-page UI
  components/
    PharmacyFinder.tsx        # orchestrates geolocation -> fetch -> render
    PharmacyList.tsx
    PharmacyMap.tsx
  hooks/
    usePharmacyFinder.ts       # geolocation + fetch state machine
  lib/
    overpass.ts                # Overpass HTTP client, mirror fallback
    pharmacies.ts               # normalization, dedup, radius search
    geo.ts                      # haversine distance
    map.ts                      # OSM embed URL builder
    cache.ts                    # short-TTL in-memory response cache
docs/adr/0001-pharmacy-data-source.md
```

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
```

## Testing

```bash
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

Tests cover the behavior that matters: OSM tag normalization (missing
names/addresses), duplicate-node deduplication, the API route's success/
empty/error responses and caching, and the four UI states (idle, permission
denied, network error, success).

## Known limitations

- Overpass's public instances have no uptime guarantee; this app tries two
  mirrors before giving up and returning a clear error (see the ADR).
- The in-memory cache is best-effort — serverless function instances are
  ephemeral, so it mainly helps within a single warm instance.
- The embedded map shows one marker (the user's location) because the
  openstreetmap.org embed widget only supports a single marker parameter;
  the pharmacy list is the primary source of truth for individual results.
- No automated end-to-end/browser test — covered by component-level
  behavior tests instead.
