"use client";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, Minus, Plus, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VegMark from "@/components/VegMark";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { rupee } from "@/lib/format";
import type { Recipe } from "@/lib/types";

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addMany } = useCart();
  const [servings, setServings] = useState(4);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    api.recipe(id, servings).then(setRecipe).catch(() => {});
  }, [id, servings]);

  const addAll = () => {
    if (!recipe) return;
    addMany(
      recipe.ingredients.filter((i) => i.product).map((i) => ({ product: i.product!, qty: 1 })),
    );
    router.push("/checkout?src=recipe");
  };

  if (!recipe) return <div className="flex-1 grid place-items-center text-ink2">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
        {/* hero */}
        <div className="relative h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recipe.image} alt={recipe.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
          <button onClick={() => router.back()} className="absolute top-3 left-3 h-9 w-9 rounded-full bg-black/40 text-white grid place-items-center">
            <ChevronLeft size={20} />
          </button>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <p className="text-[20px] font-extrabold leading-tight">{recipe.name}</p>
            <p className="text-[12px] flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock size={12} /> {recipe.time_min} min
              </span>
              · {recipe.cuisine} · {recipe.ingredient_count} ingredients
            </p>
          </div>
        </div>

        {/* servings */}
        <div className="bg-white mx-3 mt-3 rounded-2xl border border-line p-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[14px] font-semibold">
            <Users size={18} className="text-amzn-orange" /> Servings
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="h-8 w-8 rounded-lg bg-paper grid place-items-center text-amzn-green"
            >
              <Minus size={16} />
            </button>
            <motion.span key={servings} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="w-6 text-center text-[17px] font-bold">
              {servings}
            </motion.span>
            <button
              onClick={() => setServings((s) => Math.min(12, s + 1))}
              className="h-8 w-8 rounded-lg bg-paper grid place-items-center text-amzn-green"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* ingredients */}
        <div className="bg-white mx-3 mt-3 rounded-2xl border border-line px-3">
          <p className="text-[13px] font-bold pt-3">Ingredients · scaled for {servings}</p>
          <div className="divide-y divide-line/70">
            {recipe.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className="h-11 w-11 rounded-lg bg-paper grid place-items-center overflow-hidden shrink-0">
                  {ing.product?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ing.product.image} alt="" className="h-[85%] w-[85%] object-contain" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {ing.product && <VegMark product={ing.product} size={12} />}
                    <p className="text-[13px] font-semibold truncate">{ing.name}</p>
                  </div>
                  <p className="text-[11px] text-ink2">{ing.display_qty}</p>
                </div>
                <span className="text-[12px] font-bold shrink-0">{rupee(ing.price)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* steps */}
        {recipe.steps.length > 0 && (
          <div className="bg-white mx-3 mt-3 rounded-2xl border border-line p-4">
            <p className="text-[13px] font-bold mb-2">Method</p>
            <ol className="space-y-2">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed">
                  <span className="h-5 w-5 rounded-full bg-amzn-greenlite text-amzn-green text-[11px] font-bold grid place-items-center shrink-0">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="absolute bottom-16 inset-x-0 z-20 bg-white border-t border-line p-3">
        <button
          onClick={addAll}
          className="w-full rounded-2xl bg-amzn-yellow2 text-amzn-dark font-bold py-3.5 flex items-center justify-center gap-2"
        >
          Add all ingredients · {rupee(recipe.total)}
        </button>
      </div>
    </div>
  );
}
