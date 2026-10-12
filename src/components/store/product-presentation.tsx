import { useEffect, useState } from "react";
import { bdt } from "@/lib/store-cart";
import { productDiscount, randomSoldCount, soldRange } from "@/lib/store-product-presentation";
import { useStore } from "./store-context";

export function PreviousPrice({ price, previous, quantity = 1 }: { price: number; previous: unknown; quantity?: number }) {
  const discount = productDiscount(price, previous);
  if (!discount) return null;
  return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--st-muted)]">
    <del>{bdt(discount.regular * quantity)}</del>
    <span className="text-[var(--st-primary)]">{discount.percent}% ছাড়</span>
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

export function SoldCount({ id }: { id: string }) {
  const count = useSoldCount(id);
  if (count === null) return null;
  return <div className="mt-2 text-xs font-medium text-[var(--st-muted)]">{count} sold</div>;
}