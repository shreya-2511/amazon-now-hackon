"""Core demo logic: NowCast prediction, recipe scaling, NowSpeak intent, NowSOS."""
from __future__ import annotations

import re

from . import data


# --------------------------------------------------------------------------
# NowCast — fuse fridge + history + calendar into one explainable cart.
# The signals are config; the fusion logic is real (and extensible to live data).
# --------------------------------------------------------------------------

def _fridge_signals() -> list[dict]:
    out = []
    for it in data.fridge()["items"]:
        if it["status"] == "out":
            reason = "You're out" + (f" — {it['note']}" if it.get("note") else "")
        elif it["status"] == "low":
            reason = "Running low" + (f" — {it['note']}" if it.get("note") else "")
        else:
            continue
        out.append({"product_id": it["product_id"], "qty": 1,
                    "reason": reason, "signal": "fridge"})
    return out


def _history_signals() -> list[dict]:
    ratio = data.settings()["reorder_due_ratio"]
    out = []
    for c in data.history()["cadence"]:
        due_at = c["avg_interval_days"] * ratio
        if c["last_ordered_days_ago"] >= due_at:
            out.append({
                "product_id": c["product_id"], "qty": 1,
                "reason": f"Reorder due — every {c['avg_interval_days']} days, "
                          f"last {c['last_ordered_days_ago']} days ago",
                "signal": "history",
            })
    return out


def _hero_event() -> dict | None:
    return next((e for e in data.calendar()["events"] if e.get("is_hero")), None)


def _calendar_signals() -> list[dict]:
    ev = _hero_event()
    if not ev:
        return []
    return [{"product_id": n["product_id"], "qty": n.get("qty", 1),
             "reason": n["reason"], "signal": "calendar"} for n in ev.get("needs", [])]


_SIGNAL_META = {
    "calendar": {"title": "For tonight's dinner party", "icon": "calendar",
                 "blurb": "From your calendar"},
    "fridge": {"title": "Running low at home", "icon": "fridge",
               "blurb": "Your smart fridge"},
    "history": {"title": "Time to reorder", "icon": "repeat",
                "blurb": "From your habits"},
}
_ORDER = ["calendar", "fridge", "history"]


def nowcast() -> dict:
    user = data.active_user()
    raw = _calendar_signals() + _fridge_signals() + _history_signals()

    # merge by product, keep the highest-priority signal but collect all reasons
    merged: dict[str, dict] = {}
    for s in raw:
        pid = s["product_id"]
        if pid not in merged:
            merged[pid] = {**s, "reasons": [s["reason"]], "signals": [s["signal"]]}
        else:
            m = merged[pid]
            m["qty"] = max(m["qty"], s["qty"])
            if s["reason"] not in m["reasons"]:
                m["reasons"].append(s["reason"])
            if s["signal"] not in m["signals"]:
                m["signals"].append(s["signal"])
            # promote to highest-priority signal for grouping
            if _ORDER.index(s["signal"]) < _ORDER.index(m["signal"]):
                m["signal"] = s["signal"]

    groups: dict[str, list] = {k: [] for k in _ORDER}
    total = 0
    count = 0
    for m in merged.values():
        p = data.product(m["product_id"])
        if not p:
            continue
        item = data.decorate(p, user)
        line = {
            "product": item,
            "qty": m["qty"],
            "reason": m["reasons"][0],
            "reasons": m["reasons"],
            "signals": m["signals"],
            "line_total": p["price"] * m["qty"],
        }
        groups[m["signal"]].append(line)
        total += line["line_total"]
        count += m["qty"]

    out_groups = []
    for sig in _ORDER:
        items = groups[sig]
        if not items:
            continue
        items.sort(key=lambda x: -x["line_total"])
        out_groups.append({"signal": sig, **_SIGNAL_META[sig],
                           "subtotal": sum(i["line_total"] for i in items),
                           "items": items})

    ev = _hero_event()
    st = data.settings()
    hour = data.now().hour
    part = "morning" if hour < 12 else "afternoon" if hour < 17 else "evening"
    return {
        "greeting": f"Good {part}, {user['first_name']}",
        "headline": "Your cart's ready before you asked",
        "subtext": "Built from your fridge, your habits and your calendar.",
        "event": ev,
        "fridge_sync": data.fridge()["updated_label"],
        "groups": out_groups,
        "item_count": count,
        "total": total,
        "eta_min": st["eta_default_min"],
        "store": st["dark_store"],
    }


