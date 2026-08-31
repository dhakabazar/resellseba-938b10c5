import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-reseller wholesale (admin) price overrides.
 *
 * Admin can give a specific reseller a different admin price for specific
 * products. Wherever an order, a catalog card or a pricing screen needs the
 * "admin price" of a product for a reseller, it must go through this map —
 * the master `products.reseller_price` is only the fallback.
 *
 * RLS keeps this safe: a reseller can only read their own rows, so calling
 * `fetchResellerPriceMap()` with no id from the reseller panel returns exactly
 * that reseller's overrides.
 */
export type ResellerPriceMap = Map<string, number>;

export async function fetchResellerPriceMap(resellerId?: string | null): Promise<ResellerPriceMap> {
  let q = supabase.from("reseller_product_prices").select("product_id,reseller_price");
  if (resellerId) q = q.eq("reseller_id", resellerId);
  const { data } = await q;
  const map: ResellerPriceMap = new Map();
  for (const r of (data ?? []) as { product_id: string; reseller_price: number }[]) {
    map.set(r.product_id, Number(r.reseller_price));
  }
  return map;
}

/** Effective admin price of a product for this reseller. */
export function wholesalePrice(
  product: { id?: string | null; reseller_price?: number | null } | null | undefined,
  map?: ResellerPriceMap | null,
): number {
  const custom = product?.id ? map?.get(product.id) : undefined;
  return Number(custom ?? product?.reseller_price ?? 0);
}

/** True when this product has a reseller specific price. */
export function hasCustomPrice(productId?: string | null, map?: ResellerPriceMap | null) {
  return Boolean(productId && map?.has(productId));
}

/** Reactive price map — refetches whenever the reseller changes. */
export function useResellerPriceMap(resellerId?: string | null) {
  const [map, setMap] = useState<ResellerPriceMap>(new Map());
  useEffect(() => {
    let alive = true;
    if (resellerId === undefined) return;
    (async () => {
      const next = await fetchResellerPriceMap(resellerId);
      if (alive) setMap(next);
    })();
    return () => {
      alive = false;
    };
  }, [resellerId]);
  return map;
}
