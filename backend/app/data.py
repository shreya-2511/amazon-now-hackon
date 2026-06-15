"""Config loading + catalog helpers. All demo data lives in repo-root /config."""
from __future__ import annotations

import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


def _load(name: str) -> dict:
    with open(CONFIG_DIR / name, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def settings() -> dict:
    return _load("settings.json")


@lru_cache(maxsize=1)
def personas() -> dict:
    return _load("personas.json")


@lru_cache(maxsize=1)
def fridge() -> dict:
    return _load("fridge.json")


@lru_cache(maxsize=1)
def history() -> dict:
    return _load("history.json")


@lru_cache(maxsize=1)
def calendar() -> dict:
    return _load("calendar.json")


@lru_cache(maxsize=1)
def scenarios() -> dict:
    return _load("scenarios.json")


@lru_cache(maxsize=1)
def family() -> dict:
    return _load("family.json")


@lru_cache(maxsize=1)
def coupons() -> list[dict]:
    return _load("coupons.json")["coupons"]


@lru_cache(maxsize=1)
def catalog() -> list[dict]:
    return _load("catalog.json")["products"]


@lru_cache(maxsize=1)
def recipes() -> list[dict]:
    return _load("recipes.json")["recipes"]


@lru_cache(maxsize=1)
def _catalog_index() -> dict[str, dict]:
    return {p["id"]: p for p in catalog()}


def product(pid: str) -> dict | None:
    return _catalog_index().get(pid)


_dietary_override: dict | None = None


def set_dietary(d: dict) -> None:
    """Runtime override for the active user's dietary profile (from the Profile screen)."""
    global _dietary_override
    prefs = d.get("preferences", [])
    label = ", ".join(p.capitalize() for p in prefs) if prefs else "No diet restriction"
    _dietary_override = {**d, "preferences_label": label}


def active_user() -> dict:
    p = personas()
    uid = p["active_user"]
    u = next(x for x in p["users"] if x["id"] == uid)
    if _dietary_override is not None:
        u = {**u, "dietary": {**u.get("dietary", {}), **_dietary_override}}
    return u


def now() -> datetime:
    return datetime.fromisoformat(settings()["demo_now"])


# ---- dietary / allergen flagging ------------------------------------------

def decorate(p: dict, user: dict | None = None) -> dict:
    """Return a copy of product p with dietary warnings for the given user."""
    if p is None:
        return None
    user = user or active_user()
    diet = user.get("dietary", {})
    out = dict(p)
    warnings: list[str] = []
    allergens = set(diet.get("allergens", []))
    hit = allergens & set(p.get("allergen_tags", []))
    if hit:
        warnings.append("Contains " + ", ".join(sorted(hit)))
    prefs = diet.get("preferences", [])
    if "vegetarian" in prefs and "vegetarian" not in p.get("dietary_tags", []) \
            and p.get("category") == "meat_seafood":
        warnings.append("Not vegetarian")
    if "vegan" in prefs and "vegan" not in p.get("dietary_tags", []):
        warnings.append("Not vegan")
    out["warnings"] = warnings
    out["allergen_conflict"] = bool(hit)
    return out


def search(q: str = "", category: str = "", limit: int = 40) -> list[dict]:
    q = (q or "").strip().lower()
    cat = (category or "").strip()
    rows = catalog()
    if cat:
        rows = [p for p in rows if p["category"] == cat]
    if q:
        toks = q.split()
        scored = []
        for p in rows:
            hay = f"{p['name']} {p['brand']} {p['category']} {p.get('match_key','')}".lower()
            score = sum(1 for t in toks if t in hay)
            # prefer name-start matches
            if p["name"].lower().startswith(q):
                score += 3
            if score:
                scored.append((score, p))
        scored.sort(key=lambda x: (-x[0], -x[1]["rating"]))
        rows = [p for _, p in scored]
    else:
        rows = sorted(rows, key=lambda p: -p["rating"])
    return [decorate(p) for p in rows[:limit]]


CATEGORIES = [
    ("fresh_produce", "Fresh", "🥬"),
    ("dairy_eggs", "Dairy & Eggs", "🥚"),
    ("bakery", "Bakery", "🍞"),
    ("staples_grocery", "Staples", "🌾"),
    ("meat_seafood", "Meat & Fish", "🍗"),
    ("beverages", "Beverages", "🥤"),
    ("snacks", "Snacks", "🍫"),
    ("frozen", "Frozen", "🧊"),
    ("medicine_health", "Pharmacy", "💊"),
    ("personal_care", "Personal Care", "🧴"),
    ("household_cleaning", "Household", "🧽"),
    ("baby_care", "Baby", "🍼"),
]
