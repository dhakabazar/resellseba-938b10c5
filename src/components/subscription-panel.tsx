/**
 * Reseller-facing monthly package panel.
 *
 * Package cards (Panel only / Panel + Storefront) with 1, 6 and 12 month
 * durations, then one payment step that works exactly like the security
 * deposit: any active manual wallet (admin verifies the TrxID) or any active
 * automatic gateway (activates itself once the gateway confirms).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Crown,
  Loader2,
  Send,
  Sparkles,
  Store,
  XCircle,
  Zap,
} from "lucide-react";
import { startSubscriptionPayment } from "@/lib/gateways.functions";
import { gatewayLabel } from "@/lib/gateways/registry";
import { cfgString, fetchDepositMethods, type PaymentConfigRow } from "@/lib/payment-methods";
import { PaymentLogo } from "@/components/payments/payment-brand";
import {
  PLAN_KEYS,
  PLAN_META,
  bdt,
  formatDate,
  monthsLabel,
  planLabel,
  useSubscriptionOverview,
  type PlanKey,
  type SubscriptionOption,
} from "@/lib/subscription";

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type UnifiedMethod = {
  id: string;
  label: string;
  kind: "manual" | "online";
  method: string;
  account?: string;
  accountType?: string;
};

export function SubscriptionStatusCard({
  state,
  onRenew,
}: {
  state: {
    enabled: boolean;
    locked: boolean;
    exempt?: boolean;
    plan?: string | null;
    until?: string | null;
    in_trial?: boolean;
    days_left?: number | null;
  };
  onRenew?: () => void;
}) {
  if (!state.enabled) return null;
  const tone = state.exempt
    ? "border-primary/30 bg-primary/5"
    : state.locked
      ? "border-destructive/40 bg-destructive/10"
      : (state.days_left ?? 99) <= 7
        ? "border-amber-500/40 bg-amber-500/10"
        : "border-success/40 bg-success/10";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${tone}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Crown className="h-4 w-4" />
          {state.exempt ? "Package not required for your account" : planLabel(state.plan)}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {state.exempt ? (
            "An admin has made your account free of the monthly package."
          ) : state.locked ? (
            "The package has expired — the panel is read-only until you renew."
          ) : (
            <>
              {state.in_trial ? "Free trial" : "Active"} until{" "}
              <span className="font-semibold text-foreground">{formatDate(state.until)}</span>
              {state.days_left !== null && state.days_left !== undefined && ` · ${state.days_left} days left`}
            </>
          )}
        </p>
      </div>
      {!state.exempt && onRenew && (
        <button
          type="button"
          onClick={onRenew}
          className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold"
        >
          <Sparkles className="h-3.5 w-3.5" /> {state.locked ? "Renew now" : "Renew / upgrade"}
        </button>
      )}
    </div>
  );
}

export function SubscriptionPanel({ resellerId }: { resellerId: string | null }) {
  const { data, loading, reload } = useSubscriptionOverview(resellerId);
  const [plan, setPlan] = useState<PlanKey>("panel_store");
  const [months, setMonths] = useState<number>(1);
  const [methods, setMethods] = useState<PaymentConfigRow[]>([]);
  const [gateways, setGateways] = useState<{ provider: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const startOnline = useServerFn(startSubscriptionPayment);

  useEffect(() => {
    void (async () => {
      const [list, gw] = await Promise.all([fetchDepositMethods(), supabase.rpc("get_active_payment_gateways")]);
      setMethods(list);
      setGateways(
        ((gw.data ?? []) as { provider: string; label: string | null }[]).map((g) => ({
          provider: g.provider,
          label: g.label || gatewayLabel(g.provider),
        })),
      );
    })();
  }, []);

  useEffect(() => {
    if (data.state.plan) setPlan(data.state.plan as PlanKey);
  }, [data.state.plan]);

  const unified = useMemo<UnifiedMethod[]>(() => {
    const manual: UnifiedMethod[] = methods.map((m) => ({
      id: m.id,
      label: m.label,
      kind: "manual",
      method: m.method,
      account: cfgString(m.config, "account") || undefined,
      accountType: cfgString(m.config, "account_type") || undefined,
    }));
    const online: UnifiedMethod[] = gateways.map((g) => ({
      id: `gw:${g.provider}`,
      label: g.label,
      kind: "online",
      method: g.provider,
    }));
    return [...manual, ...online];
  }, [methods, gateways]);

  useEffect(() => {
    if (!selectedId && unified.length > 0) setSelectedId(unified[0]!.id);
  }, [unified, selectedId]);

  const selected = unified.find((m) => m.id === selectedId) ?? null;
  const option = data.options.find((o) => o.plan === plan && o.months === months) ?? null;
  const price = option?.price ?? 0;

  async function payOnline() {
    if (!selected || selected.kind !== "online") return toast.error("Select a payment method");
    setBusy(true);
    try {
      const res = await startOnline({
        data: {
          provider: selected.id.replace(/^gw:/, ""),
          plan,
          months: months as 1 | 6 | 12,
          storeOrigin: window.location.origin,
        },
      });
      if (res?.redirectUrl) window.location.href = res.redirectUrl;
      else toast.error("Could not start the payment");
    } catch (err: any) {
      toast.error(typeof err?.message === "string" ? err.message : "Could not start the payment");
    } finally {
      setBusy(false);
    }
  }

  async function submitManual() {
    if (!resellerId) return;
    if (!selected || selected.kind !== "manual") return toast.error("Select a payment method");
    if (!reference.trim()) return toast.error("Transaction ID (TrxID) is required");
    setBusy(true);
    const { error } = await supabase.from("subscription_requests").insert({
      reseller_id: resellerId,
      plan,
      months,
      amount: price,
      method: selected.method,
      payment_config_id: selected.id,
      reference: reference.trim(),
      note: note.trim() || null,
    } as never);

    setBusy(false);
    if (error) return toast.error(error.message);
    setReference("");
    setNote("");
    toast.success("Payment submitted — waiting for admin verification");
    void reload();
  }

  if (loading)
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  if (!data.state.enabled)
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Monthly packages are not in use right now — your panel access is free.
      </div>
    );

  return (
    <div className="space-y-5">
      <SubscriptionStatusCard state={data.state} />

      {!data.state.exempt && (
        <>
          {/* Package cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_KEYS.map((key) => {
              const meta = PLAN_META[key];
              const active = plan === key;
              const opts = data.options.filter((o) => o.plan === key).sort((a, b) => a.months - b.months);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlan(key)}
                  className={
                    "rounded-2xl border p-4 text-left transition " +
                    (active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/40")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {key === "panel_store" ? <Store className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                      {meta.label}
                    </span>
                    {active && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.blurb}</p>
                  <ul className="mt-3 space-y-1">
                    {meta.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {opts.map((o) => (
                      <span
                        key={o.months}
                        className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                      >
                        {monthsLabel(o.months)} · {bdt(o.price)}
                        {o.is_custom && <span className="ml-1 text-primary">special</span>}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Duration */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.options
                .filter((o) => o.plan === plan)
                .sort((a, b) => a.months - b.months)
                .map((o) => (
                  <DurationCard key={o.months} option={o} active={o.months === months} onPick={() => setMonths(o.months)} />
                ))}
            </div>
          </div>

          {/* Payment */}
          {unified.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No payment method is active yet. Please contact support.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pay with</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {unified.map((m) => {
                  const active = m.id === selectedId;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={
                        "rounded-xl border p-3 text-left transition-colors " +
                        (active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background p-1">
                            <PaymentLogo method={m.method} size={24} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{m.label}</span>
                            <span
                              className={
                                "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide " +
                                (m.kind === "online" ? "text-primary" : "text-muted-foreground")
                              }
                            >
                              {m.kind === "online" ? (
                                <>
                                  <Zap className="h-3 w-3" /> Automatic
                                </>
                              ) : (
                                "Manual"
                              )}
                            </span>
                          </span>
                        </span>
                        {active && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      {m.account && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="tabular-nums">{m.account}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(m.account!);
                              toast.success("Number copied");
                            }}
                            onKeyDown={() => {}}
                            className="rounded p-0.5 hover:bg-muted"
                          >
                            <Copy className="h-3 w-3" />
                          </span>
                          {m.accountType && <span>· {m.accountType}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold">
                    {PLAN_META[plan].label} · {monthsLabel(months)}
                  </span>
                  <span className="text-base font-bold tabular-nums text-primary">{bdt(price)}</span>
                  {option?.is_custom && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Special price for your account
                    </span>
                  )}
                </div>

                {selected?.kind === "manual" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium">TrxID / reference *</label>
                      <input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} placeholder="8N7A2K9QX1" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">Note</label>
                      <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="Optional" />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    You'll be taken to the gateway. The package activates automatically once the payment is
                    confirmed — no admin approval needed.
                  </p>
                )}

                <div className="mt-3 flex justify-end">
                  {selected?.kind === "manual" ? (
                    <button
                      type="button"
                      disabled={busy || !(price > 0)}
                      onClick={() => void submitManual()}
                      className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Submit payment
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !(price > 0)}
                      onClick={() => void payOnline()}
                      className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Pay {bdt(price)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {data.requests.length > 0 && (
        <div className="rounded-xl border">
          <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold">My package payments</div>
          <div className="divide-y">
            {data.requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
                <span className="font-semibold tabular-nums">{bdt(r.amount)}</span>
                <span className="text-muted-foreground">
                  {planLabel(r.plan)} · {monthsLabel(r.months)}
                </span>
                <span className="text-muted-foreground">{r.reference ?? "—"}</span>
                <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                <span className="ml-auto">
                  <SubStatusChip status={r.status} />
                </span>
                {r.admin_note && <div className="w-full text-muted-foreground">Admin: {r.admin_note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.history.length > 0 && (
        <div className="rounded-xl border">
          <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold">Package history</div>
          <div className="divide-y">
            {data.history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {planLabel(h.plan)} · {monthsLabel(h.months)}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(h.starts_at)} → {formatDate(h.ends_at)}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{bdt(h.amount)}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {h.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DurationCard({
  option,
  active,
  onPick,
}: {
  option: SubscriptionOption;
  active: boolean;
  onPick: () => void;
}) {
  const perMonth = option.price / Math.max(option.months, 1);
  return (
    <button
      type="button"
      onClick={onPick}
      className={
        "rounded-xl border p-3 text-left transition " +
        (active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/40")
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{monthsLabel(option.months)}</span>
        {active && <BadgeCheck className="h-4 w-4 text-primary" />}
      </div>
      <div className="mt-1 text-base font-bold tabular-nums">{bdt(option.price)}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">{bdt(Math.round(perMonth))} / month</div>
    </button>
  );
}

export function SubStatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    pending: {
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    approved: {
      cls: "bg-success/15 text-success",
      icon: <BadgeCheck className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      cls: "bg-destructive/15 text-destructive",
      icon: <XCircle className="h-3 w-3" />,
      label: "Rejected",
    },
  };
  const m = map[status] ?? map.pending!;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}
