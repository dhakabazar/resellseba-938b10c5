import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-reseller rate overrides (admin price, packaging cost, delivery charge).
 *
 * Admin can give a specific reseller different rates for specific products.
 * Wherever an order, a catalog card or a pricing screen needs a product's
 * rates for a reseller, it must go through this map — the master product row
 * is only the fallback. RLS lets a reseller read only their own rows.
 */
export type ResellerRate = {
  reseller_price: number;
  packaging_cost: number | null;
  delivery_mode: string | null;
  delivery_flat: number | null;
  delivery_inside: number | null;
  delivery_outside: number | null;
  delivery_sub: number | null;
};
export type ResellerPriceMap = Map<string, ResellerRate>;

const num = (v: unknown) => (v == null ? null : Number(v));

export async function fetchResellerPriceMap(resellerId?: string | null): Promise<ResellerPriceMap> {
  let q = supabase
    .from("reseller_product_prices")
    .select("product_id,reseller_price,packaging_cost,delivery_mode,delivery_flat,delivery_inside,delivery_outside,delivery_sub");
  if (resellerId) q = q.eq("reseller_id", resellerId);
  const { data } = await q;
  const map: ResellerPriceMap = new Map();
  for (const r of (data ?? []) as any[]) {
    map.set(r.product_id, {
      reseller_price: Number(r.reseller_price),
      packaging_cost: num(r.packaging_cost),
      delivery_mode: r.delivery_mode ?? null,
      delivery_flat: num(r.delivery_flat),
      delivery_inside: num(r.delivery_inside),
      delivery_outside: num(r.delivery_outside),
      delivery_sub: num(r.delivery_sub),
    });
  }
  return map;
}

/** Effective admin price of a product for this reseller. */
export function wholesalePrice(
  product: { id?: string | null; reseller_price?: number | null } | null | undefined,
  map?: ResellerPriceMap | null,
): number {
  const custom = product?.id ? map?.get(product.id)?.reseller_price : undefined;
  return Number(custom ?? product?.reseller_price ?? 0);
}

/** True when this product has any reseller specific rate. */
export function hasCustomPrice(productId?: string | null, map?: ResellerPriceMap | null) {
  return Boolean(productId && map?.has(productId));
}

/**
 * Product row with the reseller's packaging and delivery overrides applied,
 * so existing packaging/delivery helpers work unchanged.
 */
export function withResellerRates<T extends Record<string, any>>(p: T, map?: ResellerPriceMap | null): T {
  const r = p?.id ? map?.get(p.id) : undefined;
  if (!r) return p;
  const out: any = { ...p, reseller_price: r.reseller_price };
  if (r.packaging_cost != null) out.packaging_cost = r.packaging_cost;
  if (r.delivery_mode) {
    out.delivery_mode = r.delivery_mode;
    out.delivery_flat = r.delivery_flat ?? 0;
    out.delivery_inside = r.delivery_inside ?? 0;
    out.delivery_outside = r.delivery_outside ?? 0;
    out.delivery_sub = r.delivery_sub ?? r.delivery_outside ?? 0;
  }
  return out;
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
