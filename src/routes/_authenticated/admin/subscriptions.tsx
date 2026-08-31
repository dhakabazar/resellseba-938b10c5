import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-kit";
import { confirmAction } from "@/lib/confirm";
import { clearAppDataCache } from "@/lib/app-data";
import {
  clearAdvancedSettingsCache,
  mergeAdvanced,
  DEFAULT_ADVANCED_SETTINGS,
  type AdvancedSettings,
  type SubscriptionSettings,
} from "@/lib/advanced-settings";
import { SubStatusChip } from "@/components/subscription-panel";
import {
  PLAN_KEYS,
  PLAN_META,
  PLAN_MONTHS,
  bdt,
  formatDate,
  monthsLabel,
  planLabel,
  type PlanKey,
} from "@/lib/subscription";
import { Check, Crown, Loader2, Save, Sliders, Tags, Wallet, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: AdminSubscriptionsPage,
  head: () => ({
    meta: [
      { title: "Monthly packages · Admin" },
      {
        name: "description",
        content: "Set reseller package prices, approve package payments and control trial and grace periods.",
      },
      { property: "og:title", content: "Monthly packages · Admin" },
      { property: "og:description", content: "Reseller subscription prices, payments and rules in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

type TabKey = "requests" | "prices" | "rules";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "requests", label: "Payments", icon: <Wallet className="h-4 w-4" /> },
  { key: "prices", label: "Package prices", icon: <Tags className="h-4 w-4" /> },
  { key: "rules", label: "Rules", icon: <Sliders className="h-4 w-4" /> },
];

function AdminSubscriptionsPage() {
  const [tab, setTab] = useState<TabKey>("requests");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly packages"
        description="Two products — Panel only and Panel + Storefront — with 1, 6 and 12 month durations."
      />

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "requests" && <RequestsTab />}
      {tab === "prices" && <PricesTab />}
      {tab === "rules" && <RulesTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ payments */

type RequestRow = {
  id: string;
  reseller_id: string;
  plan: PlanKey;
  months: number;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  resellers?: { code: string; business_name: string } | null;
};

function RequestsTab() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [filter]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("subscription_requests")
      .select(
        "id,reseller_id,plan,months,amount,method,reference,note,status,admin_note,created_at,resellers(code,business_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as RequestRow[]);
    setLoading(false);
  }

  async function review(row: RequestRow, approve: boolean) {
    const ok = await confirmAction({
      title: approve ? "Approve package payment" : "Reject payment",
      description: approve
        ? `${planLabel(row.plan)} (${monthsLabel(row.months)}) will be activated for ${
            row.resellers?.business_name ?? "this reseller"
          }.`
        : "The reseller will see this payment as rejected. No package change.",
      confirmText: approve ? "Approve & activate" : "Reject",
    });
    if (!ok) return;
    setBusyId(row.id);
    const { error } = await supabase.rpc("subscription_request_review", {
      _id: row.id,
      _approve: approve,
    } as never);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Package activated" : "Payment rejected");
    void load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {(["pending", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors " +
              (filter === k ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
            }
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
          {filter === "pending" ? "No package payment awaiting approval." : "No package payment yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Date</th>
                <th>Reseller</th>
                <th>Package</th>
                <th>Amount</th>
                <th>TrxID</th>
                <th>Status</th>
                <th className="p-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-2">{formatDate(r.created_at)}</td>
                  <td>
                    <div className="font-medium">{r.resellers?.business_name ?? "—"}</div>
                    <div className="text-muted-foreground">{r.resellers?.code ?? ""}</div>
                  </td>
                  <td>
                    <div className="font-medium">{planLabel(r.plan)}</div>
                    <div className="text-muted-foreground">{monthsLabel(r.months)}</div>
                  </td>
                  <td className="font-semibold tabular-nums">{bdt(r.amount)}</td>
                  <td className="text-muted-foreground">
                    {r.reference ?? r.method ?? "—"}
                    {r.note && <div>{r.note}</div>}
                  </td>
                  <td>
                    <SubStatusChip status={r.status} />
                  </td>
                  <td className="p-2 text-right">
                    {r.status === "pending" ? (
                      <span className="inline-flex gap-1">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void review(r, true)}
                          className="rounded-md border border-success/40 bg-success/10 p-1.5 text-success disabled:opacity-50"
                          aria-label="Approve"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void review(r, false)}
                          className="rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive disabled:opacity-50"
                          aria-label="Reject"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- global prices */

type PlanRow = { id: string; plan: PlanKey; months: number; price: number; is_active: boolean };

function PricesTab() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id,plan,months,price,is_active")
        .order("plan")
        .order("months");
      if (error) toast.error(error.message);
      const list = (data ?? []) as unknown as PlanRow[];
      setRows(list);
      setDraft(Object.fromEntries(list.map((r) => [`${r.plan}:${r.months}`, String(r.price)])));
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    for (const r of rows) {
      const next = Number(draft[`${r.plan}:${r.months}`] ?? r.price);
      if (!Number.isFinite(next) || next === Number(r.price)) continue;
      const { error } = await supabase.from("subscription_plans").update({ price: next } as never).eq("id", r.id);
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
    }
    setBusy(false);
    toast.success("Package prices saved");
    setRows((s) => s.map((r) => ({ ...r, price: Number(draft[`${r.plan}:${r.months}`] ?? r.price) })));
  }

  if (loading)
    return (
      <div className="grid place-items-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {PLAN_KEYS.map((p) => (
          <section key={p} className="surface-card overflow-hidden">
            <header className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Crown className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">{PLAN_META[p].label}</h2>
                <p className="text-xs text-muted-foreground">{PLAN_META[p].blurb}</p>
              </div>
            </header>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {PLAN_MONTHS.map((m) => (
                <label key={m} className="text-xs font-medium">
                  {monthsLabel(m)}
                  <input
                    value={draft[`${p}:${m}`] ?? ""}
                    onChange={(e) => setDraft((s) => ({ ...s, [`${p}:${m}`]: e.target.value }))}
                    className={inp + " mt-1"}
                    inputMode="decimal"
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save prices
        </button>
      </div>
      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        A single reseller can get a different price from Resellers → 3-dot menu → Monthly package.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- rules */

function RulesTab() {
  const [settings, setSettings] = useState<AdvancedSettings>(DEFAULT_ADVANCED_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("global_settings").select("advanced_settings").eq("id", 1).maybeSingle();
      if (error) toast.error(error.message);
      setSettings(mergeAdvanced((data as any)?.advanced_settings));
      setLoading(false);
    })();
  }, []);

  function patch(p: Partial<SubscriptionSettings>) {
    setSettings((s) => ({ ...s, subscription: { ...s.subscription, ...p } }));
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("global_settings")
      .update({ advanced_settings: settings as any } as any)
      .eq("id", 1);
    clearAppDataCache("settings");
    clearAdvancedSettingsCache();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Package rules saved");
  }

  if (loading)
    return (
      <div className="grid place-items-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const s = settings.subscription;

  return (
    <div className="space-y-4">
      <section className="surface-card overflow-hidden">
        <header className="border-b bg-muted/30 px-4 py-3">
          <h2 className="text-sm font-semibold">Package rules</h2>
          <p className="text-xs text-muted-foreground">
            With the master switch off, nobody is asked to pay and no panel is ever locked.
          </p>
        </header>
        <div className="space-y-4 p-4">
          <label className="flex items-start gap-3 rounded-lg border bg-primary/5 p-3">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm">
              <span className="font-semibold">Monthly package required (master)</span>
              <span className="block text-xs text-muted-foreground">
                When on, a reseller whose package expired gets a read-only panel until they renew. A panel-only
                package also keeps the public storefront closed.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium">
              Free trial (days)
              <input
                type="number"
                min={0}
                value={s.trialDays}
                onChange={(e) => patch({ trialDays: Math.max(0, Number(e.target.value) || 0) })}
                className={inp + " mt-1"}
              />
              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                Given to every new reseller. 0 = no trial.
              </span>
            </label>
            <label className="text-xs font-medium">
              Grace period (days)
              <input
                type="number"
                min={0}
                value={s.graceDays}
                onChange={(e) => patch({ graceDays: Math.max(0, Number(e.target.value) || 0) })}
                className={inp + " mt-1"}
              />
              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                Extra days the panel keeps working after expiry.
              </span>
            </label>
            <label className="text-xs font-medium">
              Trial package
              <select
                value={s.trialPlan}
                onChange={(e) => patch({ trialPlan: e.target.value as PlanKey })}
                className={inp + " mt-1"}
              >
                {PLAN_KEYS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_META[p].label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">
              Reminder title
              <input value={s.noticeTitle} onChange={(e) => patch({ noticeTitle: e.target.value })} className={inp + " mt-1"} />
            </label>
            <label className="text-xs font-medium">
              Reminder text
              <input value={s.noticeBody} onChange={(e) => patch({ noticeBody: e.target.value })} className={inp + " mt-1"} />
            </label>
            <label className="text-xs font-medium">
              Expired title
              <input value={s.lockedTitle} onChange={(e) => patch({ lockedTitle: e.target.value })} className={inp + " mt-1"} />
            </label>
            <label className="text-xs font-medium">
              Expired text
              <input value={s.lockedBody} onChange={(e) => patch({ lockedBody: e.target.value })} className={inp + " mt-1"} />
            </label>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save rules
        </button>
      </div>
    </div>
  );
}
