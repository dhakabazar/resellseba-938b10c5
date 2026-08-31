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
  /** ON = new reseller applications become active instantly (no manual approve). */
  resellerAutoApprove: boolean;
  /** ON = every new reseller is auto-assigned to an agent, balanced evenly. */
  resellerAutoAssign: boolean;

  /** Master switch: when off, no verification is required at signup. */
  verifyEnabled: boolean;
  /** Require the email code (only used when the master switch is on). */
  verifyEmail: boolean;
  /** Require the SMS code (only used when the master switch is on). */
  verifySms: boolean;
  /** ON = resellers can pay the security deposit with any ACTIVE payment method. */
  depositPayEnabled: boolean;
  /** Platform-wide delivery charge rule (products can override it). */
  delivery: DeliverySettings;
  /** Monthly package (subscription) rules. */
  subscription: SubscriptionSettings;
};

/** Monthly package rules — prices themselves live in `subscription_plans`. */
export type SubscriptionSettings = {
  /** Master switch: when off, nobody is asked to pay for a package. */
  enabled: boolean;
  /**
   * On  → every reseller is in the package automatically.
   * Off → only resellers an admin puts in the package are asked to pay;
   *       everybody else keeps using the panel and store normally.
   */
  autoApply: boolean;
  /** How many days before expiry the reseller starts seeing the reminder. */
  noticeDays: number;
  /** Free trial length for a brand-new reseller (0 = no trial). */
  trialDays: number;
  /** Extra days the panel keeps working after the package expired. */
  graceDays: number;
  /** Which package a new reseller gets during the free trial. */
  trialPlan: "panel" | "panel_store";
  /** Reseller-facing texts. */
  noticeTitle: string;
  noticeBody: string;
  lockedTitle: string;
  lockedBody: string;
};

export const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  enabled: false,
  autoApply: true,
  noticeDays: 7,
  trialDays: 7,
  graceDays: 0,
  trialPlan: "panel_store",
  noticeTitle: "Your monthly package ends soon",
  noticeBody: "Renew the package to keep the panel and your store running without a break.",
  lockedTitle: "Your monthly package has expired",
  lockedBody:
    "The panel is read-only right now. Renew the package to add orders and manage your listings again.",
};

export const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  resellerCatalogShowStock: true,
  packagingChargeSum: true,
  resellerAutoApprove: false,
  resellerAutoAssign: false,

  verifyEnabled: false,
  verifyEmail: true,
  verifySms: false,
  depositPayEnabled: true,
  delivery: DEFAULT_DELIVERY_SETTINGS,
  subscription: DEFAULT_SUBSCRIPTION_SETTINGS,
};

export function mergeSubscriptionSettings(raw: unknown): SubscriptionSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SUBSCRIPTION_SETTINGS };
  if (typeof r.enabled === "boolean") out.enabled = r.enabled;
  if (typeof r.autoApply === "boolean") out.autoApply = r.autoApply;
  if (Number.isFinite(Number(r.noticeDays))) out.noticeDays = Math.max(1, Number(r.noticeDays));
  if (Number.isFinite(Number(r.trialDays))) out.trialDays = Math.max(0, Number(r.trialDays));
  if (Number.isFinite(Number(r.graceDays))) out.graceDays = Math.max(0, Number(r.graceDays));
  if (r.trialPlan === "panel" || r.trialPlan === "panel_store") out.trialPlan = r.trialPlan;
  for (const k of ["noticeTitle", "noticeBody", "lockedTitle", "lockedBody"] as const) {
    if (typeof r[k] === "string" && (r[k] as string).trim()) out[k] = r[k] as string;
  }
  return out;
}

export function mergeAdvanced(raw: unknown): AdvancedSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_ADVANCED_SETTINGS };
  for (const k of Object.keys(out) as (keyof AdvancedSettings)[]) {
    if (typeof out[k] === "boolean" && typeof r[k] === "boolean") {
      (out as any)[k] = r[k];
    }
  }
  out.delivery = mergeDeliverySettings(r.delivery);
  out.subscription = mergeSubscriptionSettings(r.subscription);
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
