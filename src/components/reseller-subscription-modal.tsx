/**
 * Admin modal: one reseller's monthly package.
 *
 * - see the current package, expiry and free trial
 * - grant / extend a package manually (no payment needed)
 * - set a special price for this reseller, per package and duration
 * - make the account free of the package entirely
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppModal } from "@/components/ui-kit/AppModal";
import { Crown, Loader2, Save, Sparkles } from "lucide-react";
import {
  PLAN_KEYS,
  PLAN_META,
  PLAN_MONTHS,
  bdt,
  fetchSubscriptionOverview,
  formatDate,
  monthsLabel,
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

  useEffect(() => {
    void (async () => {
      const d = await fetchSubscriptionOverview(reseller.id);
      setData(d);
      setExempt(Boolean(d.state.exempt));
      setEnrolled(Boolean(d.state.enrolled));
      setPlan((d.state.plan as PlanKey | null) ?? "");
      setExpires(toDateInput(d.state.expires_at));
      setTrial(toDateInput(d.state.trial_ends_at));
      const map: Record<string, string> = {};
      for (const o of d.options) if (o.is_custom) map[`${o.plan}:${o.months}`] = String(o.price);
      setPrices(map);
    })();
  }, [reseller.id]);

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
    setData(await fetchSubscriptionOverview(reseller.id));
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
    const d = await fetchSubscriptionOverview(reseller.id);
    setData(d);
    setPlan((d.state.plan as PlanKey | null) ?? "");
    setExpires(toDateInput(d.state.expires_at));
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
      {!data ? (
        <div className="grid h-40 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Crown className="h-4 w-4" /> {planLabel(data.state.plan)}
            </div>
            <div className="mt-1 grid gap-1 text-muted-foreground sm:grid-cols-3">
              <span>Paid until: {formatDate(data.state.expires_at)}</span>
              <span>Trial until: {formatDate(data.state.trial_ends_at)}</span>
              <span>
                Status:{" "}
                {data.state.exempt
                  ? "Free account"
                  : !data.state.enabled
                    ? data.state.master_enabled
                      ? "Not in package (full access)"
                      : "Package system off"
                    : data.state.locked
                      ? "Expired (panel locked)"
                      : data.state.in_trial
                        ? "Free trial"
                        : "Active"}
              </span>
            </div>
          </div>

          {/* Manual grant */}
          <section className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Grant / extend manually</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Adds the duration on top of the current expiry — no payment required.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value as PlanKey)} className={inp}>
                {PLAN_KEYS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_META[p].label}
                  </option>
                ))}
              </select>
              <select value={grantMonths} onChange={(e) => setGrantMonths(Number(e.target.value))} className={inp}>
                {PLAN_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthsLabel(m)}
                  </option>
                ))}
              </select>
              <input
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                className={inp + " sm:col-span-2"}
                placeholder="Note (optional)"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void grant()}
                className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Extend
                package
              </button>
            </div>
          </section>

          {/* Plan / dates / exempt */}
          <section className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Package & dates</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium">
                Current package
                <select value={plan} onChange={(e) => setPlan(e.target.value as PlanKey | "")} className={inp + " mt-1"}>
                  <option value="">— none —</option>
                  {PLAN_KEYS.map((p) => (
                    <option key={p} value={p}>
                      {PLAN_META[p].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium">
                Paid until
                <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inp + " mt-1"} />
              </label>
              <label className="text-xs font-medium">
                Free trial until
                <input type="date" value={trial} onChange={(e) => setTrial(e.target.value)} className={inp + " mt-1"} />
              </label>
            </div>
            <label className="mt-3 flex items-start gap-2 rounded-lg border bg-primary/5 p-3 text-xs">
              <input
                type="checkbox"
                checked={enrolled}
                onChange={(e) => setEnrolled(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold">In the monthly package</span>
                <span className="block text-muted-foreground">
                  {data.state.auto_apply
                    ? "Auto apply is on, so every reseller is in the package anyway."
                    : "Auto apply is off — only resellers with this ticked have to pay for a package."}
                </span>
              </span>
            </label>

            <label className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
              <input
                type="checkbox"
                checked={exempt}
                onChange={(e) => setExempt(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold">No package required</span>
                <span className="block text-muted-foreground">
                  This account keeps full access for free — nothing is ever locked.
                </span>
              </span>
            </label>
          </section>

          {/* Custom prices */}
          <section className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold">Special price for this reseller</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Leave a field empty to use the global package price.
            </p>
            <div className="mt-3 space-y-3">
              {PLAN_KEYS.map((p) => (
                <div key={p}>
                  <div className="mb-1 text-xs font-semibold">{PLAN_META[p].label}</div>
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
                            placeholder="Global price"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
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
