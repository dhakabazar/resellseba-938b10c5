/**
 * Shared app data cache.
 *
 * Most panel screens used to re-fetch the same two rows on every mount:
 *  - `global_settings` (branding, contact, feature switches)
 *  - the signed-in user's `resellers` row (needed before any reseller query)
 *
 * That produced an extra request-waterfall per page. Here we fetch each of them
 * once per session and hand out the cached promise, so a page render costs only
 * the requests that are unique to that page — and those can start immediately.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mergeDeliverySettings, setGlobalDelivery } from "@/lib/delivery";
import { applyPlatformBranding } from "@/lib/platform-branding";
import { waitForPanelBootstrap } from "@/lib/panel-bootstrap";

export type GlobalSettings = {
  id: number;
  site_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color?: string | null;
  secondary_color?: string | null;
  highlight_color?: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  advanced_settings: unknown;
  [key: string]: unknown;
};

export type MyReseller = {
  id: string;
  code: string;
  business_name: string;
  status: string;
  avatar_url?: string | null;
  /** Live verified custom domain hostname (from panel bootstrap), no scheme. */
  primary_domain?: string | null;
};

let settingsPromise: Promise<GlobalSettings | null> | null = null;
let resellerPromise: Promise<MyReseller | null> | null = null;
let resellerForUser: string | null = null;

/**
 * Seeds the settings cache from a page bootstrap payload that already carries
 * the row — so `getGlobalSettings()` callers on that page cost no request.
 */
export function primeGlobalSettings(data: unknown) {
  if (!data) return;
  const s = data as GlobalSettings;
  settingsPromise = Promise.resolve(s);
  setGlobalDelivery(mergeDeliverySettings((s as any)?.advanced_settings?.delivery));
  applyPlatformBranding(s as any);
}

/** One `global_settings` read per session (shared by every caller). */
export function getGlobalSettings(force = false): Promise<GlobalSettings | null> {
  if (force) settingsPromise = null;
  let p = settingsPromise;
  if (!p) {
    p = (async () => {
      try {
        // A panel bootstrap in flight already carries this row — wait for it.
        await waitForPanelBootstrap();
        if (settingsPromise && settingsPromise !== p) return settingsPromise;
        const { data } = await supabase.from("global_settings").select("*").eq("id", 1).maybeSingle();
        setGlobalDelivery(mergeDeliverySettings((data as any)?.advanced_settings?.delivery));
        applyPlatformBranding(data as any);
        return (data as GlobalSettings | null) ?? null;
      } catch {
        return null;
      }
    })();
    settingsPromise = p;
  }
  return p;
}

/** Seeds the reseller cache from a page bootstrap payload (no extra request). */
export function primeMyReseller(userId: string | null | undefined, row: unknown) {
  if (!row) return;
  resellerForUser = userId ?? resellerForUser;
  resellerPromise = Promise.resolve(row as MyReseller);
}

/** One `resellers` lookup per signed-in user (shared by every reseller screen, works for both owners & staff). */
export function getMyReseller(userId?: string | null, force = false): Promise<MyReseller | null> {
  if (force || (userId && resellerForUser && resellerForUser !== userId)) {
    resellerPromise = null;
  }
  let p = resellerPromise;
  if (!p) {
    resellerForUser = userId ?? null;
    p = (async () => {
      try {
        await waitForPanelBootstrap();
        if (resellerPromise && resellerPromise !== p) return resellerPromise;

        let uid = userId ?? null;
        if (!uid) uid = (await supabase.auth.getUser()).data.user?.id ?? null;
        if (!uid) return null;
        resellerForUser = uid;

        // 1. Direct owner lookup
        const { data: ownerReseller } = await supabase
          .from("resellers")
          .select("id, code, business_name, status, avatar_url")
          .eq("user_id", uid)
          .maybeSingle();

        if (ownerReseller) return ownerReseller as MyReseller;

        // 2. Staff lookup: find the owner's reseller via reseller_staff
        const { data: staffRow } = await supabase
          .from("reseller_staff")
          .select("reseller_id, resellers!inner(id, code, business_name, status, avatar_url)")
          .eq("user_id", uid)
          .eq("active", true)
          .maybeSingle();

        if (staffRow?.resellers) {
          return staffRow.resellers as unknown as MyReseller;
        }

        // 3. Fallback via current_reseller_id RPC
        const { data: currentResellerId } = await supabase.rpc("current_reseller_id");
        if (currentResellerId) {
          const { data: byRpc } = await supabase
            .from("resellers")
            .select("id, code, business_name, status, avatar_url")
            .eq("id", currentResellerId)
            .maybeSingle();
          if (byRpc) return byRpc as MyReseller;
        }

        return null;
      } catch {
        return null;
      }
    })();
    resellerPromise = p;
  }
  return p;
}

