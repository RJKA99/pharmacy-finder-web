# Pharmacy Finder (web)

Finds the nearest pharmacies to a starting point in Finland, and gives
walking directions to any of them.

**Live demo:** https://pharmacy-finder-web.vercel.app

## How it works

1. Pick a starting point three ways: the browser's real [Geolocation
   API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
   ("Use my location"), an address search box, or clicking anywhere on the
   map. All three feed into the same search.
2. The frontend calls this app's own `GET /api/pharmacies?lat=..&lon=..`
   route, which does an in-memory nearest-neighbor search over a bundled
   dataset of ~900 Finnish pharmacies (`src/data/pharmacies.json`) and
   returns the 5 closest, however far away they are - there's no distance
   cutoff, since Finland's pharmacy coverage is uneven enough that "nearest"
   can genuinely mean 30+ km in rural areas, and the app should never come
   back empty just because nothing was within an arbitrary radius. The
   dataset is extracted from [Overture Maps](https://overturemaps.org/) by
   `scripts/fetch_pharmacies.py` - see
   [`docs/adr/0001-pharmacy-data-source.md`](docs/adr/0001-pharmacy-data-source.md)
   for why this is a build-time extraction rather than a live API call.
3. Address search and walking directions are proxied server-side to
   [OpenRouteService](https://openrouteservice.org/) - the browser never
   talks to ORS directly, and the directions endpoint only ever routes to a
   pharmacy from the app's own dataset, never an arbitrary caller-supplied
   destination. See
   [`docs/adr/0002-routing-and-security.md`](docs/adr/0002-routing-and-security.md)
   for the full security model (CSP, rate limiting, key handling).
4. The same `/api/pharmacies` endpoint is also what the companion
   [iOS app](https://github.com/RJKA99/pharmacy-finder-ios) calls.

## Tech stack

| Layer      | Choice                                            |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router), TypeScript                  |
| Styling    | Tailwind CSS v4                                      |
| Data       | Overture Maps (DuckDB extraction), Finland            |
| Routing    | OpenRouteService (geocoding + walking directions)      |
| Map        | Leaflet, OSM raster tiles                             |
| Tests      | Vitest + React Testing Library                        |
| CI         | GitHub Actions                                       |
| Hosting    | Vercel                                               |

## Project layout

```
scripts/fetch_pharmacies.py   # one-time/occasional Overture -> JSON extraction
middleware.ts                 # per-request CSP nonce
src/
  app/
    api/pharmacies/route.ts   # GET: lat/lon -> nearest pharmacies
    api/geocode/route.ts      # GET: address text -> coordinates (proxies ORS)
    api/directions/route.ts   # GET: origin + pharmacyId -> walking route (proxies ORS)
    page.tsx                  # single-page UI
  components/
    PharmacyFinder.tsx         # orchestrates location picking -> search -> directions
    AddressSearch.tsx          # debounced geocoding search box
    PharmacyMap.tsx             # Leaflet: origin/pharmacy markers, click-to-pick, route line
    PharmacyList.tsx
    DirectionsPanel.tsx         # distance/duration + turn-by-turn steps
  hooks/
    useGeolocation.ts
    usePharmacySearch.ts
    useDirections.ts
  lib/
    pharmacies.ts                # dedup clustering, nearest-N search
    geo.ts                       # haversine distance
    ors.ts                       # server-only OpenRouteService client
    rateLimit.ts                 # per-IP rate limiting for the ORS-backed routes
  data/
    pharmacies.json              # bundled dataset (output of the fetch script)
docs/adr/
  0001-pharmacy-data-source.md
  0002-routing-and-security.md
```

## Running locally

```bash
npm install
cp .env.example .env.local   # add a free ORS key: https://account.heigit.org
npm run dev                  # http://localhost:3000
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
that the nearest-N search never comes back empty just because nothing is
close by, the pharmacy/geocode/directions routes' success/empty/error
responses (including that directions always looks up the destination
server-side rather than trusting the client), rate limiting, and the UI's
location-picking, search, and directions states.

## Known limitations

- Coverage is Finland only, and frozen at whenever
  `scripts/fetch_pharmacies.py` was last run — not live. Re-run it to
  refresh.
- Geocoding and directions depend on OpenRouteService's availability; if
  it's down, those two features show a clear error while pharmacy search
  (no live dependency) keeps working. See ADR 0002 for a reliability issue
  observed on ORS's side during development.
- The in-memory rate limiter is per warm serverless instance, not global -
  documented as best-effort in ADR 0002, same as the earlier caching
  design.
- No automated end-to-end/browser test — covered by component-level
  behavior tests instead.
