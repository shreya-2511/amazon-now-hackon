"use client";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, Package, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { rupee } from "@/lib/format";
import type { PastOrder } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]} ${y}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const { addMany } = useCart();
  const [orders, setOrders] = useState<PastOrder[]>([]);

  useEffect(() => {
    api.orders().then((d) => setOrders(d.orders)).catch(() => {});
  }, []);

  const reorder = (o: PastOrder) => {
    addMany(o.items.map((i) => ({ product: i.product, qty: i.qty })));
    router.push("/checkout?src=reorder");
  };

  return (
    <div className="flex flex-col h-full">
      <header className="bg-amzn-dark text-white px-3 pt-2 pb-3 shrink-0 flex items-center gap-2">
        <button onClick={() => router.push("/profile")} className="p-1">
          <ChevronLeft size={22} />
        </button>
        <div>
          <p className="font-bold flex items-center gap-1.5">
            <Package size={16} className="text-amzn-yellow" /> Your orders
          </p>
          <p className="text-[11px] text-white/60">Reorder your usuals in one tap</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-3 pb-28">
        {orders.length === 0 && <p className="text-center text-ink2 text-[13px] mt-10">No past orders yet.</p>}
        {orders.map((o, idx) => (
          <motion.div
            key={o.order_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-2xl border border-line shadow-card p-3.5 mb-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold">#{o.order_id}</p>
                <p className="text-[11px] text-ink2 flex items-center gap-1">
                  <Clock size={11} /> {dateLabel(o.date)}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-amzn-green bg-amzn-greenlite px-2 py-0.5 rounded-full">
                {o.status}
              </span>
            </div>

            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
              {o.items.map((l) => (
                <div key={l.product.id} className="h-12 w-12 rounded-lg bg-paper grid place-items-center overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.product.image} alt={l.product.name} className="h-[85%] w-[85%] object-contain" />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <p className="text-[12px] text-ink2">
                {o.item_count} items · <b className="text-ink">{rupee(o.total)}</b>
              </p>
              <button
                onClick={() => reorder(o)}
                className="flex items-center gap-1.5 bg-amzn-yellow2 text-amzn-dark font-bold text-[12px] px-3.5 py-2 rounded-xl active:scale-95 transition"
              >
                <RotateCcw size={14} /> Reorder
              </button>
            </div>
          </motion.div>
        ))}
      </main>
    </div>
  );
}
