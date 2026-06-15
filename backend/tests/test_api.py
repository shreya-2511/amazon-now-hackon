"""Endpoint tests — assert every demo-critical contract holds.

Run:  uv run pytest -q   (from backend/)
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health").json()
    assert r["ok"] is True
    assert r["products"] >= 100
    assert r["recipes"] >= 15


def test_bootstrap():
    b = client.get("/api/bootstrap").json()
    assert b["user"]["first_name"] == "Aarav"
    assert b["settings"]["currency"] == "₹"
    assert len(b["categories"]) == 12
    assert "nuts" in b["user"]["dietary"]["allergens"]


def test_nowcast_fuses_three_signals():
    d = client.get("/api/nowcast").json()
    signals = {g["signal"] for g in d["groups"]}
    assert signals == {"calendar", "fridge", "history"}  # all three present
    assert d["item_count"] > 0 and d["total"] > 0
    assert d["event"]["is_hero"] is True
    # every line carries an explainable reason
    for g in d["groups"]:
        for it in g["items"]:
            assert it["reason"]
            assert it["product"]["image"].startswith("/products/")


def test_nowcast_reorder_reason_mentions_cadence():
    d = client.get("/api/nowcast").json()
    hist = next(g for g in d["groups"] if g["signal"] == "history")
    assert any("every" in it["reason"] for it in hist["items"])


def test_recipe_scaling_is_proportional():
    base = client.get("/api/recipe/spaghetti-alla-carbonara?servings=2").json()
    dbl = client.get("/api/recipe/spaghetti-alla-carbonara?servings=4").json()
    assert dbl["servings"] == 4
    # numeric ingredient should roughly double
    bq = next((i for i in base["ingredients"] if i["display_qty"][:1].isdigit()), None)
    assert bq is not None


def test_nowspeak_vegan_intent_is_dietary_aware():
    d = client.get("/api/nowspeak", params={"q": "a guest is vegan"}).json()
    assert d["recipe"]["name"] == "Ratatouille"
    assert "Vegan" in (d.get("dietary_note") or "")
    assert len(d["products"]) > 0


def test_nowspeak_headache_cross_domain():
    d = client.get("/api/nowspeak", params={"q": "headache and out of coffee"}).json()
    ids = {p["id"] for p in d["products"]}
    assert "paracetamol" in ids and "coffee-beans-250g" in ids


def test_nowspeak_fallback_searches_catalog():
    d = client.get("/api/nowspeak", params={"q": "chocolate"}).json()
    assert len(d["products"]) > 0


def test_nowspeak_list_resolves_each_item():
    d = client.get("/api/nowspeak", params={"q": "milk, eggs, bread, coffee, 2 onions"}).json()
    ids = {p["id"] for p in d["products"]}
    assert "farm-eggs-6" in ids
    assert {"amul-milk-500ml", "amul-gold-1l"} & ids
    assert "onion-1kg" in ids
    assert len(d["products"]) >= 4


def test_nowspeak_recipe_link_fetches_ingredients():
    d = client.get("/api/nowspeak", params={"q": "https://www.themealdb.com/meal/lasagne"}).json()
    assert d["recipe"]["name"] == "Lasagne"
    assert len(d["products"]) > 5


def test_nowspeak_cook_dish_by_name():
    d = client.get("/api/nowspeak", params={"q": "i want to cook biryani"}).json()
    assert "Biryani" in d["recipe"]["name"]


def test_allergen_flagging():
    p = client.get("/api/product/cashews-200g").json()
    assert p["allergen_conflict"] is True
    assert any("nuts" in w for w in p["warnings"])


def test_search_and_category():
    assert len(client.get("/api/catalog", params={"q": "milk"}).json()["products"]) > 0
    meds = client.get("/api/catalog", params={"category": "medicine_health"}).json()["products"]
    assert all(p["category"] == "medicine_health" for p in meds)


def test_order_lifecycle():
    r = client.post("/api/order", json={"items": [{"product_id": "amul-milk-500ml", "qty": 2}]}).json()
    assert r["order_id"].startswith("AN")
    assert r["item_count"] == 2
    assert len(r["stages"]) == 4
    got = client.get(f"/api/order/{r['order_id']}").json()
    assert got["order_id"] == r["order_id"]


def test_sse_stream_emits_tokens_and_result():
    with client.stream("GET", "/api/nowspeak/stream", params={"q": "a guest is vegan"}) as s:
        body = "".join(chunk for chunk in s.iter_text())
    assert "event: token" in body
    assert "event: result" in body
    assert "event: done" in body