/**
 * Generates a clean URL slug for a reseller's store from their business name / name.
 * If no business name is available, falls back to the reseller code.
 */
export function getStoreSlug(businessName?: string | null, fallbackCode?: string | null): string {
  const raw = (businessName ?? "").trim();
  if (!raw) return (fallbackCode ?? "").trim();

  // Convert spaces and special characters into hyphens, lowercase
  // Keeps alphanumeric, Unicode letters and vowel marks (e.g. Bengali), converts spaces/symbols to hyphen
  const slug = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || (fallbackCode ?? "").trim();
}

/** Builds the relative storefront path, e.g. /s/dhaka-bazar */
export function buildResellerStorePath(businessName?: string | null, fallbackCode?: string | null): string {
  const slug = getStoreSlug(businessName, fallbackCode);
  return slug ? `/s/${slug}` : "/s/";
}

/** Builds the full absolute storefront URL (or custom domain if provided) */
export function buildResellerStoreAbsoluteUrl(
  businessName?: string | null,
  fallbackCode?: string | null,
  customHost?: string | null,
): string {
  if (customHost) {
    const cleanHost = customHost.replace(/^https?:\/\//, "").trim();
    if (cleanHost) return `https://${cleanHost}`;
  }
  const path = buildResellerStorePath(businessName, fallbackCode);
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** Resolves the live store URL (custom domain if connected/verified, otherwise /s/(business-name)). */
export async function getResellerStoreUrl(
  resellerId: string,
  resellerCode: string,
  businessName?: string | null,
): Promise<string> {
  const slug = getStoreSlug(businessName, resellerCode);
  let activeUrl = `/s/${slug}`;

  try {
    const { data: dRows } = await supabase
      .from("reseller_domains")
      .select("hostname, is_primary, ssl_status, verified_at")
      .eq("reseller_id", resellerId)
      .order("is_primary", { ascending: false });

    if (dRows && dRows.length > 0) {
      // Prioritize:
      // 1. Primary domain
      // 2. Active SSL or verified domain
      // 3. Any connected domain
      const best =
        dRows.find((d) => d.is_primary && d.hostname) ||
        dRows.find((d) => (d.ssl_status === "active" || d.verified_at) && d.hostname) ||
        dRows.find((d) => !!d.hostname);

      if (best?.hostname) {
        const cleanHost = best.hostname.replace(/^https?:\/\//, "").trim();
        if (cleanHost) {
          activeUrl = `https://${cleanHost}`;
        }
      }
    }
  } catch (e) {
    console.warn("Failed to resolve custom domain for reseller:", e);
  }

  return activeUrl;
}

/** Drop caches — call after sign-in/out or after saving settings. */
export function clearAppDataCache(scope: "all" | "settings" | "reseller" = "all") {
  if (scope === "all" || scope === "settings") settingsPromise = null;
  if (scope === "all" || scope === "reseller") {
    resellerPromise = null;
    resellerForUser = null;
  }
}

/** Hook version of {@link getGlobalSettings}. */
export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getGlobalSettings().then((s) => {
      if (!alive) return;
      setSettings(s);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { settings, loading };
}

/** Hook version of {@link getMyReseller}. */
export function useMyReseller(userId?: string | null) {
  const [reseller, setReseller] = useState<MyReseller | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getMyReseller(userId).then((r) => {
      if (!alive) return;
      setReseller(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  return { reseller, loading };
}

