import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "super_admin" | "reseller" | "leader" | "staff";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: Role[];
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRoles(userId: string) {
      if (lastUserId.current === userId) return;
      lastUserId.current = userId;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!mounted) return;
      setRoles((data ?? []).map((r) => r.role as Role));
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s?.user) {
        void loadRoles(s.user.id);
      } else {
        lastUserId.current = null;
        setRoles([]);
      }
      if (event === "INITIAL_SESSION") setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) void loadRoles(data.session.user.id);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    roles,
    loading,
  };
}

export function hasRole(roles: Role[], r: Role) {
  return roles.includes(r);
}
