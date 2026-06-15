"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Refrigerator,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { rupee } from "@/lib/format";
import type { NowCast as NowCastT, NowCastGroup } from "@/lib/types";

const SIGNAL_ICON = { calendar: Calendar, fridge: Refrigerator, history: RefreshCw } as const;
const SIGNAL_COLOR = {
  calendar: "text-amzn-purple bg-amzn-purple/10",
  fridge: "text-sky-600 bg-sky-100",
  history: "text-amber-600 bg-amber-100",
} as const;
const CTA = { calendar: "Prepare cart", fridge: "Add what's low", history: "Top up supplies" } as const;

export default function NowCast() {
  const [data, setData] = useState<NowCastT | null>(null);

  useEffect(() => {
    api.nowcast().then(setData).catch(() => {});
  }, []);

  if (!data) return <NowCastSkeleton />;

  return (
    <section className="px-3">
      {/* hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-br from-amzn-dark to-amzn-blue2 text-white p-4"
      >
        <div className="flex items-center gap-1.5 text-amzn-yellow text-[11px] font-bold tracking-wide uppercase">
          <Sparkles size={13} /> NowCast
        </div>
        <h1 className="text-[21px] font-bold leading-tight mt-1">3 things we lined up for you</h1>
        <p className="text-[13px] text-white/70 mt-1">
          From your calendar, fridge and habits. Tap any one to build your cart.
        </p>
      </motion.div>

      {/* signal cards */}
      <div className="mt-3 space-y-2.5">
        {data.groups.map((g, i) => (
          <SignalCard key={g.signal} group={g} event={g.signal === "calendar" ? data.event : null} index={i} />
        ))}
      </div>

      <p className="text-center text-[11px] text-ink2 mt-3">
        Delivered in {data.eta_min} min from {data.store}
      </p>
    </section>
  );
}

function SignalCard({
  group,
  event,
  index,
}: {
  group: NowCastGroup;
  event: NowCastT["event"];
  index: number;
}) {
  const { addMany } = useCart();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const Icon = SIGNAL_ICON[group.signal];
  const included = group.items.filter((l) => !excluded.has(l.product.id));
  const count = included.reduce((s, l) => s + l.qty, 0);
  const total = included.reduce((s, l) => s + l.line_total, 0);

  const subtitle = added
    ? `Added ${count} item${count > 1 ? "s" : ""} to cart`
    : event
      ? `${event.when_label} · ${event.guests} guests · ${group.items.length} items`
      : `${group.items.length} items · ${group.blurb}`;

  const toggle = (id: string) =>
    setExcluded((cur) => {
      const n = new Set(cur);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addToCart = () => {
    addMany(included.map((l) => ({ product: l.product, qty: l.qty })));
    setAdded(true);
    setOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08 }}
      className={`rounded-3xl border bg-white shadow-card overflow-hidden ${
        added ? "border-amzn-green/40" : "border-line"
      }`}
    >
      {/* header */}
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <span className={`h-11 w-11 rounded-2xl grid place-items-center shrink-0 ${SIGNAL_COLOR[group.signal]}`}>
          <Icon size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold leading-tight">{group.title}</p>
          <p className={`text-[11.5px] mt-0.5 flex items-center gap-1 ${added ? "text-amzn-green font-semibold" : "text-ink2"}`}>
            {added && <Check size={12} />}
            {subtitle}
          </p>
        </div>
        {added ? (
          <span className="h-8 w-8 rounded-full bg-amzn-greenlite grid place-items-center shrink-0">
            <Check size={17} className="text-amzn-green" strokeWidth={3} />
          </span>
        ) : (
          <span className="flex items-center gap-1 bg-amzn-yellow2 text-amzn-dark text-[12px] font-bold px-3 py-2 rounded-xl shrink-0">
            {CTA[group.signal]}
            <ChevronRight size={14} className={`transition ${open ? "rotate-90" : ""}`} />
          </span>
        )}
      </button>

      {/* expandable body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">
              <div className="border-t border-line divide-y divide-line/70">
                {group.items.map((l) => {
                  const off = excluded.has(l.product.id);
                  return (
                    <div key={l.product.id} className="flex items-center gap-2.5 py-2">
                      <button
                        onClick={() => toggle(l.product.id)}
                        disabled={added}
                        className={`h-5 w-5 rounded-md border-2 grid place-items-center shrink-0 ${
                          off ? "border-line bg-white" : "border-amzn-green bg-amzn-green"
                        }`}
                      >
                        {!off && <Check size={13} className="text-white" strokeWidth={3} />}
                      </button>
                      <div className={`h-10 w-10 rounded-lg bg-paper grid place-items-center shrink-0 overflow-hidden ${off ? "opacity-40" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.product.image} alt="" className="h-[85%] w-[85%] object-contain" />
                      </div>
                      <div className={`flex-1 min-w-0 ${off ? "opacity-40" : ""}`}>
                        <p className="text-[12.5px] font-semibold leading-tight truncate">
                          {l.product.name}
                          {l.qty > 1 && <span className="text-ink2 font-medium"> ×{l.qty}</span>}
                        </p>
                        <p className="text-[11px] text-ink2 truncate">{l.reason}</p>
                      </div>
                      <span className={`text-[12.5px] font-bold shrink-0 ${off ? "opacity-40 line-through" : ""}`}>
                        {rupee(l.line_total)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {!added && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={addToCart}
                  disabled={count === 0}
                  className="mt-3 w-full rounded-xl bg-amzn-green text-white font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Add {count} item{count > 1 ? "s" : ""} to cart · {rupee(total)}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NowCastSkeleton() {
  return (
    <section className="px-3">
      <div className="rounded-3xl bg-gradient-to-br from-amzn-dark to-amzn-blue2 p-4 h-28 shimmer" />
      <div className="mt-3 space-y-2.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-line bg-white p-3.5 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-paper shimmer" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 bg-paper rounded shimmer" />
              <div className="h-2.5 w-1/2 bg-paper rounded shimmer" />
            </div>
            <div className="h-9 w-24 bg-paper rounded-xl shimmer" />
          </div>
        ))}
      </div>
    </section>
  );
}
