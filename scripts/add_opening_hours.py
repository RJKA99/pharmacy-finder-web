#!/usr/bin/env python3
"""
One-time (occasionally re-run) ETL: adds an `openingHours` field to
src/data/pharmacies.json by matching each Overture-sourced pharmacy to the
nearest OpenStreetMap pharmacy node/way that has an `opening_hours` tag.

Why a separate step from fetch_pharmacies.py: Overture Maps' places schema
(checked directly against the Parquet schema for this project's release)
has no opening-hours field at all, even though it aggregates OSM data that
often does carry one. OSM's own `opening_hours` tag is the source of truth
here, extracted via a local .osm.pbf extract rather than a live Overpass
API call - same reasoning as ADR 0001: a live per-request call to a
volunteer-run service is not something this app depends on, but a one-time
batch read of a downloaded file has no such availability risk.

Usage:
    pip install -r scripts/requirements.txt
    curl -LO https://download.geofabrik.de/europe/finland-latest.osm.pbf
    python3 scripts/add_opening_hours.py finland-latest.osm.pbf
"""

import json
import math
import sys
from pathlib import Path

import osmium

PHARMACIES_PATH = Path(__file__).parent.parent / "src" / "data" / "pharmacies.json"

# OSM surveys and Overture's aggregation of them don't place a node at
# exactly the same point for the same physical pharmacy - this just needs
# to be smaller than the distance between two different nearby pharmacies.
MATCH_RADIUS_METERS = 75
EARTH_RADIUS_METERS = 6_371_000


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1, math.sqrt(a)))


class PharmacyHoursHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.entries: list[dict] = []

    def node(self, n):
        if n.tags.get("amenity") == "pharmacy" and n.tags.get("opening_hours"):
            self.entries.append(
                {"lat": n.location.lat, "lon": n.location.lon, "opening_hours": n.tags.get("opening_hours")}
            )

    def way(self, w):
        if w.tags.get("amenity") != "pharmacy" or not w.tags.get("opening_hours"):
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


def find_nearest_hours(lat: float, lon: float, osm_entries: list[dict]) -> str | None:
    best_distance = MATCH_RADIUS_METERS
    best_hours = None
    for entry in osm_entries:
        distance = haversine_meters(lat, lon, entry["lat"], entry["lon"])
        if distance <= best_distance:
            best_distance = distance
            best_hours = entry["opening_hours"]
    return best_hours


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/add_opening_hours.py <path-to-finland.osm.pbf>")
        sys.exit(1)

    pbf_path = sys.argv[1]
    handler = PharmacyHoursHandler()
    handler.apply_file(pbf_path, locations=True)
    print(f"Extracted {len(handler.entries)} OSM pharmacy records with opening_hours")

    pharmacies = json.loads(PHARMACIES_PATH.read_text())
    matched = 0
    for pharmacy in pharmacies:
        hours = find_nearest_hours(pharmacy["lat"], pharmacy["lon"], handler.entries)
        pharmacy["openingHours"] = hours
        if hours:
            matched += 1

    PHARMACIES_PATH.write_text(json.dumps(pharmacies, ensure_ascii=False, indent=2))
    print(f"Matched opening hours for {matched}/{len(pharmacies)} pharmacies")


if __name__ == "__main__":
    main()
