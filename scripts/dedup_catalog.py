#!/usr/bin/env python3
"""
Deduplicate product IDs in catalog.json by appending brand slug to duplicates.

Run:  uv run scripts/dedup_catalog.py   (from repo root)
"""
import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(ROOT, "config")
CATALOG_PATH = os.path.join(CONFIG_DIR, "catalog.json")


def _brand_slug(brand: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", brand).strip("-").lower()
    return slug if slug else "unknown"


def dedup_catalog(products: list[dict]) -> list[dict]:
    seen: dict[str, int] = {}
    dup_count: defaultdict[str, int] = defaultdict(int)
    renamed = []
    result = []
    for p in products:
        pid = p["id"]
        brand = p.get("brand", "")
        if pid in seen:
            slug = _brand_slug(brand)
            new_id = f"{pid}-{slug}"
            # Handle case where brand slug doesn't differentiate (same brand duplicated)
            while new_id in seen:
                dup_count[pid] += 1
                new_id = f"{pid}-{slug}-{dup_count[pid]}"
            old_id = p["id"]
            p["id"] = new_id
            renamed.append((old_id, new_id, brand))
        seen[p["id"]] = True
        result.append(p)

    if renamed:
        print(f"Renamed {len(renamed)} products:")
        for old_id, new_id, brand in renamed:
            print(f"  {old_id:45s} -> {new_id:50s} ({brand})")
    return result


def main():
    if not os.path.exists(CATALOG_PATH):
        print(f"Error: {CATALOG_PATH} not found")
        sys.exit(1)

    with open(CATALOG_PATH, encoding="utf-8") as f:
        data = json.load(f)

    products = data if isinstance(data, list) else data.get("products", [])
    before = len(products)
    unique_before = len({p["id"] for p in products})
    print(f"Before: {before} products, {unique_before} unique IDs")

    deduped = dedup_catalog(products)
    unique_after = len({p["id"] for p in deduped})

    if unique_before == unique_after:
        print("No duplicates to fix.")
        return 0

    # Write back
    if isinstance(data, list):
        output = deduped
    else:
        data["products"] = deduped
        output = data

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nAfter:  {len(deduped)} products, {unique_after} unique IDs")
    print(f"Fixed: {unique_after - unique_before} duplicate IDs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
