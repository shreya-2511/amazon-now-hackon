import { useBoot } from "@/lib/boot";

export type ProductLike = {
  dietary_tags?: string[];
  name?: string;
  category?: string;
  allergen_conflict?: boolean;
  warnings?: string[];
};

// ---------------------------------------------------------------------------
// Tag display config
// ---------------------------------------------------------------------------
const TAG_CONFIG: Record<string, { label: string; dot: string; border: string }> = {
  vegan:         { label: "Vegan",    dot: "#067d62", border: "#067d62" },
  vegetarian:    { label: "Veg",      dot: "#067d62", border: "#067d62" },
  eggetarian:    { label: "Egg",      dot: "#d97706", border: "#d97706" },
  "gluten-free": { label: "GF",       dot: "#0284c7", border: "#0284c7" },
  keto:          { label: "Keto",     dot: "#7c3aed", border: "#7c3aed" },
  halal:         { label: "Halal",    dot: "#059669", border: "#059669" },
};

// Tags that are only relevant to show if the user has selected that preference
const PREFERENCE_GATED = new Set(["gluten-free", "keto", "halal", "vegan"]);

// ---------------------------------------------------------------------------
// VegMark — classic Indian square-dot indicator
// Green = veg/vegan  |  Amber = eggetarian  |  Red = non-veg
// ---------------------------------------------------------------------------
export default function VegMark({ product, size = 14 }: { product: ProductLike; size?: number }) {
  const tags = product.dietary_tags ?? [];
  const isVeg  = tags.includes("vegan") || tags.includes("vegetarian");
  const isEgg  = tags.includes("eggetarian");
  const isNonVeg = product.category === "meat_seafood";

  if (!isVeg && !isEgg && !isNonVeg) return null;

  const color = isNonVeg ? "#b91c1c" : isEgg ? "#d97706" : "#067d62";
  const label = isNonVeg ? "non-veg" : isEgg ? "eggetarian" : "veg";

  const dotSize = Math.max(6, size * 0.45);
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: 2, border: `1.5px solid ${color}` }}
      aria-label={label}
    >
      <span
        className="rounded-full"
        style={{ width: dotSize, height: dotSize, backgroundColor: color }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// DietaryTags — extra pill badges (GF, Keto, Halal, Vegan)
//
// Rules:
// - Veg/vegetarian/eggetarian are already shown by VegMark — skip them here
// - PREFERENCE_GATED tags (GF, Keto, Halal, Vegan) only show if the user
//   has that preference selected in their profile
// - This keeps the UI clean — a non-GF user doesn't need to see GF labels
// ---------------------------------------------------------------------------
export function DietaryTags({
  product,
  max = 2,
}: {
  product: ProductLike;
  max?: number;
}) {
  const boot = useBoot();
  const userPrefs = new Set(boot?.user?.dietary?.preferences ?? []);

  const visibleTags = (product.dietary_tags ?? []).filter((t) => {
    return userPrefs.has(t);
  });

  if (visibleTags.length === 0) return null;

  return (
    <span className="flex flex-wrap gap-1 mt-1">
      {visibleTags.slice(0, max).map((t) => {
        const cfg = TAG_CONFIG[t];
        if (!cfg) return null;
        return (
          <span
            key={t}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
            style={{ color: cfg.dot, borderColor: cfg.border, background: `${cfg.dot}14` }}
          >
            {cfg.label}
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AllergenBadge — inline red warning for allergen conflicts
// ---------------------------------------------------------------------------
export function AllergenBadge({ product }: { product: ProductLike }) {
  if (!product.allergen_conflict || !product.warnings?.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-red-100 text-amzn-red font-bold px-1.5 py-0.5 rounded-full border border-amzn-red/20">
      ⚠ {product.warnings[0]}
    </span>
  );
}
