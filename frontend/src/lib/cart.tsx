"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "./types";

export type CartItem = { product: Product; qty: number };

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  qtyOf: (id: string) => number;
  add: (p: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  addMany: (ps: { product: Product; qty?: number }[], replace?: boolean) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "amzn-now-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const value = useMemo<CartCtx>(() => {
    const qtyOf = (id: string) => items.find((i) => i.product.id === id)?.qty ?? 0;
    const add: CartCtx["add"] = (p, qty = 1) =>
      setItems((cur) => {
        const ex = cur.find((i) => i.product.id === p.id);
        if (ex) return cur.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + qty } : i));
        return [...cur, { product: p, qty }];
      });
    const setQty: CartCtx["setQty"] = (id, qty) =>
      setItems((cur) =>
        qty <= 0
          ? cur.filter((i) => i.product.id !== id)
          : cur.map((i) => (i.product.id === id ? { ...i, qty } : i)),
      );
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
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.product.price * i.qty, 0),
      qtyOf,
      add,
      setQty,
      addMany,
      clear: () => setItems([]),
    };
  }, [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}
