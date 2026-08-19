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

/**
 * Verification gate for reseller-side screens.
 * Admin / staff accounts are never blocked.
 */
export function useVerification() {
  const { settings, loading: settingsLoading } = useAdvancedSettings();
  const { user, roles, loading: authLoading } = useAuth();
  const [state, setState] = useState<VerifyState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("verify_state");
    const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
    setState({
      emailVerified: Boolean(row?.email_verified_at),
      phoneVerified: Boolean(row?.phone_verified_at),
      emailSentAt: row?.email_sent_at ?? null,
      smsSentAt: row?.sms_sent_at ?? null,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, user, refresh]);

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
