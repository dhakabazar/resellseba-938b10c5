import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "super_admin" | "reseller" | "leader" | "staff";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: Role[];
  loading: boolean;
}

const listeners = new Set<(state: AuthState) => void>();
let initialized = false;
let authVersion = 0;

let authState: AuthState = {
  session: null,
  user: null,
  roles: [],
  loading: true,
};

function publish(next: AuthState) {
  authState = next;
  listeners.forEach((listener) => listener(authState));
}

async function loadRoles(userId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) return [];
  return (data ?? []).map((row) => row.role as Role);
}

function applySession(session: Session | null) {
  if (!session?.user) {
    authVersion++;
    publish({ session: null, user: null, roles: [], loading: false });
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

  publish({ session, user: session.user, roles: [], loading: true });

  void loadRoles(session.user.id).then((roles) => {
    if (version !== authVersion) return;
    publish({ session, user: session.user, roles, loading: false });
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

    applySession(session);
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
