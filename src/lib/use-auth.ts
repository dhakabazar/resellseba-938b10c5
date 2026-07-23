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
  const version = ++authVersion;

  if (!session?.user) {
    publish({ session: null, user: null, roles: [], loading: false });
    return;
  }

  publish({ session, user: session.user, roles: authState.roles, loading: true });

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
      publish({ ...authState, session, user: session?.user ?? null });
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
