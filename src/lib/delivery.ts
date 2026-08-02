export type DeliveryMode = "area" | "free" | "flat";
export type DeliveryArea = "inside_dhaka" | "outside_dhaka" | "sub_dhaka";

export type DeliveryConfig = {
  delivery_mode?: string | null;
  delivery_flat?: number | null;
  delivery_inside?: number | null;
  delivery_outside?: number | null;
};

export function deliveryMode(p: DeliveryConfig): DeliveryMode {
  const m = (p.delivery_mode ?? "area") as DeliveryMode;
  return m === "free" || m === "flat" ? m : "area";
}

/**
 * Customer-facing delivery charge for one product.
 * `extra` = reseller's own extra delivery add-on (ignored for free shipping).
 */
export function productDeliveryCharge(
  p: DeliveryConfig,
  area: DeliveryArea,
  extra: { inside?: number | null; outside?: number | null } = {},
): number {
  const mode = deliveryMode(p);
  if (mode === "free") return 0;
  const add =
    area === "inside_dhaka" ? Number(extra.inside ?? 0) : Number(extra.outside ?? 0);
  if (mode === "flat") return Number(p.delivery_flat ?? 0) + add;
  const base =
    area === "inside_dhaka" ? Number(p.delivery_inside ?? 0) : Number(p.delivery_outside ?? 0);
  return base + add;
}

/** Short label like "Free shipping", "Flat ৳80", "৳60 in / ৳130 out". */
export function deliveryLabel(p: DeliveryConfig): string {
  const mode = deliveryMode(p);
  if (mode === "free") return "Free shipping";
  if (mode === "flat") return `Flat ৳${Number(p.delivery_flat ?? 0)}`;
  return `৳${Number(p.delivery_inside ?? 0)} in / ৳${Number(p.delivery_outside ?? 0)} out`;
}
