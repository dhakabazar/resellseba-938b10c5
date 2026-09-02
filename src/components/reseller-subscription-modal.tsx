/**
 * Admin modal: one reseller's monthly package.
 *
 * - see the current package, expiry and free trial at a glance (badges)
 * - add / extend a package manually (no payment needed)
 * - switch the reseller in or out of the package, or make it free
 * - set a special price for this reseller, per package and duration
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppModal } from "@/components/ui-kit/AppModal";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Crown,
  Loader2,
  Save,
  Sparkles,
  Store,
} from "lucide-react";
import {
  PLAN_KEYS,
  PLAN_META,
  PLAN_MONTHS,
  bdt,
  fetchSubscriptionOverview,
  formatDate,
  monthsLabel,
  noticeWindow,
  planLabel,
  type PlanKey,
  type SubscriptionOverview,
} from "@/lib/subscription";

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Small on/off switch used for the package flags. */
function Toggle({
  checked,
  onChange,
  title,
  hint,
  tone = "primary",
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint: string;
  tone?: "primary" | "muted";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition disabled:opacity-60 " +
        (checked
          ? tone === "primary"
            ? "border-primary/40 bg-primary/5"
            : "border-foreground/20 bg-muted/50"
          : "hover:bg-muted/40")
      }
    >
      <span
        className={
          "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition " +
          (checked ? "bg-primary" : "bg-muted-foreground/30")
        }
      >
        <span
          className={
            "h-4 w-4 rounded-full bg-background shadow transition " + (checked ? "translate-x-4" : "translate-x-0")
          }
        />
      </span>
      <span className="min-w-0 text-xs">
        <span className="font-semibold">{title}</span>
        <span className="block text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "danger" | "muted" | "trial";
}) {
  const cls =
    tone === "ok"
      ? "bg-success/15 text-success"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : tone === "danger"
          ? "bg-destructive/15 text-destructive"
          : tone === "trial"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function ResellerSubscriptionModal({
  reseller,
  onClose,
  onSaved,
}: {
  reseller: { id: string; business_name: string; code: string };
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<SubscriptionOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [exempt, setExempt] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [plan, setPlan] = useState<PlanKey | "">("");
  const [expires, setExpires] = useState("");
  const [trial, setTrial] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [grantPlan, setGrantPlan] = useState<PlanKey>("panel_store");
  const [grantMonths, setGrantMonths] = useState<number>(1);
  const [grantNote, setGrantNote] = useState("");

  function applyOverview(d: SubscriptionOverview) {
    setData(d);
    setExempt(Boolean(d.state.exempt));
    setEnrolled(Boolean(d.state.enrolled));
    setPlan((d.state.plan as PlanKey | null) ?? "");
    setExpires(toDateInput(d.state.expires_at));
    setTrial(toDateInput(d.state.trial_ends_at));
    const map: Record<string, string> = {};
    for (const o of d.options) if (o.is_custom) map[`${o.plan}:${o.months}`] = String(o.price);
    setPrices(map);
    if (d.state.plan) setGrantPlan(d.state.plan as PlanKey);
  }

  useEffect(() => {
    void (async () => applyOverview(await fetchSubscriptionOverview(reseller.id)))();
  }, [reseller.id]);

  const state = data?.state;
  const grantPrice = useMemo(
    () => data?.options.find((o) => o.plan === grantPlan && o.months === grantMonths)?.price ?? 0,
    [data, grantPlan, grantMonths],
  );

  /** Where the extension will land if it is applied right now. */
  const grantEndsAt = useMemo(() => {
    const base = state?.expires_at ? new Date(state.expires_at) : new Date();
    const from = base.getTime() > Date.now() ? base : new Date();
    const d = new Date(from);
    d.setMonth(d.getMonth() + grantMonths);
    return d.toISOString();
  }, [state?.expires_at, grantMonths]);

  const statusChips = useMemo(() => {
    if (!state) return null;
    const out: React.ReactNode[] = [];
    if (!state.master_enabled) out.push(<Chip key="off" tone="muted">Package system off</Chip>);
    if (state.exempt) out.push(<Chip key="free" tone="muted">Package free</Chip>);
    else if (!state.enabled)
      out.push(
        <Chip key="out" tone="muted">
          {state.enrolled ? "Enrolled · waiting for system" : "Not in package"}
        </Chip>,
      );

    else if (state.locked) out.push(<Chip key="lock" tone="danger"><AlertTriangle className="h-3 w-3" /> Expired · panel locked</Chip>);
    else if (state.in_trial)
      out.push(
        <Chip key="trial" tone="trial">
          <Sparkles className="h-3 w-3" /> Free trial{state.days_left !== null ? ` · ${state.days_left}d left` : ""}
        </Chip>,
      );
    else if ((state.days_left ?? 99) <= noticeWindow(state))
      out.push(<Chip key="soon" tone="warn"><CalendarClock className="h-3 w-3" /> {state.days_left}d left</Chip>);
    else
      out.push(
        <Chip key="ok" tone="ok">
          <BadgeCheck className="h-3 w-3" /> Active{state.days_left !== null ? ` · ${state.days_left}d left` : ""}
        </Chip>,
      );
    return out;
  }, [state]);

  async function save() {
    setBusy(true);
    const payload = {
      exempt,
      enrolled,
      plan: plan || null,
      expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      trial_ends_at: trial ? new Date(`${trial}T23:59:59`).toISOString() : null,
      prices: PLAN_KEYS.flatMap((p) =>
        PLAN_MONTHS.map((m) => ({ plan: p, months: m, price: prices[`${p}:${m}`]?.trim() || null })),
      ),
    };
    const { error } = await supabase.rpc("admin_subscription_save", {
      _reseller_id: reseller.id,
      _payload: payload as never,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Package settings saved");
    applyOverview(await fetchSubscriptionOverview(reseller.id));
    onSaved?.();
  }

  async function grant() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_subscription_extend", {
      _reseller_id: reseller.id,
      _plan: grantPlan,
      _months: grantMonths,
      _amount: null,
      _note: grantNote.trim() || "Manually granted by admin",
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${planLabel(grantPlan)} extended by ${monthsLabel(grantMonths)}`);
    setGrantNote("");
    applyOverview(await fetchSubscriptionOverview(reseller.id));
    onSaved?.();
  }

  return (
    <AppModal
      open
      onClose={onClose}
      title={`Monthly package · ${reseller.business_name}`}
      subtitle={`Package, price and expiry for ${reseller.code}.`}
      size="lg"
    >
      {!data || !state ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Current state */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                <Crown className="h-4 w-4" /> {planLabel(state.plan)}
              </span>
              {statusChips}
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
              <span>Paid until: {formatDate(state.expires_at)}</span>
              <span>Trial until: {formatDate(state.trial_ends_at)}</span>
              <span>Access until: {formatDate(state.until)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PLAN_KEYS.map((p) => {
                const isCurrent = state.plan === p;
                const live = isCurrent && !state.locked && (state.enabled || state.exempt);
                return (
                  <Chip key={p} tone={live ? "ok" : isCurrent ? "warn" : "muted"}>
                    {p === "panel_store" ? <Store className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
                    {PLAN_META[p].short} · {live ? "Active" : isCurrent ? "Inactive" : "Not set"}
                  </Chip>
                );
              })}
            </div>
          </div>

          {!state.master_enabled && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="min-w-0">
                The monthly package system is switched off, so nothing here is enforced yet. Turn it on in the
                package rules.
              </span>
              <Link
                to="/admin/subscriptions"
                onClick={onClose}
                className="ml-auto rounded-md border bg-background px-2.5 py-1 font-semibold"
              >
                Open rules
              </Link>
            </div>
          )}

          {/* Add / extend a plan */}
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Add / extend a plan
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adds the duration on top of the current expiry and puts the reseller in the package — no payment
              required.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PLAN_KEYS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setGrantPlan(p)}
                  className={
                    "rounded-lg border p-3 text-left text-xs transition " +
                    (grantPlan === p ? "border-primary bg-background ring-1 ring-primary/30" : "bg-background/60 hover:bg-background")
                  }
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    {p === "panel_store" ? <Store className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
                    {PLAN_META[p].label}
                    {grantPlan === p && <BadgeCheck className="ml-auto h-4 w-4 text-primary" />}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">{PLAN_META[p].blurb}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PLAN_MONTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGrantMonths(m)}
                  className={
                    "rounded-md border bg-background px-3 py-1.5 text-xs font-semibold transition " +
                    (grantMonths === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50")
                  }
                >
                  {monthsLabel(m)}
                </button>
              ))}
            </div>
            <input
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              className={inp + " mt-2"}
              placeholder="Note (optional)"
            />
          </section>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Value <span className="font-semibold text-foreground tabular-nums">{bdt(grantPrice)}</span> · new
                expiry <span className="font-semibold text-foreground">{formatDate(grantEndsAt)}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void grant()}
                className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Add
                plan
              </button>
            </div>
          </section>

          {/* Package flags + dates */}
          <section className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Package & dates</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle
                checked={enrolled}
                onChange={(v) => {
                  setEnrolled(v);
                  if (v) setExempt(false);
                }}
                title="Package ON for this reseller"
                hint={
                  state.master_enabled
                    ? "Already included by the master switch — keep this on to force it even if the master switch is turned off later."
                    : "Master switch is off, but this reseller still has to pay for a package."
                }
              />
              <Toggle
                checked={exempt}
                onChange={(v) => {
                  setExempt(v);
                  if (v) setEnrolled(false);
                }}
                tone="muted"
                title="Package OFF for this reseller"
                hint="Free access — this account is never asked to pay and is never locked, even when the master switch is on."
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="text-xs font-medium">
                Current package
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {([["", "None"], ...PLAN_KEYS.map((p) => [p, PLAN_META[p].short] as const)] as const).map(
                    ([value, label]) => (
                      <button
                        key={value || "none"}
                        type="button"
                        onClick={() => setPlan(value as PlanKey | "")}
                        className={
                          "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition " +
                          (plan === value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50")
                        }
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <label className="text-xs font-medium">
                Paid until
                <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inp + " mt-1"} />
              </label>
              <label className="text-xs font-medium">
                Free trial until
                <input type="date" value={trial} onChange={(e) => setTrial(e.target.value)} className={inp + " mt-1"} />
              </label>
            </div>
          </section>

          {/* Custom prices — only the selected package is editable */}
          <section className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Special price for this reseller</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {plan
                ? `Only ${PLAN_META[plan].label} is editable — that is the package set above. Leave a field empty to use the global price.`
                : "Pick a current package above to set a special price. Leave a field empty to use the global price."}
            </p>
            <div className="mt-3 space-y-3">
              {PLAN_KEYS.map((p) => {
                const locked = plan !== p;
                return (
                  <div key={p} className={locked ? "opacity-50" : ""}>
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                      {PLAN_META[p].label}
                      {!locked && <Chip tone="trial">Selected package</Chip>}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {PLAN_MONTHS.map((m) => {
                        const base = data.options.find((o) => o.plan === p && o.months === m)?.base_price ?? 0;
                        const key = `${p}:${m}`;
                        return (
                          <label key={m} className="text-[11px] text-muted-foreground">
                            {monthsLabel(m)} · global {bdt(base)}
                            <input
                              value={prices[key] ?? ""}
                              onChange={(e) => setPrices((s) => ({ ...s, [key]: e.target.value }))}
                              className={inp + " mt-1"}
                              inputMode="decimal"
                              disabled={locked}
                              placeholder="Global price"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-xs font-semibold">
              Close
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save changes
            </button>
          </div>
        </div>
      )}
    </AppModal>
  );
}
