"use client";
import { motion } from "framer-motion";
import { Bike, Check, Clock, Home, PackageCheck } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupee } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isSos = useSearchParams().get("sos") === "1";
  const [order, setOrder] = useState<Order | null>(null);
  const [secs, setSecs] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    api.getOrder(id).then((o) => {
      setOrder(o);
      setSecs(o.eta_min * 60);
    });
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!order) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, order.stages.length - 1)), 3500);
    return () => clearInterval(t);
  }, [order]);

  if (!order) return <div className="flex-1 grid place-items-center text-ink2">Loading…</div>;

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const accent = isSos ? "#e11d48" : "#067d62";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* hero confirm */}
        <div className="text-white px-5 pt-8 pb-6 text-center" style={{ background: `linear-gradient(160deg, ${accent}, #0b1016)` }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="mx-auto h-16 w-16 rounded-full bg-white grid place-items-center"
          >
            <Check size={36} style={{ color: accent }} strokeWidth={3} />
          </motion.div>
          <p className="mt-3 text-[15px] font-bold">{isSos ? "Help is on the way" : "Order confirmed!"}</p>
          <p className="text-[12px] text-white/70">#{order.order_id}</p>

          <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 inline-flex items-center gap-2">
            <Clock size={18} className="text-white" />
            <div className="text-left">
              <p className="text-[11px] text-white/70 leading-none">Arriving in</p>
              <p className="text-[22px] font-extrabold leading-tight tabular-nums">
                {mm}:{ss}
              </p>
            </div>
          </div>
        </div>

        {/* tracker */}
        <div className="bg-white mx-3 -mt-3 rounded-2xl border border-line shadow-card p-4 relative z-10">
          {/* rider strip */}
          <div className="relative h-10 mb-4">
            <div className="absolute top-1/2 inset-x-0 h-1 bg-line rounded-full -translate-y-1/2" />
            <motion.div
              className="absolute top-1/2 left-0 h-1 rounded-full -translate-y-1/2"
              style={{ background: accent }}
              initial={{ width: "5%" }}
              animate={{ width: `${5 + (stage / (order.stages.length - 1)) * 90}%` }}
              transition={{ type: "spring", stiffness: 60 }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2"
              initial={{ left: "0%" }}
              animate={{ left: `${(stage / (order.stages.length - 1)) * 90}%` }}
              transition={{ type: "spring", stiffness: 60 }}
            >
              <span className="h-8 w-8 rounded-full grid place-items-center text-white" style={{ background: accent }}>
                <Bike size={17} />
              </span>
            </motion.div>
          </div>

          <div className="space-y-2.5">
            {order.stages.map((s, i) => (
              <div key={s} className="flex items-center gap-2.5">
                <span
                  className={`h-5 w-5 rounded-full grid place-items-center shrink-0 ${
                    i <= stage ? "text-white" : "bg-paper text-line"
                  }`}
                  style={i <= stage ? { background: accent } : {}}
                >
                  {i <= stage ? <Check size={12} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-ink2/40" />}
                </span>
                <span className={`text-[13px] ${i <= stage ? "font-semibold" : "text-ink2"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* items */}
        <div className="bg-white mx-3 mt-3 rounded-2xl border border-line p-4">
          <p className="text-[13px] font-bold flex items-center gap-1.5 mb-1">
            <PackageCheck size={16} /> {order.item_count} items · {rupee(order.total)}
          </p>
          {order.savings ? (
            <p className="text-[12px] text-amzn-green font-semibold mb-2">
              Saved {rupee(order.savings)} with {order.coupon?.code}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {order.items.map((l) => (
              <div key={l.product.id} className="h-12 w-12 rounded-lg bg-paper grid place-items-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.product.image} alt="" className="h-[85%] w-[85%] object-contain" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink2 mt-3">Delivering from {order.store}</p>
        </div>
      </div>

      <div className="absolute bottom-16 inset-x-0 z-20 bg-white border-t border-line p-3">
        <button
          onClick={() => router.push("/")}
          className="w-full rounded-2xl bg-amzn-dark text-white font-bold py-3.5 flex items-center justify-center gap-2"
        >
          <Home size={18} /> Back to home
        </button>
      </div>
    </div>
  );
}
