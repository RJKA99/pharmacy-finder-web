#!/usr/bin/env python3
"""
One-time (occasionally re-run) ETL: cross-checks src/data/pharmacies.json
(sourced from Overture Maps) against OpenStreetMap's own `amenity=pharmacy`
tag, using a local .osm.pbf extract.

Does two things in one pass over the same extract:

1. Adds `openingHours` where OSM has it (originally this script's only job
   - see docs/adr/0004-opening-hours-and-travel-modes.md).
2. Drops any pharmacies.json entry with no corresponding OSM
   `amenity=pharmacy` node/way nearby at all. Overture's
   `basic_category = 'pharmacy_and_drug_store'` filter (used in
   fetch_pharmacies.py) turned out to be noisier than expected: ~11% of the
   raw records aren't pharmacies at all (health/wellness/medical-supply
   businesses like "Herbalife Jakelija", a physiotherapist, a forest-land
   co-ownership entity picked up by name collision). OSM's amenity tag is a
   much more deliberate, specific signal, so "no nearby OSM pharmacy node"
   is used as a precision filter. See
   docs/adr/0005-pharmacy-category-filtering.md for the full story and the
   precision/recall tradeoff this accepts.

Usage:
    pip install -r scripts/requirements.txt
    curl -LO https://download.geofabrik.de/europe/finland-latest.osm.pbf
    python3 scripts/refine_pharmacies_with_osm.py finland-latest.osm.pbf
"""

import json
import math
import re
import sys
from pathlib import Path

import osmium

PHARMACIES_PATH = Path(__file__).parent.parent / "src" / "data" / "pharmacies.json"

# For matching opening hours, kept tight - a wrong match would show the
# wrong hours for a real pharmacy.
HOURS_MATCH_RADIUS_METERS = 75

# For the "is this actually a pharmacy" validation check, wider - a chain's
# Overture point and OSM's own survey point for the same physical pharmacy
# can legitimately be 100m+ apart (different entrances of a shopping
# centre, a re-survey years apart, etc.), and 75m proved too tight: the
# first version of this script, proximity-only at 75m, dropped real,
# clearly-named pharmacies like "Yliopiston Apteekki" branches it shouldn't
# have.
VALIDATION_RADIUS_METERS = 150

EARTH_RADIUS_METERS = 6_371_000

PHARMACY_NAME_PATTERN = re.compile(r"apteekk|apotek|pharmacy|farmasi|apteek", re.IGNORECASE)


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1, math.sqrt(a)))


class OsmPharmacyHandler(osmium.SimpleHandler):
    """Collects every OSM amenity=pharmacy node/way, with or without opening_hours."""

    def __init__(self):
        super().__init__()
        self.entries: list[dict] = []

    def node(self, n):
        if n.tags.get("amenity") == "pharmacy":
            self.entries.append(
                {"lat": n.location.lat, "lon": n.location.lon, "opening_hours": n.tags.get("opening_hours")}
            )

    def way(self, w):
        if w.tags.get("amenity") != "pharmacy":
            return
        try:
            center = w.nodes[len(w.nodes) // 2]
            if center.location.valid():
                self.entries.append(
                    {
                        "lat": center.location.lat,
                        "lon": center.location.lon,
                        "opening_hours": w.tags.get("opening_hours"),
                    }
                )
        except Exception:
            pass


def find_nearest(lat: float, lon: float, osm_entries: list[dict], radius_meters: float) -> dict | None:
    best_distance = radius_meters
    best_entry = None
    for entry in osm_entries:
        distance = haversine_meters(lat, lon, entry["lat"], entry["lon"])
        if distance <= best_distance:
            best_distance = distance
            best_entry = entry
    return best_entry


def looks_like_a_pharmacy_name(name: str) -> bool:
    return bool(PHARMACY_NAME_PATTERN.search(name))


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/refine_pharmacies_with_osm.py <path-to-finland.osm.pbf>")
        sys.exit(1)

    pbf_path = sys.argv[1]
    handler = OsmPharmacyHandler()
    handler.apply_file(pbf_path, locations=True)
    print(f"Found {len(handler.entries)} OSM amenity=pharmacy nodes/ways in the extract")

    pharmacies = json.loads(PHARMACIES_PATH.read_text())
    kept = []
    dropped = []
    matched_with_hours = 0

    for pharmacy in pharmacies:
        hours_match = find_nearest(pharmacy["lat"], pharmacy["lon"], handler.entries, HOURS_MATCH_RADIUS_METERS)
        if hours_match is not None:
            pharmacy["openingHours"] = hours_match["opening_hours"]
            if hours_match["opening_hours"]:
                matched_with_hours += 1

        # A real, nearby OSM amenity=pharmacy node is the strongest signal,
        # but a clearly pharmacy-named record is kept even without one -
        # Overture/OSM coordinates for the same physical pharmacy can
        # legitimately differ by more than this validation radius.
        validation_match = hours_match or find_nearest(
            pharmacy["lat"], pharmacy["lon"], handler.entries, VALIDATION_RADIUS_METERS
        )
        if validation_match is None and not looks_like_a_pharmacy_name(pharmacy["name"]):
            dropped.append(pharmacy["name"])
            continue

        kept.append(pharmacy)

    PHARMACIES_PATH.write_text(json.dumps(kept, ensure_ascii=False, indent=2))

    print(f"Kept {len(kept)}/{len(pharmacies)} records")
    print(f"Of those, {matched_with_hours} have opening hours")
    print(f"Dropped {len(dropped)} records (no nearby OSM pharmacy match AND no pharmacy word in the name):")
    for name in dropped:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
