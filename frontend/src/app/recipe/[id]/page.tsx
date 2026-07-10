"use client";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Clock, Minus, Plus, Users ,HandCoins} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VegMark, { AllergenBadge, DietaryTags } from "@/components/VegMark";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { rupee } from "@/lib/format";
import type { Product, Recipe } from "@/lib/types";

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addMany, setQty, add } = useCart();
  const [servings, setServings] = useState(4);
  const [recipeData, setRecipeData] = useState<Recipe | null>(null);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [ingredientAlternatives, setIngredientAlternatives] = useState<Map<string, Product>>(new Map());
  const [selectedAlternatives, setSelectedAlternatives] = useState<Map<string, Product>>(new Map());
  const [alternativesLoading, setAlternativesLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.recipe(id, servings).then(setRecipeData).catch(() => {});
  }, [id, servings]);

  useEffect(() => {
    if (!recipeData) return;

    const fetchAllAlternatives = async () => {
      const newAlternatives = new Map<string, Product>();
      const loadingPids = new Set<string>();

      const promises = recipeData.ingredients.map(async (ing) => {
        if (!ing.product) return;
        const originalProductId = ing.product.id;
        loadingPids.add(originalProductId);
        setAlternativesLoading(new Set(loadingPids));

        try {
          const data = await api.productAlternatives(originalProductId);
          if (data.alternative) {
            newAlternatives.set(originalProductId, data.alternative);
          }
        } catch (error) {
          console.error(`Failed to fetch alternatives for ${originalProductId}:`, error);
        } finally {
          loadingPids.delete(originalProductId);
          setAlternativesLoading(new Set(loadingPids));
        }
      });
      await Promise.all(promises);
      setIngredientAlternatives(newAlternatives);
    };

    fetchAllAlternatives();
  }, [recipeData]);

  const qtyOf = (id: string) => qtyById[id] ?? 1;
  const setLineQty = (id: string, qty: number) => {
    setQtyById((cur) => ({ ...cur, [id]: Math.max(0, Math.min(99, qty)) }));
    // Also update the global cart when the quantity of an ingredient is changed
    const currentProduct = selectedAlternatives.get(id) || recipeData?.ingredients.find(i => i.product?.id === id)?.product;
    if (currentProduct) {
      setQty(currentProduct.id, Math.max(0, Math.min(99, qty)));
    }
  };

  const handleSelectAlternative = (originalProductId: string, selectedAlternative: Product) => {
    setRecipeData((currentRecipe) => {
      if (!currentRecipe) return currentRecipe;
      const updatedIngredients = currentRecipe.ingredients.map((ing) => {
        if (ing.product?.id === originalProductId) {
          // Update the product displayed in the recipe UI
          return { ...ing, product: selectedAlternative, price: selectedAlternative.price };
        }
        return ing;
      });
      return { ...currentRecipe, ingredients: updatedIngredients };
    });

    setSelectedAlternatives((currentMap) => {
      const newMap = new Map(currentMap);
      newMap.set(originalProductId, selectedAlternative);
      return newMap;
    });

    // Update the global cart via useCart hook
    const currentQty = qtyOf(originalProductId); // Get quantity of original product
    if (currentQty > 0) {
      // Remove original product from cart
      setQty(originalProductId, 0);
      // Add selected alternative to cart with same quantity
      setQty(selectedAlternative.id, currentQty);
    } else {
      // If original wasn't in cart, just add the alternative with qty 1
      setQty(selectedAlternative.id, 1);
    }
  };

  const selectedIngredients = recipeData?.ingredients
    .map((ing) => {
      const actualProduct = selectedAlternatives.get(ing.product?.id ?? '') || ing.product;
      const quantity = ing.product ? qtyOf(ing.product.id) : 0;
      return actualProduct ? { product: actualProduct, qty: quantity, price: actualProduct.price } : null;
    })
    .filter((item): item is { product: Product; qty: number; price: number } => item !== null && item.qty > 0) ?? [];

  const selectedCount = selectedIngredients.reduce((sum, i) => sum + i.qty, 0);
  const selectedTotal = selectedIngredients.reduce((sum, i) => sum + i.price * i.qty, 0);

  const addAll = () => {
    if (!recipeData) return;
    addMany(selectedIngredients.map((i) => ({ product: i.product, qty: i.qty })));
    router.push("/checkout?src=recipe");
  };

  if (!recipeData) return <div className="flex-1 grid place-items-center text-ink2">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
        {/* hero */}
        <div className="relative h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recipeData.image} alt={recipeData.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
          <button onClick={() => router.back()} className="absolute top-3 left-3 h-9 w-9 rounded-full bg-black/40 text-white grid place-items-center">
            <ChevronLeft size={20} />
          </button>
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <p className="text-[20px] font-extrabold leading-tight">{recipeData.name}</p>
            <p className="text-[12px] flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1">
                <Clock size={12} /> {recipeData.time_min} min
              </span>
              · {recipeData.cuisine} · {recipeData.ingredient_count} ingredients
            </p>
          </div>
        </div>

        {/* servings */}
        <div className="bg-white mx-3 mt-2.5 rounded-2xl border border-line p-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[14px] font-semibold">
            <Users size={18} className="text-amzn-orange" /> Servings
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="h-6 w-6 rounded-lg bg-paper grid place-items-center text-amzn-green"
            >
              <Minus size={15} />
            </button>
            <motion.span key={servings} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className="w-6 text-center text-[15px] font-bold">
              {servings}
            </motion.span>
            <button
              onClick={() => setServings((s) => Math.min(12, s + 1))}
              className="h-6 w-6 rounded-lg bg-paper grid place-items-center text-amzn-green"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* ingredients */}
        <div className="bg-white mx-3 mt-3 rounded-2xl border border-line px-3">
          <p className="text-[13px] font-bold pt-3">Ingredients · scaled for {servings}</p>
          <div className="divide-y divide-line/70">
            {recipeData.ingredients.map((ing, i) => {
              const id = ing.product?.id ?? `ingredient-${i}`;
              const qty = ing.product ? qtyOf(id) : 0;
              const off = ing.product ? qty <= 0 : false;
              const brand = ing.product?.brand ?? "";
              return (
              <div key={i}>
              <div className="flex items-center gap-2.5 py-2.5">
                {ing.product && (
                  <button
                    onClick={() => setLineQty(id, off ? 1 : 0)}
                    className={`h-4 w-4 rounded-md border-2 grid place-items-center shrink-0 ${
                      off ? "border-line bg-white" : "border-amzn-green bg-amzn-green"
                    }`}
                  >
                    {!off && <Check size={13} className="text-white" strokeWidth={3} />}
                  </button>
                )}
                <div className="h-12 w-12 rounded-lg bg-paper grid place-items-center overflow-hidden shrink-0">
                  {ing.product?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ing.product.image} alt="" className={`h-[85%] w-[85%] object-contain ${off ? "opacity-40" : ""}`} />
                  ) : null}
                </div>
                <div className={`flex-1 min-w-0 ${off ? "opacity-40" : ""}`}>
                  <div className="flex items-center gap-1">
                    {ing.product && <VegMark product={ing.product} size={12} />}
                    <p className="text-[12px] font-semibold truncate text-ink1">{ing.name}</p>
                  </div>
                  <p className="text-[9px] text-ink2">{ing.product?.brand}</p>
                  <p className="text-[10px] text-ink2">{ing.display_qty}</p>
                  {ing.product && <DietaryTags product={ing.product} />}
                  {ing.product && <AllergenBadge product={ing.product} />}
                </div>
                <div className={`shrink-0 flex flex-col items-end gap-1 ${off ? "opacity-50" : ""}`}>
                  <span className={`text-[12px] font-bold ${off ? "line-through" : ""}`}>
                    {rupee(ing.price * Math.max(0, qty || 1))}
                  </span>
                  {ing.product && (
                    <div className="h-6.5 w-[70px] rounded-lg bg-amzn-green text-white text-[12px] font-bold flex items-center justify-between px-1">
                      <button
                        onClick={() => setLineQty(id, qty - 1)}
                        className="grid place-items-center h-full w-6"
                        aria-label={`decrease ${ing.name}`}
                      >
                        -
                      </button>
                      <motion.span key={qty} initial={{ scale: 0.75 }} animate={{ scale: 1 }}>
                        {qty}
                      </motion.span>
                      <button
                        onClick={() => setLineQty(id, qty + 1)}
                        className="grid place-items-center h-full w-6"
                        aria-label={`increase ${ing.name}`}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {ing.product && ingredientAlternatives.has(ing.product.id) && (() => {
                const alt = ingredientAlternatives.get(ing.product.id)!;
                const savings = ing.price - alt.price;
                return (
                  <div className="pl-8 pb-1">
                    <button
                      onClick={() => handleSelectAlternative(ing.product!.id, alt)}
                      className="flex items-center gap-2 p-1.5 rounded-xl border border-line bg-paper hover:border-amzn-green transition-colors w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={alt.image} alt={alt.name} className="h-8 w-8 object-contain shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[10px] font-semibold truncate">{alt.name}</p>
                        <p className="text-[9px] text-ink2">{alt.brand}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <p className="text-[10px] font-bold text-amzn-green">{rupee(alt.price)}</p>
                        {savings > 0 && (
                          <p className="text-[8px] font-bold text-amzn-green bg-amzn-greenlite px-1 rounded-full">
                            Save {rupee(savings)}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })()}
              {ing.product && alternativesLoading.has(ing.product.id) && !ingredientAlternatives.has(ing.product.id) && (
                <div className="pl-8 pb-1">
                  <p className="text-[9px] text-ink2">Checking for cheaper options…</p>
                </div>
              )}
              </div>
              );
            })}
          </div>
        </div>

        {/* steps */}
        {recipeData.steps.length > 0 && (
          <div className="bg-white mx-3 mt-3 rounded-2xl border border-line p-4">
            <p className="text-[13px] font-bold mb-2">Method</p>
            <ol className="space-y-2">
              {recipeData.steps.map((s, i) => (
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
          disabled={selectedCount === 0}
          className="w-full rounded-2xl bg-amzn-yellow2 text-amzn-dark font-bold py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Add {selectedCount} item{selectedCount > 1 ? "s" : ""} · {rupee(selectedTotal)}
        </button>
      </div>
    </div>
  );
}
