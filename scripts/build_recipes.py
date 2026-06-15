#!/usr/bin/env python3
"""
Build recipes (real dishes) from TheMealDB and grow the catalog's long tail.

- Searches a big candidate list, keeps the first ~22 that resolve with an image
  and ingredients (retries to ride out rate limits).
- Downloads each dish photo to frontend/public/recipes/.
- Maps every recipe ingredient to a catalog product; unmatched ingredients
  become new long-tail catalog products with their real MealDB thumbnail.
- Pads the catalog toward ~300 products using extra MealDB ingredients (real
  images) so search feels like a real store.
- Auto-derives dietary tags (veg / vegan) from the ingredient set.
- Parses leading quantities so servings scaling is real.

Run:  uv run scripts/build_recipes.py   (after build_catalog.py)
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(ROOT, "config")
PROD_IMG = os.path.join(ROOT, "frontend", "public", "products")
RECIPE_IMG = os.path.join(ROOT, "frontend", "public", "recipes")
INGR = "https://www.themealdb.com/images/ingredients/{}-Medium.png"
SEARCH = "https://www.themealdb.com/api/json/v1/1/search.php?s={}"
LIST_INGR = "https://www.themealdb.com/api/json/v1/1/list.php?i=list"
UA = {"User-Agent": "Mozilla/5.0 (AmazonNow demo data builder)"}

os.makedirs(RECIPE_IMG, exist_ok=True)

# Indian first (prioritised), then popular global. Builder keeps the valid ones.
CANDIDATES = [
    "Biryani", "Rogan Josh", "Madras", "Korma", "Dal", "Tikka Masala", "Tandoori",
    "Saag", "Jalfrezi", "Bhuna", "Chana", "Vindaloo", "Pad Thai", "Katsu",
    "Massaman", "Char Siu", "Carbonara", "Lasagne", "Risotto", "Margherita",
    "Bolognese", "Ratatouille", "Macaroni", "Hamburger", "Fish pie", "Falafel",
    "Shakshuka", "Omelette", "Pancakes", "Pizza", "Sushi", "Paella", "Gnocchi",
    "Wonton", "Dumplings", "Stew", "Soup", "Salad", "Curry",
]
TARGET_RECIPES = 22
TARGET_CATALOG = 300

MEAT = {"chicken", "beef", "pork", "lamb", "mutton", "bacon", "ham", "prawn",
        "shrimp", "fish", "salmon", "tuna", "anchov", "duck", "sausage", "meat",
        "gelatin", "chorizo", "turkey", "doner", "mince"}
DAIRY = {"milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "paneer",
         "ghee", "mascarpone", "parmesan", "mozzarella"}
EGG = {"egg"}


def fetch(url, timeout=20, retries=4):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), r.status
        except Exception as e:
            last = e
            time.sleep(0.6 * (i + 1))
    return None, 0


def get_json(url):
    data, status = fetch(url)
    if status == 200 and data:
        try:
            return json.loads(data)
        except Exception:
            return None
    return None


def download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1500:
        return True
    data, status = fetch(url)
    if status == 200 and data and len(data) > 1500:
        with open(dest, "wb") as f:
            f.write(data)
        return True
    return False


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "item"


FRACT = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.33, "⅔": 0.67, "⅛": 0.125}


def parse_qty(measure):
    """Return (qty: float|None, unit: str)."""
    m = (measure or "").strip()
    if not m:
        return None, ""
    for sym, val in FRACT.items():
        m = m.replace(sym, f" {val}")
    m = m.strip()
    # mixed number "1 1/2"
    mix = re.match(r"^(\d+)\s+(\d+)\s*/\s*(\d+)\s*(.*)$", m)
    if mix:
        q = int(mix.group(1)) + int(mix.group(2)) / int(mix.group(3))
        return round(q, 3), mix.group(4).strip()
    frac = re.match(r"^(\d+)\s*/\s*(\d+)\s*(.*)$", m)
    if frac:
        return round(int(frac.group(1)) / int(frac.group(2)), 3), frac.group(3).strip()
    num = re.match(r"^(\d+(?:\.\d+)?)\s*(.*)$", m)
    if num:
        return float(num.group(1)), num.group(2).strip()
    return None, m


def det_price(key):
    return 20 + (abs(hash(key)) % 36) * 5  # 20..195, step 5


def guess_category(name):
    n = name.lower()
    if any(w in n for w in MEAT):
        return "meat_seafood"
    if any(w in n for w in DAIRY) or "egg" in n:
        return "dairy_eggs"
    if any(w in n for w in ("tomato", "onion", "pepper", "spinach", "carrot",
                            "garlic", "ginger", "lemon", "lime", "potato", "chilli",
                            "coriander", "basil", "parsley", "mushroom", "lettuce",
                            "cucumber", "apple", "banana", "leek", "celery", "herb")):
        return "fresh_produce"
    return "staples_grocery"


def main():
    catalog = json.load(open(os.path.join(CONFIG_DIR, "catalog.json")))["products"]
    by_id = {p["id"]: p for p in catalog}
    # match index: match_key -> product, plus name tokens
    match_index = {}
    for p in catalog:
        if p.get("match_key"):
            match_index.setdefault(p["match_key"], p)

    def find_product(ingredient):
        key = ingredient.strip().lower()
        if key in match_index:
            return match_index[key]
        # singular/plural and substring against existing match keys
        for mk, p in match_index.items():
            if mk and (mk in key or key in mk):
                return p
        return None

    def ensure_product(ingredient):
        p = find_product(ingredient)
        if p:
            return p["id"]
        # create long-tail product from the ingredient
        pid = slugify(ingredient)
        if pid in by_id:
            return pid
        dest = os.path.join(PROD_IMG, f"{pid}.png")
        ok = download(INGR.format(urllib.parse.quote(ingredient)), dest)
        prod = {
            "id": pid,
            "name": ingredient.title(),
            "brand": "Fresho",
            "price": det_price(pid),
            "size": "1 unit",
            "category": guess_category(ingredient),
            "image": f"/products/{pid}.png" if ok else "",
            "match_key": ingredient.lower(),
            "dietary_tags": [],
            "allergen_tags": [],
            "rating": 4.0 + (abs(hash(pid)) % 9) / 10,
            "rating_count": 50 + (abs(hash(pid)) % 2000),
            "description": f"Fresh {ingredient.lower()}.",
        }
        catalog.append(prod)
        by_id[pid] = prod
        match_index.setdefault(ingredient.lower(), prod)
        return pid

    recipes = []
    seen_ids = set()
    for term in CANDIDATES:
        if len(recipes) >= TARGET_RECIPES:
            break
        data = get_json(SEARCH.format(urllib.parse.quote(term)))
        meals = (data or {}).get("meals") or []
        if not meals:
            print(f"  skip (no hits): {term}")
            continue
        meal = meals[0]
        mid = meal["idMeal"]
        if mid in seen_ids:
            continue
        thumb = meal.get("strMealThumb")
        if not thumb:
            continue
        rid = slugify(meal["strMeal"])
        if not download(thumb, os.path.join(RECIPE_IMG, f"{rid}.jpg")):
            print(f"  skip (no image): {meal['strMeal']}")
            continue

        ings = []
        has_meat = has_dairy = has_egg = False
        for i in range(1, 21):
            ing = (meal.get(f"strIngredient{i}") or "").strip()
            meas = (meal.get(f"strMeasure{i}") or "").strip()
            if not ing:
                continue
            low = ing.lower()
            if any(w in low for w in MEAT):
                has_meat = True
            if any(w in low for w in DAIRY):
                has_dairy = True
            if any(w in low for w in EGG):
                has_egg = True
            qty, unit = parse_qty(meas)
            pid = ensure_product(ing)
            ings.append({
                "product_id": pid,
                "name": by_id[pid]["name"],
                "qty": qty,
                "unit": unit,
                "measure": meas,
                "image": by_id[pid]["image"],
                "price": by_id[pid]["price"],
            })
        if len(ings) < 4:
            continue

        diet = []
        if not has_meat and not has_egg:
            diet.append("vegetarian")
            if not has_dairy:
                diet.append("vegan")
        elif not has_meat:
            diet.append("vegetarian" if False else "eggetarian")

        steps = [s.strip() for s in re.split(r"(?:\r?\n)+|(?<=[.])\s{1,}",
                 meal.get("strInstructions", "")) if len(s.strip()) > 12][:14]

        recipes.append({
            "id": rid,
            "name": meal["strMeal"],
            "cuisine": meal.get("strArea", "World"),
            "category": meal.get("strCategory", ""),
            "image": f"/recipes/{rid}.jpg",
            "base_servings": 2,
            "time_min": min(15 + 4 * len(ings), 75),
            "dietary_tags": diet,
            "ingredient_count": len(ings),
            "ingredients": ings,
            "steps": steps,
        })
        seen_ids.add(mid)
        print(f"  + {meal['strMeal']} ({meal.get('strArea','?')}) — {len(ings)} ingredients, diet={diet}")
        time.sleep(0.25)

    # pad catalog toward TARGET with extra real ingredients
    if len(catalog) < TARGET_CATALOG:
        data = get_json(LIST_INGR)
        alling = [m["strIngredient"] for m in (data or {}).get("meals", [])] if data else []
        for ing in alling:
            if len(catalog) >= TARGET_CATALOG:
                break
            ensure_product(ing)
        time.sleep(0)

    json.dump({"products": catalog}, open(os.path.join(CONFIG_DIR, "catalog.json"), "w"),
              indent=2, ensure_ascii=False)
    json.dump({"recipes": recipes}, open(os.path.join(CONFIG_DIR, "recipes.json"), "w"),
              indent=2, ensure_ascii=False)
    print(f"\nrecipes: {len(recipes)} | catalog now: {len(catalog)} products")


if __name__ == "__main__":
    main()
