# ADR 0001: Pharmacy data source

## Status

Accepted (revised after a production failure — see "What actually happened"
below)

## Context

The app needs a source of pharmacy locations (name, coordinates, address) to
find the nearest ones to a user. The options considered:

1. **A commercial API** (e.g. Google Places). Reliable and well-documented,
   but requires an API key/billing, has usage limits, and the underlying
   place data is closed — we can't inspect or fix bad entries.
2. **OpenStreetMap via the live Overpass API**. Free, no API key, queryable
   directly by `amenity=pharmacy` within a radius.
3. **Overture Maps**, which itself aggregates OSM and other open sources,
   consumed as a one-time batch extraction rather than a live API.

## Decision

Use Overture Maps' `places` theme, extracted once (and re-run occasionally)
into a static dataset bundled with the app — not queried live per request.

## What actually happened (why this isn't the original decision)

The original version of this app queried OSM's **live** Overpass API per
request (option 2), on the reasoning that a batch pipeline was
disproportionate for an app this size. That shipped, got deployed to Vercel,
and failed in production: both public Overpass mirrors rejected the
deployed app's requests outright.

```
overpass-api.de responded 406
overpass.kumi.systems responded 429
```

This wasn't a local fluke — it was reproduced from three independent network
paths (local shell, a real Chrome browser session, and the live Vercel
deployment's own function logs) before concluding the mirrors themselves
were blocking/rate-limiting this traffic, not a bug in the request code.
Public Overpass instances have no uptime SLA and actively throttle traffic
patterns they consider abusive, which a shared-IP serverless platform like
Vercel is prone to triggering through no fault of any single app.

Rather than keep guessing at mirror reliability, the fix was to stop making
a live call on the request path at all: `scripts/fetch_pharmacies.py` uses
DuckDB to pull Finnish `pharmacy_and_drug_store` places directly out of
Overture's public Parquet release on S3 (filtered by bounding box and
`addresses[].country = 'FI'` — no full dataset download, no credentials
needed) into `src/data/pharmacies.json`. The API route now does an in-memory
nearest-neighbor search over that bundled file — no network call, no
external dependency, no way for a third party's rate limiter to 502 a user
clicking the button.

## Consequences

**Data quality still has to be handled in code.** Overture, like OSM, has
duplicate place records for the same physical pharmacy (visible in the raw
extract: the same "Kimito Apotek" appears twice a few meters apart with
different confidence scores). `lib/pharmacies.ts`'s `dedupePharmacies`
clusters entries within ~25m and keeps the most complete one — this logic
is unchanged from the original Overpass-based design and is still the most
heavily tested part of the app, because it never actually depended on which
API the raw data came from.

**Coverage is Finland-only and frozen at extraction time**, not live. This
is an explicit, documented tradeoff for an app at this scope (and Treat
Health's home market), not an oversight — see the README's "Known
limitations" section, including how to re-run the extraction.

**No live third-party dependency at request time** means no rate limits, no
mirror outages, no timeout budget to manage in the route handler — the
tradeoff of a batch pipeline (schema drift between Overture releases,
needing to remember to refresh the data) is one we can control, unlike a
public API's uptime.

## If this needed to scale further

Re-run `scripts/fetch_pharmacies.py` on a schedule (cron/GitHub Action) and
widen the bounding box beyond Finland, or move the dataset into a small
spatial index/database if the in-memory linear scan stops being fast enough
for the covered area.
