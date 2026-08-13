import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "super_admin" | "reseller" | "leader" | "staff";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: Role[];
  permissions: string[];
  loading: boolean;
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
};

function publish(next: AuthState) {
  authState = next;
  listeners.forEach((listener) => listener(authState));
}

async function loadAccess(userId: string): Promise<{ roles: Role[]; permissions: string[] }> {
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
      return { roles: [], permissions: [] };
    }
    const [rolesRes, permsRes] = res;

    if (rolesRes.error) console.error("Error loading roles:", rolesRes.error);
    if (permsRes.error) console.error("Error loading permissions:", permsRes.error);

    const roles = rolesRes.error ? [] : (rolesRes.data ?? []).map((row: any) => row.role as Role);
    const permissions = permsRes.error ? [] : ((permsRes.data as string[] | null) ?? []);

    return { roles, permissions };
  } catch (err) {
    console.error("Failed to load access data:", err);
    return { roles: [], permissions: [] };
  }
}

function applySession(session: Session | null) {
  if (!session?.user) {
    authVersion++;
    publish({ session: null, user: null, roles: [], permissions: [], loading: false });
    return;
  }

  // Auth can emit INITIAL_SESSION or SIGNED_IN again when a background tab
  // becomes active and the persisted session is recovered. The user has not
  // changed in that case, so putting auth back into a loading state would
  // temporarily unmount the protected layout and destroy every open form or
  // modal. Refresh the session object without disturbing the mounted panel.
  if (authState.user?.id === session.user.id) {
    // Keep the SAME user object identity so that `useEffect(..., [user])` in the
    // admin/reseller panels does not re-run and re-fetch (which would wipe
    // unsaved form state and reset open modals).
    publish({
      ...authState,
      session,
    });
    return;
  }


  const version = ++authVersion;

  publish({ session, user: session.user, roles: [], permissions: [], loading: true });

  void loadAccess(session.user.id)
    .then(({ roles, permissions }) => {
      if (version !== authVersion) return;
      publish({ session, user: session.user, roles, permissions, loading: false });
    })
    .catch((err) => {
      if (version !== authVersion) return;
      publish({ session, user: session.user, roles: [], permissions: [], loading: false });
    });
}

function initAuth() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => applySession(data.session));

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") {
      publish({ ...authState, session });
      return;
    }

    // NEVER await supabase calls inside this callback: the auth client holds an
    // internal lock while it runs, so any query issued here deadlocks and the
    // panel stays on a loading spinner forever (exactly what happens right
    // after sign-in). Defer the role/permission lookup to a fresh task.
    setTimeout(() => applySession(session), 0);
  });
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
