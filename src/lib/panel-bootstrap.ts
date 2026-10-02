/**
 * Panel bootstrap.
 *
 * One `panel_bootstrap()` database call carries everything the signed-in shell
 * needs: global settings, roles, permissions, the reseller row + store
 * branding, verification state, live notices and the deposit ledger. The
 * payload primes each feature cache, so dashboard pages only ever fetch their
 * own page payload afterwards.
 *
 * Nothing is hardcoded here — the backend comes from env through the generated
 * client, so a self-hosted backend needs no code change.
 */
export type PanelBootstrap = {
  signed_in: boolean;
  settings: Record<string, unknown> | null;
  roles: string[];
  permissions: string[];
  verify: {
    email_verified_at: string | null;
    phone_verified_at: string | null;
    email_sent_at: string | null;
    sms_sent_at: string | null;
  } | null;
  reseller: {
    id: string;
    code: string;
    business_name: string;
    status: string;
    avatar_url: string | null;
    deposit_required: boolean | null;
    deposit_required_amount: number | null;
    frozen_amount: number | null;
    subscription_plan?: string | null;
    subscription_expires_at?: string | null;
    subscription_trial_ends_at?: string | null;
    subscription_exempt?: boolean | null;
    /** Live verified custom domain (hostname, no scheme) — falls back to /s/<code>. */
    primary_domain?: string | null;
  } | null;
  /** Monthly package state for the signed-in reseller (null for staff). */
  subscription: {
    enabled: boolean;
    locked: boolean;
    store_allowed: boolean;
    plan?: string | null;
    expires_at?: string | null;
    trial_ends_at?: string | null;
    until?: string | null;
    in_trial?: boolean;
    days_left?: number | null;
    exempt?: boolean;
    grace_days?: number;
    trial_days?: number;
  } | null;
  /** Set when the signed-in user is a staff account of a reseller store. */
  reseller_staff?: {
    id: string;
    reseller_id: string;
    full_name: string | null;
    permissions: string[];
    active: boolean;
  } | null;
  reseller_settings: { logo_url: string | null; primary_color: string | null } | null;
  deposits: { id: string; amount: number; method: string | null; reference: string | null; note: string | null; created_at: string }[];
  notices: any[];
};

let current: PanelBootstrap | null = null;
let pending: Promise<void> | null = null;
let settle: (() => void) | null = null;

/** Called when the bootstrap request starts, so other caches can wait for it. */
export function markPanelBootstrapPending() {
  if (pending) return;
  pending = new Promise<void>((resolve) => {
    settle = resolve;
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** True when a signed-in session is stored, so a bootstrap call is expected. */
function hasStoredSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    /* storage unavailable (SSR) */
  }
  return false;
}

/**
 * Waits briefly for the panel bootstrap when a session exists, so shared caches
 * reuse its payload instead of firing their own duplicate query. Public pages
 * (no session) return immediately.
 */
export async function waitForPanelBootstrap(maxMs = 800): Promise<PanelBootstrap | null> {
  if (current) return current;
  if (typeof window === "undefined" || !hasStoredSession()) return null;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (current) return current;
    if (pending) {
      await Promise.race([pending, sleep(Math.max(deadline - Date.now(), 0))]);
      return current;
    }
    await sleep(40);
  }
  return current;
}

/** Resolves once the bootstrap payload landed (or `null` when none is in flight). */
export function panelBootstrapPending() {
  return pending;
}

function finishPending() {
  settle?.();
  settle = null;
  pending = null;
}

/** Latest bootstrap payload (null before sign-in completes). */
export function getPanelBootstrapPayload() {
  return current;
}

export function setPanelBootstrapPayload(payload: PanelBootstrap | null) {
  current = payload;
  finishPending();
}

export function clearPanelBootstrapPayload() {
  current = null;
  finishPending();
}
