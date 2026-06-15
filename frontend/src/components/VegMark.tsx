import type { Product } from "@/lib/types";

export default function VegMark({ product, size = 14 }: { product: Product; size?: number }) {
  const veg =
    product.dietary_tags?.includes("vegetarian") || product.dietary_tags?.includes("vegan");
  const nonVeg = product.category === "meat_seafood";
  if (!veg && !nonVeg) return null;
  const color = veg ? "#067d62" : "#b91c1c";
  return (
    <span
      className="inline-grid place-items-center border-[1.5px] rounded-[3px] shrink-0"
      style={{ width: size, height: size, borderColor: color }}
      aria-label={veg ? "veg" : "non-veg"}
    >
      <span className="rounded-full" style={{ width: size * 0.45, height: size * 0.45, background: color }} />
    </span>
  );
}
