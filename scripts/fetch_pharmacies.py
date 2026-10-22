#!/usr/bin/env python3
"""
One-time (occasionally re-run) ETL: pulls Finnish pharmacy places out of the
Overture Maps "places" theme and writes src/data/pharmacies.json.

Why this exists: the app originally queried OpenStreetMap's Overpass API live,
per request. In production that turned out to be unreliable (see
docs/adr/0001-pharmacy-data-source.md for the actual error codes observed) -
public Overpass mirrors either blocked or rate-limited this app's hosting IPs.
This script instead does a single batch extraction from Overture Maps (which
itself aggregates OSM and other open sources) using DuckDB's httpfs/spatial
extensions to read only the relevant rows directly from Overture's public S3
bucket - no local download of the full global dataset.

The output is intentionally NOT deduplicated here: Overture (like OSM) has
duplicate place records for the same physical pharmacy, surveyed/aggregated
more than once. Deduplication is the interesting, tested logic and lives in
TypeScript (src/lib/pharmacies.ts: dedupePharmacies), run once at app
startup, so it's covered by the same test suite as everything else.

Usage:
    pip install duckdb
    python3 scripts/fetch_pharmacies.py [overture-release]
"""

import json
import sys
from pathlib import Path

import duckdb

DEFAULT_RELEASE = "2026-10-21.0"

# Generous box around Finland (and a bit of the Baltic/Scandinavia) - the
# addresses[].country = 'FI' filter below does the real narrowing.
BBOX = {"min_lon": 19.0, "max_lon": 31.6, "min_lat": 59.0, "max_lat": 70.2}
COUNTRY = "FI"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "pharmacies.json"
FALLBACK_NAME = "Apteekki"


def build_address(addr: dict) -> str | None:
    parts = [addr.get("freeform"), addr.get("postcode"), addr.get("locality")]
    joined = ", ".join(p for p in parts if p)
    return joined or None


def main() -> None:
    release = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RELEASE

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    con.execute("SET s3_region='us-west-2';")
    con.execute("SET lambda_syntax='ENABLE_SINGLE_ARROW';")

    rows = con.execute(
        f"""
        SELECT
            id,
            names.primary AS name,
            ST_X(geometry) AS lon,
            ST_Y(geometry) AS lat,
            addresses
        FROM read_parquet(
            's3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*',
            hive_partitioning=1
        )
        WHERE bbox.xmin BETWEEN {BBOX['min_lon']} AND {BBOX['max_lon']}
          AND bbox.ymin BETWEEN {BBOX['min_lat']} AND {BBOX['max_lat']}
          AND basic_category = 'pharmacy_and_drug_store'
          AND len(list_filter(addresses, a -> a.country = '{COUNTRY}')) > 0
        """
    ).fetchall()

    pharmacies = []
    for row_id, name, lon, lat, addresses in rows:
        address = build_address(addresses[0]) if addresses else None
        pharmacies.append(
            {
                "id": f"overture:{row_id}",
                "name": name or FALLBACK_NAME,
                "lat": lat,
                "lon": lon,
                "address": address,
                "source": "overture",
            }
        )

    OUTPUT_PATH.write_text(json.dumps(pharmacies, ensure_ascii=False, indent=2))
    print(f"Wrote {len(pharmacies)} raw pharmacy records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
