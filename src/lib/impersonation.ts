import { supabase } from "@/integrations/supabase/client";

const KEY = "impersonation:admin-session";

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

/**
 * Swaps the current admin session for the reseller session created from a
 * one-time token, remembering where the admin came from.
 */
export async function startImpersonation(opts: { tokenHash: string; label: string; returnTo: string }) {
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

  const { error } = await supabase.auth.verifyOtp({ token_hash: opts.tokenHash, type: "magiclink" });
  if (error) {
    clearImpersonation();
    throw new Error(error.message);
  }
}

/** Restores the stored admin session and returns the page the admin left. */
export async function stopImpersonation(): Promise<string> {
  const snapshot = readImpersonation();
  if (!snapshot) return "/admin";
  const { error } = await supabase.auth.setSession({
    access_token: snapshot.access_token,
    refresh_token: snapshot.refresh_token,
  });
  clearImpersonation();
  if (error) throw new Error(error.message);
  return snapshot.returnTo || "/admin";
}
