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
