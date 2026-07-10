"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "./types";
import { api } from "./api";

export type CartItem = { product: Product; qty: number };

type CartCtx = {
  items: CartItem[];
  originalItems: CartItem[]; // always the real cart, unaffected by economy mode
  count: number;
  subtotal: number;
  economyMode: boolean;
  setEconomyMode: (on: boolean) => void;
  qtyOf: (id: string) => number;
  add: (p: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  addMany: (ps: { product: Product; qty?: number }[], replace?: boolean) => void;
  clear: () => void;
  /** Maps alternative product ID → original product ID. Only populated in economy mode. */
  ecoMapping: ReadonlyMap<string, string>;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "amzn-now-cart";
const ECO_KEY = "amzn-now-economy";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [economyMode, setEconomyModeRaw] = useState(false);
  const [ecoItems, setEcoItems] = useState<CartItem[]>([]);
  // Maps alternative product ID → original product ID (only populated in economy mode)
  const [ecoMapping, setEcoMapping] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
      const eco = localStorage.getItem(ECO_KEY);
      if (eco) {
        const { on } = JSON.parse(eco);
        setEconomyModeRaw(!!on);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(ECO_KEY, JSON.stringify({ on: economyMode }));
    } catch {}
  }, [economyMode]);

  // When economy mode turns on, fetch real cheapest alternatives via batch API.
  // Products with no cheaper alternative keep the original.
  useEffect(() => {
    if (!economyMode || items.length === 0) {
      setEcoItems([]);
      setEcoMapping(new Map());
      return;
    }

    const snapshotItems = [...items];
    const productIds = snapshotItems.map((i) => i.product.id);

    api.batchAlternatives(productIds)
      .then((res) => {
        const mapped: CartItem[] = [];
        const mapping = new Map<string, string>();

        for (const item of snapshotItems) {
          const alt = res.alternatives[item.product.id];
          if (alt) {
            mapped.push({ product: alt, qty: item.qty });
            mapping.set(alt.id, item.product.id);
          } else {
            mapped.push({ ...item });
          }
        }

        // Sort: replaced items first
        mapped.sort((a, b) => {
          const aRep = mapping.has(a.product.id) ? 0 : 1;
          const bRep = mapping.has(b.product.id) ? 0 : 1;
          return aRep - bRep;
        });

        setEcoItems(mapped);
        setEcoMapping(mapping);
      })
      .catch(() => {
        // Fallback: keep originals
        setEcoItems([...snapshotItems]);
        setEcoMapping(new Map());
      });
  }, [economyMode, items]);

  const setEconomyMode = (on: boolean) => setEconomyModeRaw(on);

  const activeItems = economyMode ? ecoItems : items;

  const value = useMemo<CartCtx>(() => {
    const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.qty ?? 0;
    const add: CartCtx["add"] = (p, qty = 1) =>
      setItems((cur) => {
        const ex = cur.find((i) => i.product.id === p.id);
        if (ex) return cur.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + qty } : i));
        return [...cur, { product: p, qty }];
      });
    // setQty routes to ecoItems when economy mode is active, otherwise the real cart.
    // In economy mode, syncs both the eco item and the original cart item.
    const setQty: CartCtx["setQty"] = (id, qty) => {
      if (economyMode && ecoItems.length > 0) {
        setEcoItems((cur) =>
          qty <= 0
            ? cur.filter((i) => i.product.id !== id)
            : cur.map((i) => (i.product.id === id ? { ...i, qty } : i)),
        );
        // Sync the original cart item via the reverse mapping
        const originalId = ecoMapping.get(id) ?? id;
        if (qty <= 0) {
          setItems((cur) => cur.filter((i) => i.product.id !== originalId));
        } else {
          setItems((cur) =>
            cur.map((i) => (i.product.id === originalId ? { ...i, qty } : i)),
          );
        }
      } else {
        setItems((cur) =>
          qty <= 0
            ? cur.filter((i) => i.product.id !== id)
            : cur.map((i) => (i.product.id === id ? { ...i, qty } : i)),
        );
      }
    };
    const addMany: CartCtx["addMany"] = (ps, replace = false) =>
      setItems((cur) => {
        const base = replace ? [] : [...cur];
        for (const { product, qty = 1 } of ps) {
          const ex = base.find((i) => i.product.id === product.id);
          if (ex) ex.qty += qty;
          else base.push({ product, qty });
        }
        return [...base];
      });
    return {
      items: activeItems,
      originalItems: items,
      count: activeItems.reduce((s, i) => s + i.qty, 0),
      subtotal: activeItems.reduce((s, i) => s + i.product.price * i.qty, 0),
      economyMode,
      setEconomyMode,
      ecoMapping,
      qtyOf,
      add,
      setQty,
      addMany,
      clear: () => setItems([]),
    };
  }, [activeItems, items, ecoItems, economyMode, ecoMapping]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
