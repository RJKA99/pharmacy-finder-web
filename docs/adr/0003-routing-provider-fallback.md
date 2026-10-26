# ADR 0003: Fall back to a second routing/geocoding provider

## Status

Accepted

## Context

[ADR 0002](0002-routing-and-security.md) chose OpenRouteService (ORS) for
geocoding and walking directions. During development, ORS had an active,
multi-day outage on its account/dashboard backend (a PHP issue, acknowledged
by the HeiGIT team) that intermittently returns `403 Access to this API has
been disallowed`. It recurred at least twice over several days of this
project's development, confirmed each time by calling ORS directly,
independent of this app's code.

A single routing provider with no fallback means "find directions" can be
completely unavailable for however long the provider's own infrastructure
is down, with nothing this app can do about it in the moment. This is the
same category of problem [ADR 0001](0001-pharmacy-data-source.md) solved
for the pharmacy data source (by removing the live dependency entirely) -
but geocoding and turn-by-turn directions are inherently live, per-request
operations for an arbitrary start point, so they can't be precomputed into
a static snapshot the way the pharmacy list could.

## Decision

Add GraphHopper as a second provider and try it automatically if ORS fails,
mirroring the mirror-fallback pattern originally used for the Overpass API
pharmacy lookup (also in ADR 0001, before that was replaced by a snapshot).

`src/lib/providers/ors.ts` and `src/lib/providers/graphhopper.ts` both
implement the same two-function shape (`geocode`, `fetchWalkingRoute`).
`src/lib/routing.ts` tries ORS first, then GraphHopper, and only fails if
both do. The API routes (`/api/geocode`, `/api/directions`) import from
`routing.ts`, not from either provider directly, so neither knows or cares
which provider actually answered.

GraphHopper was chosen as the fallback because it offers both geocoding and
directions from one API key (same shape as ORS, so the fallback is a true
drop-in), is commercially operated rather than running on the same
infrastructure as ORS (uncorrelated failure mode), and has a free tier
sufficient for this app's scope.

## Consequences

- Two API keys to provision instead of one (`ORS_API_KEY`,
  `GRAPHHOPPER_API_KEY`) - both server-only, never sent to the client, same
  as the original design in ADR 0002.
- A request that hits both providers failing (rare, but observed: ORS down
  and no GraphHopper key configured yet) takes up to ~16s (two 8s timeouts)
  before returning a clean 502, instead of ~8s for a single-provider
  failure. Acceptable for this app's traffic; worth revisiting with a
  shorter per-provider timeout if it ever matters.
- `GeocodeResult` and `RouteResult` (`src/lib/types.ts`) are the contract
  every provider must normalize into - adding a third provider later means
  implementing that shape, not changing any calling code.
