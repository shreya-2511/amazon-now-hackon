import type {
  Bootstrap,
  NowCast,
  Order,
  Product,
  Recipe,
  RecipeSummary,
  SpeakResult,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export const api = {
  base: BASE,
  bootstrap: () => get<Bootstrap>("/api/bootstrap"),
  nowcast: () => get<NowCast>("/api/nowcast"),
  catalog: (q = "", category = "", limit = 40) =>
    get<{ products: Product[] }>(
      `/api/catalog?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&limit=${limit}`,
    ),
  recipes: () => get<{ recipes: RecipeSummary[] }>("/api/recipes"),
  recipe: (id: string, servings: number) =>
    get<Recipe>(`/api/recipe/${id}?servings=${servings}`),
  speakStarters: () => get<{ chips: string[] }>("/api/nowspeak/starters"),
  speak: (q: string) => get<SpeakResult>(`/api/nowspeak?q=${encodeURIComponent(q)}`),
  order: (items: { product_id: string; qty: number }[], eta_min?: number) =>
    fetch(`${BASE}/api/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, eta_min }),
    }).then((r) => r.json() as Promise<Order>),
  getOrder: (id: string) => get<Order>(`/api/order/${id}`),
  streamUrl: (q: string) => `${BASE}/api/nowspeak/stream?q=${encodeURIComponent(q)}`,
};

export const img = (path: string) => (path ? `${path}` : "");
