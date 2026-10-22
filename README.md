# Pharmacy Finder (web)

Finds the nearest pharmacies to the user's current location.

**Live demo:** https://pharmacy-finder-web.vercel.app

## How it works

1. The browser asks for the user's location via the [Geolocation
   API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).
2. The frontend calls this app's own `GET /api/pharmacies?lat=..&lon=..`
   route.
3. That route does an in-memory nearest-neighbor search over a bundled
   dataset of ~900 Finnish pharmacies (`src/data/pharmacies.json`),
   widening the search radius (1.5km → 5km → 20km) until at least 3 results
   are found, and returns a distance-sorted list.
4. The dataset is extracted from [Overture Maps](https://overturemaps.org/)
   by `scripts/fetch_pharmacies.py`, which itself aggregates OpenStreetMap
   and other open sources. See
   [`docs/adr/0001-pharmacy-data-source.md`](docs/adr/0001-pharmacy-data-source.md)
   for why this is a build-time extraction rather than a live API call —
   short version: it was a live Overpass API call, and public Overpass
   mirrors rejected this app's production traffic with real 406/429
   responses, so the data source moved to a batch pipeline instead.
5. The same `/api/pharmacies` endpoint is also what the companion
   [iOS app](https://github.com/RJKA99/pharmacy-finder-ios) calls.

## Tech stack

| Layer      | Choice                                   |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 16 (App Router), TypeScript       |
| Styling    | Tailwind CSS v4                           |
| Data       | Overture Maps (DuckDB extraction), Finland |
| Map        | openstreetmap.org embed (no JS map lib)   |
| Tests      | Vitest + React Testing Library            |
| CI         | GitHub Actions                            |
| Hosting    | Vercel                                    |

## Project layout

```
scripts/fetch_pharmacies.py   # one-time/occasional Overture -> JSON extraction
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
    pharmacies.ts               # dedup clustering, radius search
    geo.ts                      # haversine distance
    map.ts                      # OSM embed URL builder
  data/
    pharmacies.json             # bundled dataset (output of the fetch script)
docs/adr/0001-pharmacy-data-source.md
```

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
```

## Refreshing the pharmacy dataset

```bash
pip install -r scripts/requirements.txt
python3 scripts/fetch_pharmacies.py        # writes src/data/pharmacies.json
```

## Testing

```bash
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint
npm run build
```

Tests cover the behavior that matters: duplicate-record deduplication,
progressive radius widening, the API route's success/empty/error responses,
and the four UI states (idle, permission denied, network error, success).

## Known limitations

- Coverage is Finland only, and frozen at whenever
  `scripts/fetch_pharmacies.py` was last run — not live. Re-run it to
  refresh.
- The embedded map shows one marker (the user's location) because the
  openstreetmap.org embed widget only supports a single marker parameter;
  the pharmacy list is the primary source of truth for individual results.
- No automated end-to-end/browser test — covered by component-level
  behavior tests instead.
