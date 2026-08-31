import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { SearchableSelect } from "@/components/searchable-select";
import { toast } from "sonner";
import { Loader2, Search, Wallet, X, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/agent-deposits")({
  component: AgentDepositsPage,
  head: () => ({
    meta: [
      { title: "Collect deposits · My resellers" },
      {
        name: "description",
        content: "Collect security deposits from the resellers assigned to you and review your own deposit report.",
      },
      { property: "og:title", content: "Collect deposits · My resellers" },
      { property: "og:description", content: "Agent deposit collection and report for assigned resellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ResellerRow = {
  id: string;
  business_name: string;
  code: string;
  phone: string | null;
  status: string;
  deposit_required: boolean;
  deposit_required_amount: number;
  balance: number;
};

type DepositRow = {
  id: string;
  reseller_id: string;
  business_name: string;
  code: string;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  mine: boolean;
  created_at: string;
};

const METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "adjustment"];
const bdt = (v: number) => `৳${Number(v || 0).toLocaleString("en-US")}`;

function AgentDepositsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAgent, setIsAgent] = useState(true);
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [collectFor, setCollectFor] = useState<ResellerRow | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("agent_deposit_overview");
    setLoading(false);
    if (error) return toast.error(error.message);
    const payload = (data ?? {}) as any;
    setIsAgent(Boolean(payload.agent_id));
    setResellers((payload.resellers ?? []) as ResellerRow[]);
    setDeposits((payload.deposits ?? []) as DepositRow[]);
  }

  useEffect(() => {
    void load();
  }, [user?.id]);

  const filteredResellers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resellers;
    return resellers.filter((r) =>
      [r.business_name, r.code, r.phone].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [resellers, search]);

  const visibleDeposits = useMemo(
    () => (scope === "mine" ? deposits.filter((d) => d.mine) : deposits),
    [deposits, scope],
  );

  const collectedTotal = visibleDeposits.reduce((n, d) => n + Number(d.amount || 0), 0);
  const dueTotal = resellers.reduce(
    (n, r) =>
      n +
      (r.deposit_required ? Math.max(Number(r.deposit_required_amount || 0) - Number(r.balance || 0), 0) : 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="surface-card p-8 text-center text-xs text-muted-foreground">
        Your account is not linked to an active commission agent profile.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Collect deposits"
        description="Security deposits of the resellers assigned to you. Collect a deposit and track everything you collected."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Assigned resellers" value={String(resellers.length)} />
        <StatCard label="Deposit collected" value={bdt(collectedTotal)} tone="success" />
        <StatCard label="Total due" value={bdt(dueTotal)} tone={dueTotal > 0 ? "danger" : "success"} />
      </div>

      <div className="surface-card mb-5 p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">My resellers</div>
          <div className="flex h-9 min-w-[220px] items-center rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, phone…"
              className="h-full w-full bg-transparent text-sm outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="rounded p-0.5 hover:bg-accent">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Reseller</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Required</th>
                <th className="p-2">Paid</th>
                <th className="p-2">Due</th>
                <th className="p-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredResellers.map((r) => {
                const due = r.deposit_required
                  ? Math.max(Number(r.deposit_required_amount || 0) - Number(r.balance || 0), 0)
                  : 0;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{r.business_name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.code}</div>
                    </td>
                    <td className="p-2 text-muted-foreground">{r.phone ?? "—"}</td>
                    <td className="p-2">{r.deposit_required ? bdt(r.deposit_required_amount) : "—"}</td>
                    <td className="p-2 font-semibold text-success">{bdt(r.balance)}</td>
                    <td className={"p-2 font-semibold " + (due > 0 ? "text-destructive" : "text-success")}>
                      {due > 0 ? bdt(due) : "Clear"}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => setCollectFor(r)}
                        className="btn-brand inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold"
                      >
                        <Wallet className="h-3.5 w-3.5" /> Collect
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredResellers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No reseller assigned to you yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Deposit report</div>
            <p className="text-xs text-muted-foreground">
              Every deposit of your resellers. Switch to “All” to include deposits recorded by the admin.
            </p>
          </div>
          <SearchableSelect
            label="Show"
            value={scope}
            onChange={(v) => setScope((v as "mine" | "all") || "mine")}
            options={[
              { value: "mine", label: "Collected by me" },
              { value: "all", label: "All deposits" },
            ]}
            className="min-w-[170px]"
          />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Date</th>
                <th className="p-2">Reseller</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Method</th>
                <th className="p-2">Reference</th>
                <th className="p-2">Note</th>
                <th className="p-2">By</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeposits.map((d) => (
                <tr key={d.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-2">
                    {new Date(d.created_at).toLocaleDateString()}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(d.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{d.business_name}</div>
                    <div className="text-[10px] text-muted-foreground">{d.code}</div>
                  </td>
                  <td
                    className={
                      "whitespace-nowrap p-2 font-semibold " +
                      (Number(d.amount) < 0 ? "text-destructive" : "text-success")
                    }
                  >
                    {bdt(Number(d.amount))}
                  </td>
                  <td className="p-2 capitalize">{d.method ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{d.reference ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{d.note ?? "—"}</td>
                  <td className="p-2">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (d.mine ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                      }
                    >
                      {d.mine ? "Me" : "Admin"}
                    </span>
                  </td>
                </tr>
              ))}
              {visibleDeposits.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No deposit recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {collectFor && (
        <CollectModal
          reseller={collectFor}
          onClose={() => setCollectFor(null)}
          onSaved={() => {
            setCollectFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> {label}
      </div>
      <div
        className={
          "mt-1 text-lg font-bold " +
          (tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function CollectModal({
  reseller,
  onClose,
  onSaved,
}: {
  reseller: ResellerRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const due = reseller.deposit_required
    ? Math.max(Number(reseller.deposit_required_amount || 0) - Number(reseller.balance || 0), 0)
    : 0;
  const [amount, setAmount] = useState(due > 0 ? String(due) : "");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const cls = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a positive amount");
    setBusy(true);
    const { error } = await supabase.from("reseller_deposits").insert({
      reseller_id: reseller.id,
      amount: amt,
      method: method || null,
      reference: reference || null,
      note: note || null,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deposit collected");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-xl border bg-background p-4 shadow-xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Collect deposit — {reseller.business_name}</div>
            <p className="text-[11px] text-muted-foreground">
              Paid {bdt(reseller.balance)}
              {reseller.deposit_required ? ` · Due ${bdt(due)}` : " · No deposit rule"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Amount (৳)</label>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
              {METHODS.map((m) => (
                <option key={m} value={m} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Reference / TrxID</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-1.5 text-xs hover:bg-muted">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save deposit
          </button>
        </div>
      </form>
    </div>
  );
}
