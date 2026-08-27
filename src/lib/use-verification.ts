import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdvancedSettings, pendingChannels } from "@/lib/advanced-settings";
import { useAuth } from "@/lib/use-auth";

export type VerifyState = {
  emailVerified: boolean;
  phoneVerified: boolean;
  emailSentAt: string | null;
  smsSentAt: string | null;
};

const EMPTY: VerifyState = { emailVerified: false, phoneVerified: false, emailSentAt: null, smsSentAt: null };

/** Shared per-user lookup so several mounted screens cost one call, not one each. */
let cached: { userId: string; promise: Promise<VerifyState> } | null = null;

function fetchVerifyState(userId: string, force = false): Promise<VerifyState> {
  if (!force && cached && cached.userId === userId) return cached.promise;
  const promise = (async () => {
    // The panel bootstrap already carries verification state — reuse it.
    const primed = getPanelBootstrapPayload()?.verify;
    const { data } = primed ? { data: primed } : await supabase.rpc("verify_state");

    const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
    return {
      emailVerified: Boolean(row?.email_verified_at),
      phoneVerified: Boolean(row?.phone_verified_at),
      emailSentAt: row?.email_sent_at ?? null,
      smsSentAt: row?.sms_sent_at ?? null,
    } satisfies VerifyState;
  })().catch((e) => {
    if (cached?.promise === promise) cached = null;
    throw e;
  });
  cached = { userId, promise };
  return promise;
}

/**
 * Verification gate for reseller-side screens.
 * Admin / staff accounts are never blocked.
 */
export function useVerification() {
  const { settings, loading: settingsLoading } = useAdvancedSettings();
  const { user, roles, loading: authLoading } = useAuth();
  const [state, setState] = useState<VerifyState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const isStaff = roles.includes("super_admin") || roles.includes("staff");

  const refresh = useCallback(
    async (force = true) => {
      if (!user) return;
      setState(await fetchVerifyState(user.id, force));
      setLoading(false);
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    // Staff/admin accounts are never gated, so their state is never fetched.
    if (!user || isStaff) {
      setLoading(false);
      return;
    }
    void refresh(false);
  }, [authLoading, user, isStaff, refresh]);


  const staff = roles.includes("super_admin") || roles.includes("staff");
  const pending = staff ? [] : pendingChannels(settings, state);

  return {
    settings,
    state,
    pending,
    refresh,
    /** true while we still don't know whether the user must verify */
    loading: loading || settingsLoading || authLoading,
    required: pending.length > 0,
  };
}
