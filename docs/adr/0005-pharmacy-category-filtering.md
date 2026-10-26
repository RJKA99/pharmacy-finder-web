# ADR 0005: Validating pharmacy category against OSM, not just Overture

## Status

Accepted

## Context

Overture's `basic_category = 'pharmacy_and_drug_store'` filter (ADR 0001)
turned out to be noisier than its name suggests. Spot-checking the bundled
dataset surfaced entries that are clearly not retail pharmacies: "Metsäyhtymä
Khan Aira Ja Sofia" (a forest-land co-ownership entity caught by a name/geo
collision), "Herbalife Jakelija" (a supplement distributor), physiotherapists,
naprapaths, and several pharmaceutical wholesalers/manufacturers (Orion
Pharma, Servier Finland Oy) that share the category tag without being a place
the public can walk into and get a prescription filled. A quick audit found
106 of 971 records (~11%) with no pharmacy-related word in their name at all.

## Decision: use OSM's `amenity=pharmacy` tag as a validation signal, not just an opening-hours source

`scripts/refine_pharmacies_with_osm.py` (renamed from `add_opening_hours.py`,
which already did the one-time OSM `.osm.pbf` pass described in ADR 0004) now
also drops any Overture record with neither of two corroborating signals:

1. A real OSM `amenity=pharmacy` node/way within 150m, or
2. A name containing a pharmacy-indicative word (`apteekki`, `apotek`,
   `pharmacy`, `farmasi`).

A record is dropped only if **both** checks fail. OSM's tag is a much more
deliberate, specific signal than Overture's broad category, so "OSM
corroborates it, or the name makes it obvious anyway" is a solid bar for "is
this actually a pharmacy."

## A bug in the first version of this filter, caught before shipping

The first pass used proximity only, at the same 75m radius already used for
opening-hours matching, and no name check. Run against the real dataset, it
dropped 338/971 records (vs. the ~106 expected) — including obviously real,
well-known pharmacies like multiple "Yliopiston Apteekki" branches. An
isolated single-record debug test of the exact same matching code worked
correctly, which was initially confusing; the actual cause was simpler: 75m
is tight enough that ordinary Overture/OSM coordinate drift for the *same*
physical pharmacy (different surveys, a shopping-centre entrance vs. an
interior point, re-tagging years apart) regularly exceeds it, especially for
chain branches. Proximity alone was never going to be a safe drop signal at
that radius.

Fixed by splitting the two uses of proximity apart: opening-hours matching
stays tight (75m — a wrong opening-hours match is worse than no match), while
the "is this a pharmacy" validation check uses a wider 150m radius *and* only
drops a record when the name itself gives no corroborating signal either.
This two-factor approach is deliberately conservative — it would rather keep
a handful of borderline non-pharmacies than risk dropping a real one. Verified
by re-running against the full dataset: 78 dropped (all genuinely
non-pharmacy businesses on inspection — distributors, wholesalers,
physiotherapists, a forest-ownership entity), 893 kept, including every
"Yliopiston Apteekki" branch that was wrongly dropped before.

## Consequences

- Precision over recall was already the explicit tradeoff from ADR 0001's
  follow-up concerns; this makes it concrete: a few non-pharmacy records with
  a pharmacy-sounding name but no OSM corroboration (rare) could still slip
  through, but the obviously-wrong ones (no pharmacy word, no OSM match) are
  gone.
- Re-running this script after refreshing `fetch_pharmacies.py`'s Overture
  extract is now part of the same step, not a separate pass — see the
  README's "Refreshing the pharmacy dataset" section.
