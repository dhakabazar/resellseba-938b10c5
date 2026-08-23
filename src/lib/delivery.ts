/**
 * Delivery charge logic.
 *
 * Two layers:
 *  1. GLOBAL  — Admin → System → Advanced settings → Delivery charge.
 *               Area-wise (3 editable areas), Flat rate, Free shipping or Custom.
 *  2. PRODUCT — a product can keep `delivery_mode = 'global'` (inherit) or set
 *               its own mode/charges, which always wins (priority 1).
 *
 * On top of that, an order (add/edit) or checkout can still override the final
 * delivery charge manually.
 */

export type DeliveryMode = "area" | "free" | "flat" | "custom";
export type DeliveryArea = "inside_dhaka" | "outside_dhaka" | "sub_dhaka";
/** `global` = inherit the platform-wide setting. */
export type ProductDeliveryMode = DeliveryMode | "global";

export const DELIVERY_AREAS: DeliveryArea[] = ["inside_dhaka", "sub_dhaka", "outside_dhaka"];

export type DeliverySettings = {
  mode: DeliveryMode;
  flat: number;
  /** Default charge when the mode is `custom` (freely editable per order). */
  custom: number;
  areas: Record<DeliveryArea, { label: string; charge: number }>;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  mode: "area",
  flat: 80,
  custom: 0,
  areas: {
    inside_dhaka: { label: "Inside Dhaka", charge: 60 },
    sub_dhaka: { label: "Sub Dhaka", charge: 90 },
    outside_dhaka: { label: "Outside Dhaka", charge: 130 },
  },
};

export function mergeDeliverySettings(raw: unknown): DeliverySettings {
  const r = (raw ?? {}) as Partial<DeliverySettings>;
  const mode = (["area", "free", "flat", "custom"] as DeliveryMode[]).includes(r.mode as DeliveryMode)
    ? (r.mode as DeliveryMode)
    : DEFAULT_DELIVERY_SETTINGS.mode;
  const areas = { ...DEFAULT_DELIVERY_SETTINGS.areas };
  for (const key of DELIVERY_AREAS) {
    const src = (r.areas as any)?.[key] ?? {};
    areas[key] = {
      label: typeof src.label === "string" && src.label.trim() ? src.label.trim() : DEFAULT_DELIVERY_SETTINGS.areas[key].label,
      charge: num(src.charge, DEFAULT_DELIVERY_SETTINGS.areas[key].charge),
    };
  }
  return {
    mode,
    flat: num(r.flat, DEFAULT_DELIVERY_SETTINGS.flat),
    custom: num(r.custom, DEFAULT_DELIVERY_SETTINGS.custom),
    areas,
  };
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/* ---------------------------------------------------------------- global cache */

let active: DeliverySettings = DEFAULT_DELIVERY_SETTINGS;

/** Called once per session from the shared settings cache. */
export function setGlobalDelivery(s: DeliverySettings) {
  active = s;
}

export function globalDelivery(): DeliverySettings {
  return active;
}

export function areaLabel(area: DeliveryArea, g: DeliverySettings = active): string {
  return g.areas[area]?.label ?? DEFAULT_DELIVERY_SETTINGS.areas[area].label;
}

export function areaOptions(g: DeliverySettings = active): { value: DeliveryArea; label: string }[] {
  return DELIVERY_AREAS.map((value) => ({ value, label: areaLabel(value, g) }));
}

/* -------------------------------------------------------------------- product */

export type DeliveryConfig = {
  delivery_mode?: string | null;
  delivery_flat?: number | null;
  delivery_inside?: number | null;
  delivery_outside?: number | null;
  delivery_sub?: number | null;
};

export type ResolvedDelivery = {
  /** Where the numbers came from. */
  source: "product" | "global";
  mode: DeliveryMode;
  flat: number;
  custom: number;
  charges: Record<DeliveryArea, number>;
};

export function productDeliveryMode(p: DeliveryConfig): ProductDeliveryMode {
  const m = (p.delivery_mode ?? "global") as ProductDeliveryMode;
  return m === "free" || m === "flat" || m === "area" || m === "custom" ? m : "global";
}

/** Merge global + per-product delivery config. Product setting wins. */
export function resolveDelivery(p: DeliveryConfig, g: DeliverySettings = active): ResolvedDelivery {
  const own = productDeliveryMode(p);
  if (own === "global") {
    return {
      source: "global",
      mode: g.mode,
      flat: g.flat,
      custom: g.custom,
      charges: {
        inside_dhaka: g.areas.inside_dhaka.charge,
        sub_dhaka: g.areas.sub_dhaka.charge,
        outside_dhaka: g.areas.outside_dhaka.charge,
      },
    };
  }
  const inside = num(p.delivery_inside, 0);
  const outside = num(p.delivery_outside, 0);
  return {
    source: "product",
    mode: own,
    flat: num(p.delivery_flat, 0),
    custom: num(p.delivery_flat, 0),
    charges: {
      inside_dhaka: inside,
      sub_dhaka: p.delivery_sub == null ? outside : num(p.delivery_sub, outside),
      outside_dhaka: outside,
    },
  };
}

/** Base charge (before reseller extras) for one resolved config in one area. */
export function resolvedCharge(r: ResolvedDelivery, area: DeliveryArea): number {
  if (r.mode === "free") return 0;
  if (r.mode === "flat") return r.flat;
  if (r.mode === "custom") return r.custom;
  return r.charges[area] ?? 0;
}

/** Back-compat: legacy callers pass the raw product row. */
export function deliveryMode(p: DeliveryConfig, g: DeliverySettings = active): DeliveryMode {
  return resolveDelivery(p, g).mode;
}

/**
 * Customer-facing delivery charge for one product.
 * `extra` = reseller's own extra delivery add-on (ignored for free shipping).
 */
export function productDeliveryCharge(
  p: DeliveryConfig,
  area: DeliveryArea,
  extra: { inside?: number | null; outside?: number | null } = {},
  g: DeliverySettings = active,
): number {
  const r = resolveDelivery(p, g);
  if (r.mode === "free") return 0;
  const add = area === "inside_dhaka" ? num(extra.inside, 0) : num(extra.outside, 0);
  return resolvedCharge(r, area) + add;
}

/** Short label like "Free shipping", "Flat ৳80", "৳60 / ৳90 / ৳130". */
export function deliveryLabel(p: DeliveryConfig, g: DeliverySettings = active): string {
  const r = resolveDelivery(p, g);
  const suffix = r.source === "global" ? " (global)" : "";
  if (r.mode === "free") return `Free shipping${suffix}`;
  if (r.mode === "flat") return `Flat ৳${r.flat}${suffix}`;
  if (r.mode === "custom") return `Custom ৳${r.custom}${suffix}`;
  return `৳${r.charges.inside_dhaka} / ৳${r.charges.sub_dhaka} / ৳${r.charges.outside_dhaka}${suffix}`;
}

/** One-line description of the global rule, for hints. */
export function deliverySettingsSummary(g: DeliverySettings = active): string {
  if (g.mode === "free") return "Global: free shipping everywhere";
  if (g.mode === "flat") return `Global: flat ৳${g.flat} for every area`;
  if (g.mode === "custom") return `Global: custom ৳${g.custom} (editable per order)`;
  return DELIVERY_AREAS.map((a) => `${areaLabel(a, g)} ৳${g.areas[a].charge}`).join(" · ");
}
