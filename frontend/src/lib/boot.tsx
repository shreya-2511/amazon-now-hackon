"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { Bootstrap } from "./types";

const Ctx = createContext<Bootstrap | null>(null);

export function BootProvider({ children }: { children: React.ReactNode }) {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  useEffect(() => {
    api.bootstrap().then(setBoot).catch(() => {});
  }, []);
  return <Ctx.Provider value={boot}>{children}</Ctx.Provider>;
}

export function useBoot() {
  return useContext(Ctx);
}
