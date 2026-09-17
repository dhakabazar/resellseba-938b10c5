import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getStoreTheme, getPalette, ensureThemeFont, type StorePalette, type StoreTheme } from "@/lib/store-theme";
import { onCartChange, readCart, type CartLine } from "@/lib/store-cart";
import {
  createContentReader,
  type ContentReader,
  type ThemeContentValues,
} from "@/lib/store-content";
import { buildMenuTree, type MenuNode } from "@/lib/store-menu";
import { getStoreBootstrap } from "@/lib/bootstrap";
import { injectTrackingFromRows } from "@/lib/tracking";


export type StoreImage = { url: string; is_primary: boolean | null; sort_order?: number | null };

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  product_code?: string | null;
  stock: number | null;
  category_id: string | null;
  category_ids?: string[] | null;
  brand_id: string | null;
  is_featured: boolean | null;
  delivery_mode: string | null;
  delivery_flat: number | null;
  delivery_inside: number | null;
  delivery_outside: number | null;
  delivery_sub: number | null;
  product_images: StoreImage[];
};

export type StoreListing = {
  id: string;
  selling_price: number;
  custom_title: string | null;
  custom_description: string | null;
  extra_delivery_inside: number | null;
  extra_delivery_outside: number | null;
  created_at?: string;
  product: StoreProduct | null;
};

export type StoreSettings = {
  store_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  og_image_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  footer_text: string | null;
  meta_description: string | null;
  theme: string | null;
  hero_headline: string | null;
  hero_subheadline: string | null;
  hero_image_url: string | null;
  announcement: string | null;
  about_text: string | null;
  support_phone: string | null;
  theme_settings?: Record<string, ThemeContentValues> | null;
};

export type StoreCategory = { id: string; name: string; slug: string; image_url: string | null; product_count?: number };

export type StoreData = {
  code: string;
  resellerId: string;
  name: string;
  settings: StoreSettings | null;
  theme: StoreTheme;
  /** active color palette of the theme */
  palette: StorePalette;
  /** resolved per-theme content (falls back to legacy columns then defaults) */
  content: ContentReader;
  listings: StoreListing[];
  categories: StoreCategory[];
  /** reseller-built header menu (empty = fall back to categories) */
  menu: MenuNode[];
  /** manual payment methods usable at checkout (reseller's own wins over platform) */
  paymentMethods: { method: string; label: string | null; instructions: string | null; reseller_id: string | null }[];
  cart: CartLine[];

  cartCount: number;
  byListingId: (id: string) => StoreListing | undefined;
  bySlug: (slug: string) => StoreListing | undefined;
  title: (l: StoreListing) => string;
  image: (l: StoreListing) => string | undefined;
};


/** reseller-specific method overrides the platform one with the same key */
function dedupePayment(
  rows: { method: string; label: string | null; instructions: string | null; reseller_id: string | null }[],
) {
  const byMethod = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!r.method) continue;
    const existing = byMethod.get(r.method);
    if (!existing || (r.reseller_id && !existing.reseller_id)) byMethod.set(r.method, r);
  }
  return Array.from(byMethod.values());
}

const Ctx = createContext<StoreData | null>(null);

export function useStore(): StoreData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export type LoadState = "loading" | "missing" | "closed" | "ready";

export function useStoreLoader(code: string, themeOverride?: string | null, paletteOverride?: string | null) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<Omit<StoreData, "cart" | "cartCount"> | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);

  const refreshCart = useCallback(() => setCart(readCart(code)), [code]);

  useEffect(() => {
    refreshCart();
    return onCartChange(refreshCart);
  }, [refreshCart]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setState("loading");
      // ONE call: store settings + listings (with images) + categories + menu
      // + the platform delivery rule.
      const boot = await getStoreBootstrap(code);
      if (!alive) return;
      const r = boot?.store as (StoreSettings & { reseller_id: string; business_name: string }) | null;
      if (!r) return setState(boot?.store_closed ? "closed" : "missing");

      const rid = r.reseller_id;
      const s = r as unknown as StoreSettings;

      const listings = ((boot?.listings ?? []) as unknown as StoreListing[]).map((l) => ({
        ...l,
        product: l.product
          ? {
              ...l.product,
              product_images: [...(l.product.product_images ?? [])].sort(
                (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
              ),
            }
          : null,
      })) as StoreListing[];

      const categories = (boot?.categories ?? []) as StoreCategory[];
      const menuRows = (boot?.menu ?? []) as never;
      injectTrackingFromRows(boot?.pixels as never);

      const theme = getStoreTheme(themeOverride || s?.theme);
      ensureThemeFont(theme);
      const storeName = s?.store_name || r.business_name || code;
      const values = s?.theme_settings?.[theme.id];
      const savedPalette = typeof values?.palette === "string" ? values.palette : null;
      const palette = getPalette(theme, paletteOverride || savedPalette);

      if (!alive) return;

      setData({
        code,
        resellerId: rid,
        name: storeName,
        settings: s,
        theme,
        palette,
        content: createContentReader(theme.id, values, s, storeName),

        listings,
        categories,
        menu: buildMenuTree(menuRows),
        paymentMethods: dedupePayment(boot?.payment_methods ?? []),

        byListingId: (id) => listings.find((l) => l.id === id),
        bySlug: (slug) => listings.find((l) => l.product?.slug === slug),
        title: (l) => l.custom_title || l.product?.name || "",
        image: (l) =>
          l.product?.product_images?.find((i) => i.is_primary)?.url ?? l.product?.product_images?.[0]?.url,
      });
      setState("ready");
    })();
    return () => {
      alive = false;
    };
  }, [code, themeOverride, paletteOverride]);

  const value = useMemo<StoreData | null>(() => {
    if (!data) return null;
    return { ...data, cart, cartCount: cart.reduce((s, l) => s + l.qty, 0) };
  }, [data, cart]);

  return { state, store: value, Provider: Ctx.Provider };
}

export const StoreContext = Ctx;
