/**
 * Panel lock for an expired monthly package.
 *
 * The whole reseller panel becomes read-only: pages that create or change data
 * are replaced by a renew screen, while the dashboard, the package page, the
 * profile and support stay open so the reseller can always pay.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Crown, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, planLabel, subscriptionFromBootstrap, type SubscriptionState } from "@/lib/subscription";
import { useAdvancedSettings } from "@/lib/advanced-settings";

/** Paths that keep working while the package is expired. */
const ALLOWED = ["/reseller", "/reseller/subscription", "/reseller/profile", "/reseller/support"];

export function useSubscriptionGate() {
  const [state, setState] = useState<SubscriptionState | null>(subscriptionFromBootstrap());

  useEffect(() => {
    if (state) return;
    let alive = true;
    void (async () => {
      const boot = subscriptionFromBootstrap();
      if (boot) {
        if (alive) setState(boot);
        return;
      }
      const { data } = await supabase.rpc("subscription_state", { _reseller_id: null } as never);
      if (alive && data) setState(data as unknown as SubscriptionState);
    })();
    return () => {
      alive = false;
    };
  }, [state]);

  return state;
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const state = useSubscriptionGate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const locked = Boolean(state?.enabled && state?.locked);
  const blocked = locked && !ALLOWED.includes(pathname.replace(/\/+$/, "") || "/reseller");

  return (
    <>
      {locked ? <SubscriptionLockedBanner state={state!} /> : <SubscriptionNotice />}
      {blocked ? <LockedScreen /> : children}
    </>
  );
}

function LockedScreen() {
  return (
    <div className="grid place-items-center py-16">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <Lock className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-bold">This page is locked</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your monthly package has expired, so the panel is read-only. Renew the package to unlock every page again.
        </p>
        <Link
          to="/reseller/subscription"
          className="btn-brand mt-5 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold"
        >
          <Sparkles className="h-4 w-4" /> Renew package
        </Link>
      </div>
    </div>
  );
}

export function SubscriptionLockedBanner({ state }: { state: SubscriptionState }) {
  const { settings } = useAdvancedSettings();
  const s = settings.subscription;
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 text-sm">
          <div className="font-bold text-destructive">{s.lockedTitle}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{s.lockedBody}</p>
        </div>
      </div>
      <Link
        to="/reseller/subscription"
        className="shrink-0 rounded-lg border bg-background px-3 py-2 text-center text-xs font-bold hover:bg-muted"
      >
        Renew package
      </Link>
    </div>
  );
}

/** Dashboard nudge shown while the package is still active but ending soon. */
export function SubscriptionNotice() {
  const state = useSubscriptionGate();
  const { settings } = useAdvancedSettings();
  if (!state?.enabled || state.exempt || state.locked) return null;
  const days = state.days_left ?? null;
  if (days === null || days > 7) return null;
  const s = settings.subscription;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 text-sm">
          <div className="font-bold text-amber-700 dark:text-amber-300">{s.noticeTitle}</div>
          <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-200/80">
            {planLabel(state.plan)} · valid until {formatDate(state.until)} ({days} days left). {s.noticeBody}
          </p>
        </div>
      </div>
      <Link
        to="/reseller/subscription"
        className="shrink-0 rounded-lg border border-amber-600/40 bg-background px-3 py-2 text-center text-xs font-bold text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
      >
        Renew package
      </Link>
    </div>
  );
}
