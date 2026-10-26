# Pharmacy Finder (web)

Finds the nearest pharmacies to a starting point in Finland, shows whether
each is open right now, and gives walking, cycling, or driving directions
to any of them - warning you if one will have closed by the time you'd
arrive.

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
3. Each pharmacy's opening hours (from a separate one-time OSM extract, see
   [`docs/adr/0004-opening-hours-and-travel-modes.md`](docs/adr/0004-opening-hours-and-travel-modes.md))
   are checked server-side against the current time to show "Open now" /
   "Closed now" / "Hours unknown".
4. Address search and directions are proxied server-side to
   [OpenRouteService](https://openrouteservice.org/), falling back to
   [GraphHopper](https://www.graphhopper.com/) if ORS fails - see
   [`docs/adr/0003-routing-provider-fallback.md`](docs/adr/0003-routing-provider-fallback.md).
   The browser never talks to either provider directly, and the directions
   endpoint only ever routes to a pharmacy from the app's own dataset, never
   an arbitrary caller-supplied destination. See
   [`docs/adr/0002-routing-and-security.md`](docs/adr/0002-routing-and-security.md)
   for the full security model (CSP, rate limiting, key handling).
5. "Directions" fetches walking, cycling, and driving routes in parallel,
   each with a distance/duration and an arrival-time opening-hours check -
   switching between them updates both the panel and the route drawn on the
   map.
6. The same `/api/pharmacies` endpoint is also what the companion
   [iOS app](https://github.com/RJKA99/pharmacy-finder-ios) calls.

## Tech stack

| Layer      | Choice                                            |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router), TypeScript                  |
| Styling    | Tailwind CSS v4                                      |
| Data       | Overture Maps (DuckDB extraction) + OSM opening hours, Finland |
| Routing    | OpenRouteService, falls back to GraphHopper - foot/bike/car    |
| Map        | Leaflet, OSM raster tiles                             |
| Tests      | Vitest + React Testing Library                        |
| CI         | GitHub Actions                                       |
| Hosting    | Vercel                                               |

## Project layout

```
scripts/
  fetch_pharmacies.py          # one-time/occasional Overture -> JSON extraction
  add_opening_hours.py         # one-time/occasional OSM opening_hours merge
middleware.ts                 # per-request CSP nonce
src/
  app/
    api/pharmacies/route.ts   # GET: lat/lon -> nearest pharmacies (+ isOpenNow)
    api/geocode/route.ts      # GET: address text -> coordinates
    api/directions/route.ts   # GET: origin + pharmacyId -> routes for foot/bike/car
    page.tsx                  # single-page UI
  components/
    PharmacyFinder.tsx         # orchestrates location picking -> search -> directions
    AddressSearch.tsx          # debounced geocoding search box
    PharmacyMap.tsx             # Leaflet: origin/pharmacy markers, click-to-pick, route line
    PharmacyList.tsx            # results + open/closed badges
    DirectionsPanel.tsx         # travel-mode tabs, steps, closed-on-arrival warning
  hooks/
    useGeolocation.ts
    usePharmacySearch.ts
    useDirections.ts
  lib/
    pharmacies.ts                # dedup clustering, nearest-N search, isOpenNow
    openingHours.ts              # server-only opening_hours.js wrapper
    geo.ts                       # haversine distance
    routing.ts                   # tries ORS, falls back to GraphHopper
    providers/
      ors.ts                      # server-only OpenRouteService client
      graphhopper.ts               # server-only GraphHopper client (fallback)
    rateLimit.ts                 # per-IP rate limiting for the routing-backed routes
  data/
    pharmacies.json              # bundled dataset (output of the fetch scripts)
docs/adr/
  0001-pharmacy-data-source.md
  0002-routing-and-security.md
  0003-routing-provider-fallback.md
  0004-opening-hours-and-travel-modes.md
```

## Running locally

```bash
npm install
cp .env.example .env.local
# add a free ORS key:         https://account.heigit.org
# add a free GraphHopper key: https://www.graphhopper.com (used only as a fallback)
npm run dev                  # http://localhost:3000
```

## Refreshing the pharmacy dataset

```bash
pip install -r scripts/requirements.txt
python3 scripts/fetch_pharmacies.py          # writes src/data/pharmacies.json (Overture)

curl -LO https://download.geofabrik.de/europe/finland-latest.osm.pbf
python3 scripts/add_opening_hours.py finland-latest.osm.pbf   # adds openingHours
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
close by, opening-hours parsing (including the timezone and public-holiday
bugs documented in ADR 0004), that the routing fallback actually falls back
when the primary provider fails, the pharmacy/geocode/directions routes'
success/empty/error responses (including that directions always looks up
the destination server-side rather than trusting the client, and that one
travel mode failing doesn't take down the other two), rate limiting, and
the UI's location-picking, search, directions, and open/closed states.

## Known limitations

- Coverage is Finland only, and frozen at whenever the fetch scripts were
  last run — not live. Re-run them to refresh.
- Opening hours are matched from OSM by proximity and are only as complete
  as OSM's own tagging (522 of 971 raw records have them); the rest show as
  "Hours unknown" rather than a guess.
- Geocoding and directions depend on ORS or GraphHopper being reachable; if
  both are down, those two features show a clear error while pharmacy
  search (no live dependency) keeps working. See ADR 0003 for a reliability
  issue observed on ORS's side (twice) during development, and why
  GraphHopper exists as a fallback rather than a single point of failure.
- The in-memory rate limiter is per warm serverless instance, not global -
  documented as best-effort in ADR 0002, same as the earlier caching
  design.
- No automated end-to-end/browser test — covered by component-level
  behavior tests instead.