# --------------------------------------------------------------------------
# Recipes — real proportional scaling
# --------------------------------------------------------------------------

def _scale_qty(qty, factor):
    if qty is None:
        return None
    v = qty * factor
    return int(v) if abs(v - round(v)) < 1e-6 else round(v, 2)


def recipe_scaled(rid: str, servings: int) -> dict | None:
    r = next((x for x in data.recipes() if x["id"] == rid), None)
    if not r:
        return None
    base = r.get("base_servings", 2) or 2
    factor = servings / base
    user = data.active_user()
    ings = []
    total = 0
    for ing in r["ingredients"]:
        p = data.product(ing["product_id"])
        sq = _scale_qty(ing.get("qty"), factor)
        disp = f"{sq:g} {ing['unit']}".strip() if sq is not None else ing.get("measure", "")
        dec = data.decorate(p, user) if p else None
        price = p["price"] if p else ing.get("price", 0)
        ings.append({
            "product": dec,
            "name": ing["name"],
            "display_qty": disp,
            "base_measure": ing.get("measure", ""),
            "price": price,
        })
        total += price
    return {**{k: r[k] for k in ("id", "name", "cuisine", "category", "image",
                                  "time_min", "dietary_tags", "steps")},
            "base_servings": base, "servings": servings,
            "ingredients": ings, "ingredient_count": len(ings), "total": total}


def recipe_list() -> list[dict]:
    return [{"id": r["id"], "name": r["name"], "cuisine": r["cuisine"],
             "category": r.get("category", ""), "image": r["image"],
             "time_min": r["time_min"], "dietary_tags": r["dietary_tags"],
             "ingredient_count": r["ingredient_count"]} for r in data.recipes()]


# --------------------------------------------------------------------------
# NowSpeak — match scripted intent, else fall back to catalog search
# --------------------------------------------------------------------------

_URL_RE = re.compile(r"https?://\S+")
_STOP = {"the", "and", "for", "with", "recipe", "how", "make", "cook", "want",
         "need", "tonight", "please", "some", "what", "can", "get", "buy",
         "https", "http", "www", "com", "meal", "recipes"}


def speak_resolve(query: str) -> dict:
    raw = query or ""
    q = raw.lower().strip()
    sc = data.scenarios()["nowspeak"]

    # 1) a recipe link / URL — "fetch" the dish and pull every ingredient.
    #    (before keyword intents: a URL/list is an explicit structured input.)
    url = _URL_RE.search(raw)
    if url:
        rec = _match_recipe(url.group(0))
        if rec:
            return _recipe_speak(rec, 4, f"Pulled “{rec['name']}” from that link — "
                                 f"here's every ingredient, ready to add.",
                                 f"From your link · serves 4")

    # 2) a pasted list — resolve each item to a product
    if "," in raw or "\n" in raw:
        items = _split_list(raw)
        if len(items) >= 2:
            user = data.active_user()
            prods, seen = [], set()
            for term in items:
                p = _best_match(term)
                if p and p["id"] not in seen:
                    seen.add(p["id"])
                    prods.append(data.decorate(p, user))
            if prods:
                return {
                    "reply": f"Got your list — found {len(prods)} of {len(items)} items. "
                             "Tap add and they're on the way.",
                    "products": prods, "recipe": None,
                    "note": f"{len(prods)} items from your list",
                    "total": sum(p["price"] for p in prods),
                }

    # 3) scripted intents — crisp demo lines (carbonara, vegan guest, etc.)
    for intent in sc["intents"]:
        if any(m in q for m in intent["match"]):
            return _speak_payload(intent)

    # 4) free-form "what to cook" — match a dish by name
    rec = _match_recipe(q)
    if rec:
        return _recipe_speak(rec, 4, f"{rec['name']} it is — I scaled it for 4 and "
                             "pulled the full ingredient list.", "Serves 4 · tap to add")

    # 5) fallback: search the catalog
    results = data.search(raw, limit=6)
    return {
        "reply": sc["fallback_reply"],
        "products": results, "recipe": None,
        "note": f"{len(results)} matches",
        "total": sum(p["price"] for p in results),
    }


