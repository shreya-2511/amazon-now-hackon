# Amazon Now — Reimagining Urgent Shopping

Quick-commerce demo for the Hackon with Amazon hackathon. Thesis: **stop searching — discover, decide and buy in seconds.**

Two hero surfaces, one supporting layer:

- **NowCast** (home) — predicts what you need from three signals (calendar, smart-fridge, purchase habits) and surfaces them as tap-to-build triggers. No search, no browsing.
- **NowSpeak** — describe the situation, paste a shopping list, or drop a recipe link; the agent resolves it to a ready cart. Voice + chat, streamed.
- **Cook** — 22 real dishes with proportional serving-scaling; add every ingredient in one tap.

All demo data is config-driven (`/config/*.json`) so it's swappable and easy to make real later. Product/recipe imagery is real and downloaded locally (sourced from TheMealDB + Unsplash) — nothing depends on the network at record time.

## Stack
- **Backend** — FastAPI (uv), deterministic config-driven engine, SSE streaming. Port 8010.
- **Frontend** — Next.js 16 + Tailwind v4 + framer-motion, mobile phone-frame PWA. Port 3100.

## Run

```bash
# backend
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8010

# frontend (new terminal)
cd frontend && pnpm install && pnpm exec next dev -p 3100
```

Open http://localhost:3100 (best in a narrow window — it renders as a phone).

## Data
```bash
uv run scripts/build_catalog.py   # 100+ hero products + images
uv run scripts/build_recipes.py   # 22 recipes, grows catalog to ~300
```

## Tests
```bash
cd backend && uv run pytest -q            # API contract tests
cd frontend && pnpm exec playwright test  # demo-flow + screenshots
```
