import { useEffect, useState } from "react";
import { bdt } from "@/lib/store-cart";
import { productDiscount, randomSoldCount, soldRange } from "@/lib/store-product-presentation";
import { useStore } from "./store-context";

export function PreviousPrice({ price, previous, quantity = 1, compact = false }: { price: number; previous: unknown; quantity?: number; compact?: boolean }) {
  const discount = productDiscount(price, previous);
  if (!discount) return null;
  return <span className={`inline-flex min-w-0 items-center font-medium text-[var(--st-muted)] ${compact ? "flex-nowrap gap-1 text-[10px] sm:text-[11px]" : "flex-wrap gap-2 text-xs"}`}>
    <del className="whitespace-nowrap">{bdt(discount.regular * quantity)}</del>
    <span data-discount className="shrink-0 whitespace-nowrap rounded-md border border-[var(--st-sale,#e11d48)]/25 bg-[var(--st-sale,#e11d48)]/10 px-1.5 py-0.5 font-bold leading-none text-[var(--st-sale,#e11d48)]">{discount.percent}%{compact ? "" : " ছাড়"}</span>
  </span>;
}

export function useSoldCount(id: string) {
  const { content } = useStore();
  const [min, max] = soldRange(content.text("sold_min"), content.text("sold_max"));
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(randomSoldCount(min, max, Math.random()));
  }, [id, min, max]);
  return content.flag("sold_show") ? count : null;
}

export function SoldCountBadge({ count }: { count: number | null }) {
  if (count === null) return null;
  return <span data-sold-count className="inline-flex shrink-0 items-center rounded-md border border-[var(--st-sold,#d97706)]/25 bg-[var(--st-sold,#d97706)]/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--st-sold,#d97706)] tabular-nums whitespace-nowrap">{count} sold</span>;
}

export function SoldCount({ id }: { id: string }) {
  const count = useSoldCount(id);
  return <SoldCountBadge count={count} />;
}