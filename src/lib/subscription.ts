/**
 * Monthly package (subscription) helpers.
 *
 * Two products:
 *  - `panel`        → reseller panel only
 *  - `panel_store`  → reseller panel + storefront
 *
 * Prices are global per (plan, months) and can be overridden for a single
 * reseller. Everything comes from one `subscription_overview()` call so a page
 * never fires several queries for the same state.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPanelBootstrapPayload } from "@/lib/panel-bootstrap";

export type PlanKey = "panel" | "panel_store";

export const PLAN_KEYS: PlanKey[] = ["panel", "panel_store"];
export const PLAN_MONTHS = [1, 6, 12] as const;

export const PLAN_META: Record<PlanKey, { label: string; short: string; blurb: string; features: string[] }> = {
  panel: {
    label: "Panel only",
    short: "Panel",
    blurb: "Reseller panel access — orders, courier, reports.",
    features: ["Reseller panel & dashboard", "Order + courier management", "Reports and payouts"],
  },
  panel_store: {
    label: "Panel + Storefront",
    short: "Panel + Store",
    blurb: "Everything in Panel, plus your own online store.",
    features: [
      "Everything in Panel only",
      "Public storefront with your own theme",
      "Custom domain & storefront checkout",
    ],
  },
};

export type SubscriptionState = {
  /** True only when the package actually governs this reseller. */
  enabled: boolean;
  /** Master switch state, regardless of this reseller's enrolment. */
  master_enabled?: boolean;
  /** Auto-apply mode: every reseller is in the package. */
  auto_apply?: boolean;
  /** Manually put in the package by an admin. */
  enrolled?: boolean;
  enrolled_at?: string | null;
  notice_days?: number;
  reseller_id?: string | null;
  exempt?: boolean;
  plan?: PlanKey | null;
  expires_at?: string | null;
  trial_ends_at?: string | null;
  until?: string | null;
  in_trial?: boolean;
  days_left?: number | null;
  grace_days?: number;
  trial_days?: number;
  locked: boolean;
  store_allowed: boolean;
};

export type SubscriptionOption = {
  plan: PlanKey;
  months: number;
  price: number;
  base_price: number;
  is_custom: boolean;
  active: boolean;
};

export type SubscriptionHistoryRow = {
  id: string;
  plan: PlanKey;
  months: number;
  amount: number;
  source: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  created_at: string;
};

export type SubscriptionRequestRow = {
  id: string;
  reseller_id: string;
  plan: PlanKey;
  months: number;
  amount: number;
  method: string | null;
  provider: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
};

export type SubscriptionOverview = {
  state: SubscriptionState;
  options: SubscriptionOption[];
  history: SubscriptionHistoryRow[];
  requests: SubscriptionRequestRow[];
};

export const emptyState: SubscriptionState = { enabled: false, locked: false, store_allowed: true };

/** How many days before expiry the reseller should start seeing the reminder. */
export function noticeWindow(state: SubscriptionState | null | undefined) {
  const d = Number(state?.notice_days ?? 7);
  return Number.isFinite(d) && d > 0 ? d : 7;
}

export const emptyOverview: SubscriptionOverview = {
  state: emptyState,
  options: [],
  history: [],
  requests: [],
};

export const bdt = (v: number) => `৳${Number(v || 0).toLocaleString("en-US")}`;

export function planLabel(plan: string | null | undefined) {
  if (!plan) return "—";
  return PLAN_META[plan as PlanKey]?.label ?? plan;
}

