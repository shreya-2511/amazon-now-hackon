"use client";
import { Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function Stepper({
  qty,
  onAdd,
  onInc,
  onDec,
  size = "md",
}: {
  qty: number;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-8" : "h-9";
  const w = size === "sm" ? "w-[70px]" : "w-[84px]";
  const text = size === "sm" ? "text-xs" : "text-sm";

  if (qty <= 0) {
    return (
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onAdd}
        className={`${h} ${w} ${text} rounded-lg border border-amzn-green text-amzn-green
                    font-bold bg-amzn-greenlite active:bg-amzn-green active:text-white`}
      >
        ADD
      </motion.button>
    );
  }
  return (
    <div
      className={`${h} ${w} ${text} rounded-lg bg-amzn-green text-white font-bold
                  flex items-center justify-between px-1.5 select-none`}
    >
      <button onClick={onDec} className="grid place-items-center h-full w-7" aria-label="decrease">
        <Minus size={15} />
      </button>
      <motion.span key={qty} initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
        {qty}
      </motion.span>
      <button onClick={onInc} className="grid place-items-center h-full w-7" aria-label="increase">
        <Plus size={15} />
      </button>
    </div>
  );
}
