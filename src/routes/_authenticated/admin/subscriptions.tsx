import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataToolbar, Pagination, usePaginated } from "@/components/data-list";
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
import { fetchAllSafe } from "@/lib/fetch-all";

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

const REQ_STATUSES = ["pending", "approved", "rejected"] as const;

function RequestsTab() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [monthsFilter, setMonthsFilter] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
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
      ;
    if (filter === "pending") q = q.eq("status", "pending");
    const data = await fetchAllSafe(() => q);
    setRows(data as unknown as RequestRow[]);
    setPage(1);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (planFilter && r.plan !== planFilter) return false;
      if (monthsFilter && String(r.months) !== monthsFilter) return false;
      if (!q) return true;
      return [
        r.resellers?.business_name,
        r.resellers?.code,
        r.reference,
        r.method,
        r.note,
        String(r.amount),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, statusFilter, planFilter, monthsFilter, query]);

  const pendingTotal = useMemo(
    () => filtered.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [filtered],
  );

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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["pending", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors " +
              (filter === k ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
            }
          >
            {k === "pending" ? "Awaiting approval" : "All payments"}
          </button>
        ))}
        {pendingTotal > 0 && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            Pending {bdt(pendingTotal)}
          </span>
        )}
      </div>

      <DataToolbar
        search={query}
        onSearch={(v) => {
          setQuery(v);
          setPage(1);
        }}
        searchPlaceholder="Search reseller, code, TrxID, amount…"
        filters={[
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            onChange: (v) => {
              setStatusFilter(v);
              setPage(1);
            },
            options: REQ_STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            key: "plan",
            label: "Package",
            value: planFilter,
            onChange: (v) => {
              setPlanFilter(v);
              setPage(1);
            },
            options: PLAN_KEYS.map((p) => ({ value: p, label: PLAN_META[p].label })),
          },
          {
            key: "months",
            label: "Duration",
            value: monthsFilter,
            onChange: (v) => {
              setMonthsFilter(v);
              setPage(1);
            },
            options: PLAN_MONTHS.map((m) => ({ value: String(m), label: monthsLabel(m) })),
          },
        ]}
        perPage={perPage}
        onPerPage={(n) => {
          setPerPage(n);
          setPage(1);
        }}
      />


      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
          {filter === "pending" ? "No package payment awaiting approval." : "No package payment matches this filter."}
        </div>
      ) : (
        <>
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
              {usePaginated(filtered, page, perPage).map((r) => (
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
        <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
        </>
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

  /** Turns one duration on or off for everybody. */
  async function toggleActive(row: PlanRow) {
    const next = !row.is_active;
    const { error } = await supabase
      .from("subscription_plans")
      .update({ is_active: next } as never)
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((s) => s.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
    toast.success(next ? "Duration switched on" : "Duration switched off");
  }

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
              {PLAN_MONTHS.map((m) => {
                const row = rows.find((r) => r.plan === p && r.months === m);
                return (
                  <label key={m} className="text-xs font-medium">
                    <span className="flex items-center justify-between gap-2">
                      {monthsLabel(m)}
                      {row && (
                        <button
                          type="button"
                          onClick={() => void toggleActive(row)}
                          className={
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                            (row.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
                          }
                        >
                          {row.is_active ? "Active" : "Off"}
                        </button>
                      )}
                    </span>
                    <input
                      value={draft[`${p}:${m}`] ?? ""}
                      onChange={(e) => setDraft((s) => ({ ...s, [`${p}:${m}`]: e.target.value }))}
                      className={inp + " mt-1"}
                      inputMode="decimal"
                      disabled={row ? !row.is_active : false}
                    />
                  </label>
                );
              })}
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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from("global_settings").select("advanced_settings").eq("id", 1).maybeSingle();
      if (error) toast.error(error.message);
      setSettings(mergeAdvanced((data as any)?.advanced_settings));
      setLoading(false);
    })();
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const persist = useCallback(async (next: AdvancedSettings) => {
    setStatus("saving");
    const { error } = await supabase
      .from("global_settings")
      .update({ advanced_settings: next as any } as any)
      .eq("id", 1);
    clearAppDataCache("settings");
    clearAdvancedSettingsCache();
    if (error) {
      setStatus("error");
      toast.error(error.message);
      return;
    }
    setStatus("saved");
  }, []);

  function patch(p: Partial<SubscriptionSettings>, immediate = false) {
    setSettings((s) => {
      const next = { ...s, subscription: { ...s.subscription, ...p } };
      if (timer.current) clearTimeout(timer.current);
      if (immediate) void persist(next);
      else timer.current = setTimeout(() => void persist(next), 700);
      return next;
    });
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
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Package rules</h2>
            <p className="text-xs text-muted-foreground">
              With the master switch off, nobody is asked to pay and no panel is ever locked.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {status === "saving" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : status === "saved" ? (
              <span className="text-success">Saved automatically</span>
            ) : status === "error" ? (
              <span className="text-destructive">Not saved</span>
            ) : (
              "Changes save automatically"
            )}
          </span>
        </header>
        <div className="space-y-4 p-4">
          <RuleToggle
            checked={s.enabled}
            onChange={(v) => patch({ enabled: v }, true)}
            title="Monthly package required (master)"
            help="When on, a reseller whose package expired gets a read-only panel until they renew. A panel-only package also keeps the public storefront closed."
            highlight
          />

          <RuleToggle
            checked={s.autoApply}
            onChange={(v) => patch({ autoApply: v }, true)}
            title="Apply to every reseller automatically"
            help="On: every reseller (old and new) is in the package and must pay after the trial. Off: only the resellers you put in the package from the reseller 3-dot menu are asked to pay — everybody else keeps using the panel and store normally."
          />


          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-medium">
              Reminder starts (days before)
              <input
                type="number"
                min={1}
                value={s.noticeDays}
                onChange={(e) => patch({ noticeDays: Math.max(1, Number(e.target.value) || 1) })}
                className={inp + " mt-1"}
              />
              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                Reseller sees the renew reminder from this many days before expiry.
              </span>
            </label>
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
            <div className="text-xs font-medium">
              Trial package
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PLAN_KEYS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ trialPlan: p })}
                    className={
                      "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition " +
                      (s.trialPlan === p ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50")
                    }
                  >
                    {PLAN_META[p].label}
                  </button>
                ))}
              </div>
            </div>
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

    </div>
  );
}

/** Switch-style toggle used by the package rules. */
function RuleToggle({
  checked,
  onChange,
  title,
  help,
  highlight,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  help: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex items-start gap-3 rounded-lg border p-3 " +
        (highlight ? "bg-primary/5 " : "") +
        (checked ? "border-primary/50" : "")
      }
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={
          "mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition " +
          (checked ? "border-primary bg-primary" : "border-input bg-muted")
        }
      >
        <span
          className={
            "h-4 w-4 rounded-full bg-background shadow transition-transform " +
            (checked ? "translate-x-[18px]" : "translate-x-[2px]")
          }
        />
      </button>
      <span className="text-sm">
        <span className="font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
    </div>
  );
}

