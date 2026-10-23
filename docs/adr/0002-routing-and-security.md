# ADR 0002: Location picking, directions, and the security model behind them

## Status

Accepted

## Context

Beyond "find pharmacies near my GPS location", the app needed: a way to
choose a starting point other than GPS (search or click-to-pick), and
walking directions to a chosen pharmacy. Both need a geocoding service and a
routing service. They also raise a real security question: once the app
calls a third-party API with a paid/rate-limited key, that key and that
third-party relationship become part of the attack surface.

## Decision: OpenRouteService (ORS) for geocoding and routing

ORS (openrouteservice.org, run by HeiGIT) provides both forward geocoding
and turn-by-turn walking directions from one API key, over OSM-derived data
- consistent with the rest of the app's open-data approach. It has a free
tier sufficient for this app's scope.

**Known reliability caveat, observed directly during development:** ORS's
service has had an active, acknowledged outage (a PHP issue on their
account/dashboard backend) that intermittently returns `403 Access to this
API has been disallowed` for both geocoding and directions, confirmed by
calling their API directly, independent of anything in this app. The app
handles this the same way it handles any upstream failure: a clean `502`
with a user-facing "try again shortly" message, never a crash or a hang.
This is a real external dependency with no SLA, the same category of risk
documented in [ADR 0001](0001-pharmacy-data-source.md) for the pharmacy
data source itself - the mitigation there (move to a build-time snapshot)
isn't available here because routing/geocoding are inherently per-request,
live operations that can't be precomputed for an arbitrary start point.

## Decision: the ORS key never reaches the browser

`src/lib/ors.ts` is a server-only module (never imported from a `"use
client"` file) that reads `ORS_API_KEY` from the server environment. The
browser never talks to ORS directly - it calls two of this app's own API
routes instead:

- `GET /api/geocode?q=...` - proxies to ORS geocoding, server-side.
- `GET /api/directions?lat=&lon=&pharmacyId=...` - proxies to ORS
  directions, server-side.

This isn't just "don't leak the key" as a slogan: `/api/directions`
specifically **looks up the destination server-side from the app's own
pharmacy dataset by id** (`findPharmacyById`) rather than accepting
caller-supplied destination coordinates. Without that constraint, this
proxy would be an open, unrestricted relay for arbitrary ORS directions
requests to anyone who found the endpoint - burning the shared API key's
quota on requests that have nothing to do with pharmacies. Destinations are
always one of our own known pharmacies; origins are the only
caller-supplied coordinates, and those are validated as real lat/lon ranges
before use.

## Decision: rate limiting and a strict Content-Security-Policy

Two more layers, because a single control is never enough for anything
described as needing serious security:

**Per-IP rate limiting** (`src/lib/rateLimit.ts`) on `/api/geocode` and
`/api/directions` - a best-effort in-memory sliding window (30 requests/
minute/IP). It won't stop a determined distributed attacker, but it raises
the cost of casually draining the shared ORS quota through this app, which
is the realistic threat here.

**A real Content-Security-Policy**, set per-request in `middleware.ts`
with a fresh nonce on every response (`script-src 'self' 'nonce-...'
'strict-dynamic'`, no `'unsafe-inline'` for scripts), plus
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`
that explicitly denies camera/microphone/payment and scopes geolocation to
this origin, and HSTS. Getting the nonce working correctly required
discovering (the hard way, via a completely blank, unhydrated page) that
**Next.js can only inject a per-request nonce into dynamically rendered
pages** - a statically prerendered page has no request to read a nonce
from at all. `app/page.tsx` is therefore marked `export const dynamic =
"force-dynamic"`, trading away static generation for this one page in
exchange for a script-src with no inline-script escape hatch.

This is not literal PCI-DSS (there's no payment flow or cardholder data in
this app for that standard to apply to) - but it is the same underlying
discipline a payment flow would need: secrets never leave the server,
proxied third-party calls are constrained to exactly what the app needs
them for, requests are rate-limited, and the CSP doesn't have the common
`'unsafe-inline'`/`'unsafe-eval'` escape hatches that make most CSPs
security theater.

## Consequences

- Geocoding and directions depend on ORS being reachable; if it's down,
  those two features degrade gracefully while pharmacy search (which has
  no live dependency at all, per ADR 0001) keeps working.
- The rate limiter is per-warm-instance, not global, on serverless hosting
  - documented as best-effort, same as the earlier pharmacy-search cache
    design.
- Any future third-party API this app integrates should follow the same
  pattern: server-only client module, a narrow proxy route (never a raw
  passthrough of caller input), rate limiting, and nothing added to
  `connect-src` in the CSP, since the browser should never need to reach it
  directly.