export function monthsLabel(months: number) {
  return months === 1 ? "1 month" : `${months} months`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** How the package should be shown as a chip anywhere in the UI. */
export function subscriptionBadge(state: SubscriptionState): {
  tone: "off" | "ok" | "warn" | "danger" | "trial";
  text: string;
} | null {
  if (!state?.enabled) {
    if (state?.master_enabled && !state.auto_apply) return { tone: "off", text: "Not in package" };
    return null;
  }
  if (state.exempt) return { tone: "off", text: "Package free" };
  if (state.locked) return { tone: "danger", text: "Package expired" };
  const days = state.days_left ?? null;
  if (state.in_trial) return { tone: "trial", text: days !== null ? `Trial · ${days}d left` : "Free trial" };
  if (days !== null && days <= noticeWindow(state)) return { tone: "warn", text: `${days}d left` };
  return { tone: "ok", text: days !== null ? `${days}d left` : "Active" };
}

/** Read the package state that already arrived with the panel bootstrap. */
export function subscriptionFromBootstrap(): SubscriptionState | null {
  const boot = getPanelBootstrapPayload() as unknown as { subscription?: SubscriptionState | null } | null;
  return (boot?.subscription as SubscriptionState | null) ?? null;
}

/* ------------------------------------------------------------------ *
 * Client-side mirror of the database package rules.
 *
 * The reseller list already loads every reseller row, so the package
 * state is derived locally instead of one RPC per reseller. The logic
 * mirrors `subscription_state()` exactly.
 * ------------------------------------------------------------------ */

export type SubscriptionRules = {
  enabled: boolean;
  autoApply: boolean;
  noticeDays: number;
  trialDays: number;
  graceDays: number;
};

export type ResellerSubscriptionRow = {
  subscription_plan?: string | null;
  subscription_expires_at?: string | null;
  subscription_trial_ends_at?: string | null;
  subscription_exempt?: boolean | null;
  subscription_enrolled?: boolean | null;
  subscription_enrolled_at?: string | null;
  created_at?: string | null;
};

const DAY = 86_400_000;

export function computeSubscriptionState(
  r: ResellerSubscriptionRow,
  cfg: SubscriptionRules,
): SubscriptionState {
  const now = Date.now();
  const enrolled = Boolean(r.subscription_enrolled);
  const applies = cfg.enabled && (cfg.autoApply || enrolled);
  const expires = r.subscription_expires_at ? new Date(r.subscription_expires_at).getTime() : null;
  const explicitTrial = r.subscription_trial_ends_at
    ? new Date(r.subscription_trial_ends_at).getTime()
    : null;
  const startedAt = r.subscription_enrolled_at ?? r.created_at ?? null;
  const impliedTrial =
    explicitTrial === null && cfg.trialDays > 0 && startedAt
      ? new Date(startedAt).getTime() + cfg.trialDays * DAY
      : null;
  const trial = explicitTrial ?? impliedTrial;
  const until = [expires, trial].filter((v): v is number => v !== null).sort((a, b) => b - a)[0] ?? null;
  const inTrial = (expires === null || expires <= now) && until !== null && until > now;
  const exempt = Boolean(r.subscription_exempt);
  const locked =
    applies && !exempt && (until === null || until + cfg.graceDays * DAY < now);

  return {
    enabled: applies,
    master_enabled: cfg.enabled,
    auto_apply: cfg.autoApply,
    enrolled,
    enrolled_at: r.subscription_enrolled_at ?? null,
    notice_days: cfg.noticeDays,
    exempt,
    plan: (r.subscription_plan as PlanKey | null) ?? null,
    expires_at: r.subscription_expires_at ?? null,
    trial_ends_at: r.subscription_trial_ends_at ?? null,
    until: until === null ? null : new Date(until).toISOString(),
    in_trial: inTrial,
    days_left: until === null ? null : Math.ceil((until - now) / DAY),
    grace_days: cfg.graceDays,
    trial_days: cfg.trialDays,
    locked,
    store_allowed: !locked && (!applies || exempt || r.subscription_plan !== "panel"),
  };
}

/** Package buckets used by the admin reseller-list filter. */
export type PackageFilter = "all" | "active" | "trial" | "expiring" | "expired" | "free" | "out";

export const PACKAGE_FILTERS: PackageFilter[] = [
  "all",
  "active",
  "trial",
  "expiring",
  "expired",
  "free",
  "out",
];

export const PACKAGE_FILTER_LABELS: Record<PackageFilter, string> = {
  all: "All packages",
  active: "Package active",
  trial: "On free trial",
  expiring: "Expiring soon",
  expired: "Package expired",
  free: "Package free",
  out: "Not in package",
};

export function packageStateOf(state: SubscriptionState): Exclude<PackageFilter, "all"> {
  if (state.exempt) return "free";
  if (!state.enabled) return "out";
  if (state.locked) return "expired";
  if (state.in_trial) return "trial";
  const days = state.days_left ?? null;
  if (days !== null && days <= noticeWindow(state)) return "expiring";
  return "active";
}


export async function fetchSubscriptionOverview(resellerId?: string | null): Promise<SubscriptionOverview> {
  const { data, error } = await supabase.rpc("subscription_overview", {
    _reseller_id: resellerId ?? null,
  } as never);
  if (error || !data) return emptyOverview;
  const raw = data as unknown as Partial<SubscriptionOverview>;
  return {
    state: (raw.state as SubscriptionState) ?? emptyState,
    options: (raw.options as SubscriptionOption[]) ?? [],
    history: (raw.history as SubscriptionHistoryRow[]) ?? [],
    requests: (raw.requests as SubscriptionRequestRow[]) ?? [],
  };
}

/** Loads the package state, price options, history and payment requests. */
export function useSubscriptionOverview(resellerId?: string | null) {
  const [data, setData] = useState<SubscriptionOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setData(await fetchSubscriptionOverview(resellerId ?? null));
    setLoading(false);
  }, [resellerId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}

/** Cheapest monthly rate for a plan — used for the "from ৳x/mo" line. */
export function monthlyRate(options: SubscriptionOption[], plan: PlanKey): number {
  const rates = options.filter((o) => o.plan === plan).map((o) => o.price / Math.max(o.months, 1));
  return rates.length ? Math.min(...rates) : 0;
}