def _speak_payload(intent: dict) -> dict:
    user = data.active_user()
    products = [data.decorate(data.product(pid), user)
                for pid in intent.get("product_ids", []) if data.product(pid)]
    recipe = recipe_scaled(intent["recipe_id"], intent.get("servings", 4)) \
        if intent.get("recipe_id") else None
    return {
        "reply": intent["reply"],
        "products": products,
        "recipe": recipe,
        "dietary_note": intent.get("dietary_note"),
        "note": intent.get("note", ""),
        "total": sum(p["price"] for p in products),
    }


def _recipe_speak(rec: dict, servings: int, reply: str, note: str) -> dict:
    user = data.active_user()
    prods, seen = [], set()
    for ing in rec["ingredients"]:
        p = ing.get("product")
        if p and p["id"] not in seen:
            seen.add(p["id"])
            prods.append(data.decorate(data.product(p["id"]), user))
    return {"reply": reply, "products": prods, "recipe": rec, "note": note,
            "total": sum(p["price"] for p in prods)}


def _split_list(text: str) -> list[str]:
    parts = re.split(r"[,\n;]+|\band\b", text)
    out = []
    for p in parts:
        t = re.sub(r"^\s*\d+\s*(x|pcs|kg|g|ml|l|packs?)?\s*", "", p.strip(), flags=re.I)
        t = t.strip(" .-•*")
        if t:
            out.append(t)
    return out


def _best_match(term: str):
    """Match a single shopping-list item to a product by name/key (not category)."""
    t = term.strip().lower()
    sing = t[:-1] if t.endswith("s") else t
    if len(t) < 2:
        return None
    best, best_key = None, (0, 0.0)
    for p in data.catalog():
        name = p["name"].lower()
        mk = (p.get("match_key") or "").lower()
        words = set(re.split(r"[^a-z]+", name))
        score = 0
        if mk and mk in (t, sing):
            score += 12
        if t in words or sing in words:
            score += 8
        if name.startswith(t):
            score += 4
        elif t in name:
            score += 2
        if mk and (t in mk or sing in mk):
            score += 3
        if score:
            key = (score, p["rating"])
            if key > best_key:
                best, best_key = p, key
    return best


def _match_recipe(text: str):
    toks = {t for t in re.split(r"[^a-z]+", text.lower()) if len(t) > 3 and t not in _STOP}
    best, best_score = None, 0
    for r in data.recipes():
        rtoks = {t for t in re.split(r"[^a-z]+", r["name"].lower()) if len(t) > 3 and t not in _STOP}
        score = len(toks & rtoks)
        if score > best_score:
            best, best_score = r, score
    return recipe_scaled(best["id"], 4) if best else None


# --------------------------------------------------------------------------
# Orders
# --------------------------------------------------------------------------

_ORDERS: dict[str, dict] = {}
_SEQ = [1000]


def create_order(items: list[dict], eta_min: int | None = None) -> dict:
    _SEQ[0] += 1
    oid = f"AN{_SEQ[0]}"
    st = data.settings()
    subtotal = 0
    lines = []
    for it in items:
        p = data.product(it["product_id"])
        if not p:
            continue
        qty = max(1, int(it.get("qty", 1)))
        lines.append({"product": p, "qty": qty, "line_total": p["price"] * qty})
        subtotal += p["price"] * qty
    fee = 0 if subtotal >= st["free_delivery_above"] else st["delivery_fee"]
    eta = eta_min or st["eta_default_min"]
    order = {
        "order_id": oid,
        "items": lines,
        "item_count": sum(l["qty"] for l in lines),
        "subtotal": subtotal,
        "delivery_fee": fee,
        "total": subtotal + fee,
        "eta_min": eta,
        "address": data.active_user().get("address"),
        "store": st["dark_store"],
        "stages": ["Order placed", "Packing at dark store", "Out for delivery", "Arriving now"],
    }
    _ORDERS[oid] = order
    return order


def get_order(oid: str) -> dict | None:
    return _ORDERS.get(oid)
