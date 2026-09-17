import { supabase } from "@/integrations/supabase/client";
import { refreshAuthState } from "@/lib/use-auth";

const KEY = "impersonation:admin-session";
const RETURN_KEY = "impersonation:return-to";

export type ImpersonationSnapshot = {
  access_token: string;
  refresh_token: string;
  returnTo: string;
  label: string;
};

export function readImpersonation(): ImpersonationSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ImpersonationSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearImpersonation() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

export function consumeImpersonationReturnTarget() {
  if (typeof window === "undefined") return null;
  const target = sessionStorage.getItem(RETURN_KEY);
  if (target) sessionStorage.removeItem(RETURN_KEY);
  return target;
}

export function rememberImpersonationReturnTarget(target: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(RETURN_KEY, target);
}

/** Swaps the current admin session for the reseller session, remembering where the admin came from. */
export async function startImpersonation(opts: { email: string; password: string; label: string; returnTo: string }) {
  const { data: current } = await supabase.auth.getSession();
  const session = current.session;
  if (!session) throw new Error("Your admin session expired — sign in again.");

  const snapshot: ImpersonationSnapshot = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    returnTo: opts.returnTo,
    label: opts.label,
  };
  localStorage.setItem(KEY, JSON.stringify(snapshot));

  const { error } = await supabase.auth.signInWithPassword({
    email: opts.email,
    password: opts.password,
  });
  if (error) {
    clearImpersonation();
    await restoreResellerPassword();
    throw new Error(error.message);
  }
  // Put the reseller's own password back immediately — the temporary one was
  // only needed to obtain this session, so their real password never changes.
  await restoreResellerPassword();
  await refreshAuthState();
}

/** Restores the impersonated reseller's original password (safe to call twice). */
async function restoreResellerPassword() {
  try {
    await supabase.rpc("admin_impersonation_restore" as never, {} as never);
  } catch {
    /* the next impersonation or admin action retries */
  }
}

/** Restores the stored admin session and returns the page the admin left. */
export async function stopImpersonation(): Promise<string> {
  const snapshot = readImpersonation();
  if (!snapshot) return "/admin";
  rememberImpersonationReturnTarget(snapshot.returnTo || "/admin");
  const { error } = await supabase.auth.setSession({
    access_token: snapshot.access_token,
    refresh_token: snapshot.refresh_token,
  });
  clearImpersonation();
  if (error) throw new Error(error.message);
  await refreshAuthState();
  return snapshot.returnTo || "/admin";
}
