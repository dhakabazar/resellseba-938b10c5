import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "./env-bridge";
import { getStoreSlug } from "./app-data";

function getAdminClient() {
  const url = getRuntimeEnv("SUPABASE_URL");
  const serviceKey = getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  const pubKey = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY");

  const key = serviceKey || pubKey;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Server-side helper to resolve any store slug (e.g. "rosebuyora" or "dhaka-bazar")
 * into the canonical reseller code (e.g. "10001").
 * Bypasses RLS using the server-side service role key.
 */
export async function resolveStoreCodeServerImpl(rawCode: string): Promise<string | null> {
  const code = (rawCode ?? "").trim();
  if (!code) return null;

  try {
    const db = getAdminClient();
    if (!db) return null;

    const targetSlug = code.toLowerCase();

    // 1. Direct match on code
    const { data: byCode } = await db
      .from("resellers")
      .select("code")
      .ilike("code", code)
      .limit(1)
      .maybeSingle();

    if (byCode?.code) return byCode.code;

    // 2. Direct match on business_name
    const { data: byName } = await db
      .from("resellers")
      .select("code")
      .ilike("business_name", code)
      .limit(1)
      .maybeSingle();

    if (byName?.code) return byName.code;

    // 3. Scan active resellers and match slugified business_name or code
    const { data: allResellers } = await db
      .from("resellers")
      .select("id, code, business_name")
      .eq("status", "active");

    if (allResellers && allResellers.length > 0) {
      const match = allResellers.find((r) => {
        if (!r.code) return false;
        if (r.code.toLowerCase() === targetSlug) return true;
        const slug = getStoreSlug(r.business_name, r.code).toLowerCase();
        if (slug === targetSlug) return true;
        const nameClean = (r.business_name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const targetClean = targetSlug.replace(/[^a-z0-9]+/g, "");
        return nameClean && nameClean === targetClean;
      });

      if (match?.code) return match.code;
    }

    // 4. Scan store_settings store_name
    const { data: allStores } = await db
      .from("store_settings")
      .select("reseller_id, store_name");

    if (allStores && allStores.length > 0) {
      const matchStore = allStores.find((s) => {
        if (!s.store_name) return false;
        const slug = getStoreSlug(s.store_name, null).toLowerCase();
        if (slug === targetSlug) return true;
        const nameClean = s.store_name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        const targetClean = targetSlug.replace(/[^a-z0-9]+/g, "");
        return nameClean && nameClean === targetClean;
      });

      if (matchStore?.reseller_id) {
        const { data: res } = await db
          .from("resellers")
          .select("code")
          .eq("id", matchStore.reseller_id)
          .maybeSingle();
        if (res?.code) return res.code;
      }
    }

    // 5. Match custom domain hostname
    const { data: dom } = await db
      .from("reseller_domains")
      .select("reseller_id")
      .ilike("hostname", code)
      .maybeSingle();

    if (dom?.reseller_id) {
      const { data: res } = await db
        .from("resellers")
        .select("code")
        .eq("id", dom.reseller_id)
        .maybeSingle();
      if (res?.code) return res.code;
    }
  } catch (err) {
    console.warn("[resolveStoreCodeServerImpl] error:", err);
  }

  return null;
}
