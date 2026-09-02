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

/** One `resellers` lookup per signed-in user (shared by every reseller screen). */

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
        const { data } = await supabase
          .from("resellers")
          .select("id, code, business_name, status, avatar_url")
          .eq("user_id", uid)
          .maybeSingle();
        return (data as MyReseller | null) ?? null;
      } catch {
        return null;
      }
    })();
    resellerPromise = p;
  }
  return p;
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
