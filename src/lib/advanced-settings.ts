import { useEffect, useState } from "react";
import { getGlobalSettings, clearAppDataCache } from "@/lib/app-data";
import {
  DEFAULT_DELIVERY_SETTINGS,
  mergeDeliverySettings,
  setGlobalDelivery,
  type DeliverySettings,
} from "@/lib/delivery";

/**
 * Advanced system settings — small feature switches an admin can flip without
 * a code change. Everything lives in one jsonb column so new logic can be
 * added later without a migration.
 */
export type AdvancedSettings = {
  /** Show the product stock number on the reseller catalog grid. */
  resellerCatalogShowStock: boolean;
  /** ON = add up every product's packaging cost. OFF = charge only the highest one. */
  packagingChargeSum: boolean;
  /** Master switch: when off, no verification is required at signup. */
  verifyEnabled: boolean;
  /** Require the email code (only used when the master switch is on). */
  verifyEmail: boolean;
  /** Require the SMS code (only used when the master switch is on). */
  verifySms: boolean;
  /** Platform-wide delivery charge rule (products can override it). */
  delivery: DeliverySettings;
};

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  resellerCatalogShowStock: true,
  packagingChargeSum: true,
  verifyEnabled: false,
  verifyEmail: true,
  verifySms: false,
  delivery: DEFAULT_DELIVERY_SETTINGS,
};


export function mergeAdvanced(raw: unknown): AdvancedSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_ADVANCED_SETTINGS };
  for (const k of Object.keys(out) as (keyof AdvancedSettings)[]) {
    if (typeof out[k] === "boolean" && typeof r[k] === "boolean") {
      (out as any)[k] = r[k];
    }
  }
  out.delivery = mergeDeliverySettings(r.delivery);
  setGlobalDelivery(out.delivery);
  return out;
}

/** True when the signed-in user still has to complete a verification step. */
export function pendingChannels(
  s: AdvancedSettings,
  state: { emailVerified: boolean; phoneVerified: boolean },
): ("email" | "sms")[] {
  if (!s.verifyEnabled) return [];
  const out: ("email" | "sms")[] = [];
  if (s.verifyEmail && !state.emailVerified) out.push("email");
  if (s.verifySms && !state.phoneVerified) out.push("sms");
  return out;
}

export async function fetchAdvancedSettings(): Promise<AdvancedSettings> {
  const data = await getGlobalSettings();
  return mergeAdvanced((data as any)?.advanced_settings);
}

let cache: AdvancedSettings | null = null;

/** Read-only hook for feature switches; cached for the session. */
export function useAdvancedSettings() {
  const [settings, setSettings] = useState<AdvancedSettings>(cache ?? DEFAULT_ADVANCED_SETTINGS);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetchAdvancedSettings().then((s) => {
      cache = s;
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

export function clearAdvancedSettingsCache() {
  cache = null;
  clearAppDataCache("settings");
}
