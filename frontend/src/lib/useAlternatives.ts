"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Product } from "./types";

/**
 * Fetches the single cheapest alternative for each product ID via a batch API call.
 * Returns a Map of original pid → alternative Product (only entries with a cheaper alt).
 */
export function useAlternatives(pids: string[]) {
  const [alternatives, setAlternatives] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const valid = [...new Set(pids)].filter(Boolean);
    if (valid.length === 0) return;

    setLoading(true);
    api.batchAlternatives(valid)
      .then((res) => {
        const map = new Map<string, Product>();
        for (const [pid, alt] of Object.entries(res.alternatives)) {
          if (alt) map.set(pid, alt);
        }
        setAlternatives(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pids.join(",")]);

  return { alternatives, loading };
}
