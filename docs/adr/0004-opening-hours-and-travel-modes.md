# ADR 0004: Opening hours and multi-modal directions

## Status

Accepted

## Context

Knowing the nearest pharmacy is only useful if it's actually open - and if
getting there takes long enough that it won't be by the time you arrive.
This needed two things the app didn't have: opening hours data, and
directions for more than one way of getting there (walking, cycling,
driving), so "how long will this take" has a real answer regardless of how
someone travels.

## Decision: opening hours from a one-time OSM extract, not Overture

Checked directly against the Parquet schema for this project's Overture
Maps release (the pharmacy data source, see ADR 0001): there is no
opening-hours field in the `places` theme at all, even though Overture
aggregates OSM data that often has one. OSM's own `opening_hours` tag is
the source of truth here.

`scripts/refine_pharmacies_with_osm.py` (originally `add_opening_hours.py` -
renamed when it took on a second job, see ADR 0005) extracts it from a local
Finland `.osm.pbf` extract via `pyosmium` and proximity-matches it into the
existing `pharmacies.json` by coordinates (within 75m - OSM and Overture
don't survey the exact same point for the same physical pharmacy). Same
reasoning as the rest of this app's data pipeline: a one-time batch read of
a downloaded file has no live-availability risk, unlike a per-request call
to a volunteer-run API (which is exactly what broke twice for routing - see
ADR 0003). Coverage: 521 of 893 pharmacy records matched; the rest show
as "hours unknown" rather than guessing.

## Decision: parsing with `opening_hours.js`, and two bugs that would have
## shipped silently without checking

OSM's `opening_hours` syntax (`Mo-Fr 08:00-19:00; Sa 09:00-17:00; Su,PH
off`, plus week-interval and seasonal variants actually present in this
dataset) is non-trivial enough that hand-parsing it would be a correctness
risk for no good reason - `opening_hours.js` is the de facto standard
library for it. Verifying it against this app's actual data (`src/lib/__tests__/openingHours.test.ts`
and a one-off check of all 522 matched strings) surfaced two real problems
before they reached production:

1. **Timezone**: the library has no explicit timezone parameter - it reads
   the Node process's local timezone to interpret what "08:00" means and to
   compute "next change" times. Vercel's functions run in UTC by default.
   Without forcing `process.env.TZ = "Europe/Helsinki"` (every pharmacy in
   this app is in Finland), every open/closed computation in production
   would have been off by Finland's UTC offset (2-3 hours) - confirmed by
   deliberately testing with `TZ=UTC` before adding the fix.
2. **Public holidays**: ~28 of the 522 real opening-hours strings use a
   `PH` (public holiday) selector, which the library can't resolve without
   a country context - it throws rather than returning "unknown" state.
   Fixed by always passing `{ address: { country_code: "fi" } }`.

Both are in `src/lib/openingHours.ts`, the only place this library is used
(server-only - it's never imported from a `"use client"` file).

## Decision: fetch all three travel modes per request, server-computed
## "closed on arrival"

`GET /api/directions` now calls the routing providers (ORS, falling back to
GraphHopper per ADR 0003) for `foot`, `bike`, and `car` in parallel via
`Promise.all`, each independently allowed to fail - one mode failing
(observed in practice: GraphHopper doesn't always have equally good
coverage across profiles) doesn't take down the other two. For each
successful mode, the route's arrival time (`now + duration`) is checked
against the pharmacy's opening hours server-side, so the client never needs
the `opening_hours` parsing library (and its `i18next`/`suncalc`
dependencies) in the browser bundle at all - it just renders a boolean.

The existing 100km walking-only distance guard became a 300km guard across
all three modes (driving genuinely can be a reasonable distance in rural
Finland; nothing in this app's scope needs more than that).

## Consequences

- Refreshing opening hours requires re-downloading the (~770MB) Finland
  `.osm.pbf` extract and re-running `add_opening_hours.py` - not something
  to do often, but the data doesn't change fast either. Documented in the
  README alongside the existing Overture refresh step.
- Three routing calls per "Directions" click instead of one triples the
  load on the shared ORS/GraphHopper quota - still comfortably within the
  free-tier limits for this app's actual traffic (see the quota numbers
  discussed when this was built).
- `isOpenNow`/`isOpenOnArrival` are `null`, not `false`, when hours are
  unknown - the UI must treat "unknown" and "closed" as visually distinct
  states, not conflate them.
