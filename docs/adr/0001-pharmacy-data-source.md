# ADR 0001: Pharmacy data source

## Status

Accepted

## Context

The app needs a source of pharmacy locations (name, coordinates, address) to
find the nearest ones to a user. The options considered:

1. **A commercial API** (e.g. Google Places). Reliable and well-documented,
   but requires an API key/billing, has usage limits, and the underlying
   place data is closed — we can't inspect or fix bad entries.
2. **Overture Maps** places data. Open, high-quality, aggregated from
   multiple sources — but distributed as large Parquet files meant for batch
   processing (DuckDB/Spark), not a live per-request lookup API. Using it
   well would mean standing up our own ETL and hosting a places index, which
   is disproportionate for this app's scope.
3. **OpenStreetMap via the Overpass API**. Free, no API key, queryable
   directly by `amenity=pharmacy` tag within a radius, and the data is
   editable by anyone — which is also its main weakness.

## Decision

Use OpenStreetMap data via the public Overpass API (`amenity=pharmacy`).

## Consequences

**Data quality is uneven and must be handled in code, not ignored:**
OSM pharmacy entries sometimes have duplicate nodes for the same physical
pharmacy (re-surveyed independently by different mappers), missing `name`
tags, or incomplete address tags. `lib/pharmacies.ts` handles this
explicitly: entries within ~25m of each other are clustered and the most
complete one is kept, missing names fall back to a generic label, and
entries with no usable coordinates are dropped rather than crashing the
request.

**Public Overpass instances have no uptime SLA and actively rate-limit or
block traffic they consider abusive.** During development, `overpass-api.de`
returned `406` for this project's network egress and `overpass.kumi.systems`
occasionally stalled — both are known, accepted realities of relying on
volunteer-run infrastructure, not bugs in this app. The client
(`lib/overpass.ts`) tries both mirrors in order and the route handler
(`app/api/pharmacies/route.ts`) caches results for 5 minutes per rounded
coordinate to reduce load on whichever mirror answers. If both mirrors are
down, the API returns a `502` with a clear message instead of hanging.

**Coverage and freshness depend on OSM community mapping activity** in a
given area, unlike a commercial dataset with contracted update guarantees.
This is an accepted tradeoff for a project at this scope, and is called out
in the README's "Known limitations" section.

## Alternatives revisited

If this needed to scale beyond a demo (production traffic, an SLA), the
right next step would be a scheduled batch job importing Overture Maps'
pharmacy places into a small database or search index, rather than querying
Overpass live on every request.
