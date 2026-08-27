import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearAppDataCache } from "@/lib/app-data";

export type Role = "super_admin" | "reseller" | "leader" | "staff";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: Role[];
  permissions: string[];
  loading: boolean;
  /** true when the role/permission lookup failed — do NOT treat as "no roles". */
  accessError: boolean;
}

const listeners = new Set<(state: AuthState) => void>();
let initialized = false;
let authVersion = 0;

let authState: AuthState = {
  session: null,
  user: null,
  roles: [],
  permissions: [],
  loading: true,
  accessError: false,
};

function publish(next: AuthState) {
  authState = next;
  listeners.forEach((listener) => listener(authState));
}

async function loadAccessOnce(
  userId: string,
): Promise<{ roles: Role[]; permissions: string[]; error: boolean }> {
  // Hard timeout: metadata fetching must never keep the panel on a spinner.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
  try {
    const work = Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.rpc("my_permissions"),
    ]);

    const res = await Promise.race([work, timeout]);
    if (!res) {
      console.error("Access lookup timed out");
      return { roles: [], permissions: [], error: true };
    }
    const [rolesRes, permsRes] = res;

    if (rolesRes.error) console.error("Error loading roles:", rolesRes.error);
    if (permsRes.error) console.error("Error loading permissions:", permsRes.error);

    const roles = rolesRes.error ? [] : (rolesRes.data ?? []).map((row: any) => row.role as Role);
    const permissions = permsRes.error ? [] : ((permsRes.data as string[] | null) ?? []);

    return { roles, permissions, error: Boolean(rolesRes.error) };
  } catch (err) {
    console.error("Failed to load access data:", err);
    return { roles: [], permissions: [], error: true };
  }
}

/**
 * Roles decide where a signed-in user lands. A transient failure (network blip,
 * token not attached yet) used to look like "this user has no roles", which sent
 * an existing reseller to the "Become a reseller" form. Retry before believing it.
 */
let accessInflight: { userId: string; promise: Promise<{ roles: Role[]; permissions: string[]; error: boolean }> } | null = null;

async function loadAccess(
  userId: string,
): Promise<{ roles: Role[]; permissions: string[]; error: boolean }> {
  // getSession() and the INITIAL_SESSION event both land here for the same user;
  // share one lookup so roles/permissions are fetched once per sign-in.
  if (accessInflight && accessInflight.userId === userId) return accessInflight.promise;
  const promise = (async () => {
    let last = await loadAccessOnce(userId);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!last.error && last.roles.length > 0) return last;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      const next = await loadAccessOnce(userId);
      if (!next.error && next.roles.length > 0) return next;
      if (!next.error) last = next;
    }
    return last;
  })();
  accessInflight = { userId, promise };
  promise.finally(() => {
    if (accessInflight?.promise === promise) accessInflight = null;
  });
  return promise;
}



async function applySession(session: Session | null, opts: { forceAccessReload?: boolean } = {}) {
  if (!session?.user) {
    clearAppDataCache();
    authVersion++;
    publish({ session: null, user: null, roles: [], permissions: [], loading: false, accessError: false });
    return authState;
  }

  // Auth can emit INITIAL_SESSION or SIGNED_IN again when a background tab
  // becomes active and the persisted session is recovered. The user has not
  // changed in that case, so putting auth back into a loading state would
  // temporarily unmount the protected layout and destroy every open form or
  // modal. Refresh the session object without disturbing the mounted panel.
  if (authState.user?.id === session.user.id && !opts.forceAccessReload) {
    // Keep the SAME user object identity so that `useEffect(..., [user])` in the
    // admin/reseller panels does not re-run and re-fetch (which would wipe
    // unsaved form state and reset open modals).
    publish({
      ...authState,
      session,
    });
    return authState;
  }

  // Only wipe cached reseller data when the signed-in identity really changed;
  // repeated INITIAL_SESSION/SIGNED_IN events for the same user must not refetch.
  if (lastAppliedUser !== session.user.id) clearAppDataCache("reseller");
  lastAppliedUser = session.user.id;
  const version = ++authVersion;


  publish({ session, user: session.user, roles: [], permissions: [], loading: true, accessError: false });

  try {
    const { roles, permissions, error } = await loadAccess(session.user.id);
    if (version !== authVersion) return authState;
    publish({ session, user: session.user, roles, permissions, loading: false, accessError: error });
  } catch {
    if (version !== authVersion) return authState;
    publish({ session, user: session.user, roles: [], permissions: [], loading: false, accessError: true });
  }

  return authState;
}

function initAuth() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => void applySession(data.session));

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") {
      publish({ ...authState, session });
      return;
    }

    // NEVER await supabase calls inside this callback: the auth client holds an
    // internal lock while it runs, so any query issued here deadlocks and the
    // panel stays on a loading spinner forever (exactly what happens right
    // after sign-in). Defer the role/permission lookup to a fresh task.
    setTimeout(() => void applySession(session), 0);
  });
}

export async function refreshAuthState() {
  const { data } = await supabase.auth.getSession();
  return applySession(data.session, { forceAccessReload: true });
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    initAuth();
    listeners.add(setState);
    setState(authState);

    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

export function hasRole(roles: Role[], r: Role) {
  return roles.includes(r);
}

/**
 * Permission gate for UI actions. Super admin always passes; staff pass when
 * their custom role holds at least one of the listed permissions.
 */
export function useCan() {
  const { roles, permissions } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  return (...needed: string[]) =>
    isSuperAdmin || needed.some((permission) => permissions.includes(permission));
}

