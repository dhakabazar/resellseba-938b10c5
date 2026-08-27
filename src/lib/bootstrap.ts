/**
 * Page bootstrap cache.
 *
 * Every public/panel page loads its data from ONE database function call
 * (`*_bootstrap` / `*_page`) instead of a fan-out of table queries. The result
 * is memoised per session key so navigating back to a page costs zero requests.
 *
 * Nothing here is hardcoded: the backend URL/keys come from env through the
 * generated client, so pointing the project at another (self-hosted) backend
 * needs no code change.
 */
import { supabase } from "@/integrations/supabase/client";
import { mergeDeliverySettings, setGlobalDelivery } from "@/lib/delivery";

const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, run: () => Promise<T>, force = false): Promise<T> {
  if (force) cache.delete(key);
  const hit = cache.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = run().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, p);
  return p;
}

/** Drop cached page payloads (all, or every key starting with `prefix`). */
export function clearBootstrapCache(prefix?: string) {
  if (!prefix) return cache.clear();
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) {
    console.error(`[bootstrap] ${name} failed`, error.message);
    return null;
  }
  return (data as T) ?? null;
}

/* ── Landing page ──────────────────────────────────────────────────────── */

export type LpStats = { totalProducts: number; totalCategories: number; totalSales: number };

export type LpBootstrap = {
  settings: Record<string, unknown> | null;
  /** set when the visitor arrived on a verified reseller custom domain */
  store: { code: string; status: string } | null;
  stats: LpStats;
  categories: { id: string; name: string; slug: string; image_url: string | null; product_count: number }[];
  products: {
    id: string;
    name: string;
    slug: string;
    main_image: string | null;
    price: number;
    base_price: number;
    description: string;
  }[];
};

/** Landing page: branding + content + stats + categories + products in one call. */
export function getLpBootstrap(host: string, force = false) {
  return once(
    `lp:${host}`,
    async () => (await rpc<LpBootstrap>("lp_bootstrap", { _host: host || null })) ?? null,
    force,
  );
}

/* ── Storefront ────────────────────────────────────────────────────────── */

export type StoreBootstrap = {
  store: Record<string, any> | null;
  listings: any[];
  categories: { id: string; name: string; slug: string; image_url: string | null }[];
  menu: any[];
  delivery: unknown;
};

/** Storefront: settings + listings + categories + menu + delivery rule in one call. */
export function getStoreBootstrap(code: string, force = false) {
  return once(
    `store:${code}`,
    async () => {
      const data = await rpc<StoreBootstrap>("store_bootstrap", { _code: code });
      // storefront pages price with the platform delivery rule — seed it here so
      // no page has to fetch global_settings separately.
      if (data) setGlobalDelivery(mergeDeliverySettings(data.delivery as never));
      return data;
    },
    force,
  );
}
