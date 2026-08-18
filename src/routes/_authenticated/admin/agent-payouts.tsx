import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { SearchableSelect } from "@/components/searchable-select";
import { LedgerTimeline } from "@/components/ledger-timeline";
import {
  bdt,
  buildAgentLedger,
  buildAgentPerformance,
  buildAgentSettlement,
  agentCommissionMonths,
  AGENT_COMMISSION_HINT,
  type Agent,
  type AgentOrder,
  type AgentPayout,
} from "@/lib/agents";
import {
  Loader2,
  RefreshCw,
  Plus,
  X,
  Wallet,
  Percent,
  BadgeCheck,
  Clock,
  TrendingDown,
  Check,
  Ban,
  Trash2,
  History,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/agent-payouts")({
  component: AgentPayoutsPage,
});

type ResellerLite = {
  id: string;
  business_name: string;
  code: string;
  status: string;
  contact_phone: string | null;
  agent_id: string | null;
};

const cls = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-600",
  approved: "bg-primary/15 text-primary",
  pending: "bg-amber-500/15 text-amber-600",
  rejected: "bg-destructive/15 text-destructive",
};

function AgentPayoutsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [resellers, setResellers] = useState<ResellerLite[]>([]);
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [payouts, setPayouts] = useState<AgentPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState("");
  const [tab, setTab] = useState<"summary" | "payouts" | "timeline">("summary");
  const [paying, setPaying] = useState<Agent | null>(null);
  const [removing, setRemoving] = useState<AgentPayout | null>(null);

  async function load() {
    setLoading(true);
    const [a, r, o, p] = await Promise.all([
      supabase.from("agents").select("*").order("display_name"),
      supabase.from("resellers").select("id,business_name,code,status,contact_phone,agent_id"),
      supabase
        .from("orders")
        .select("id,reseller_id,status,created_at,total,shipping_cost,sa_cost_total,received_amount,packaging_total")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("agent_payouts").select("*").order("created_at", { ascending: false }),
    ]);
    if (o.error) toast.error(o.error.message);
    if (p.error) toast.error(p.error.message);
    setAgents((a.data ?? []) as unknown as Agent[]);
    setResellers((r.data ?? []) as ResellerLite[]);
    setOrders((o.data ?? []) as AgentOrder[]);
    setPayouts((p.data ?? []) as unknown as AgentPayout[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const view = useMemo(() => {
    return agents
      .filter((a) => !agentId || a.id === agentId)
      .map((a) => {
        const mine = resellers.filter((r) => r.agent_id === a.id);
        const ids = new Set(mine.map((r) => r.id));
        const agentOrders = orders.filter((o) => o.reseller_id && ids.has(o.reseller_id));
        const perf = buildAgentPerformance(a, mine, agentOrders);
        const rows = payouts.filter((p) => p.agent_id === a.id);
        return {
          agent: a,
          perf,
          orders: agentOrders,
          payouts: rows,
          settle: buildAgentSettlement(perf.commission, rows),
          months: agentCommissionMonths(agentOrders, a.commission_rate),
          ledger: buildAgentLedger(agentOrders, a.commission_rate, rows),
        };
      })
      .sort((x, y) => y.settle.earned - x.settle.earned);
  }, [agents, resellers, orders, payouts, agentId]);

  const totals = useMemo(
    () =>
      view.reduce(
        (acc, v) => ({
          earned: acc.earned + v.settle.earned,
          paid: acc.paid + v.settle.paid,
          due: acc.due + Math.max(v.settle.balance, 0),
          advance: acc.advance + v.settle.advance,
          pending: acc.pending + v.settle.pending + v.settle.approved,
        }),
        { earned: 0, paid: 0, due: 0, advance: 0, pending: 0 },
      ),
    [view],
  );

  async function setStatus(p: AgentPayout, status: string, extra: { admin_note?: string } = {}) {
    const patch: Record<string, unknown> = { status, ...extra };
    if (status === "approved") patch.approved_at = new Date().toISOString();
    if (status === "paid") {
      patch.paid_at = new Date().toISOString();
      patch.approved_at = p.approved_at ?? new Date().toISOString();
    }
    const { error } = await supabase.from("agent_payouts").update(patch as never).eq("id", p.id);

    if (error) return toast.error(error.message);
    toast.success(`Payment ${status}`);
    load();
  }

  async function remove(p: AgentPayout) {
    const { error } = await supabase.from("agent_payouts").delete().eq("id", p.id);
    setRemoving(null);
    if (error) return toast.error(error.message);
    toast.success("Payment record deleted");
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agent commission & payouts"
        description="Commission is calculated on the delivered (received) money of every assigned reseller, exactly like the reseller earning report. Pay flexibly — part now, rest later, or advance."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </button>
        }
      />

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex rounded-lg border p-1 text-xs font-semibold">
          {(
            [
              ["summary", "Commission summary"],
              ["payouts", "Payment requests"],
              ["timeline", "History timeline"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "rounded-md px-3 py-1.5 transition " +
                (tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64">
          <SearchableSelect
            value={agentId}
            onChange={setAgentId}
            placeholder="All agents"
            options={[{ value: "", label: "All agents" }, ...agents.map((a) => ({ value: a.id, label: a.display_name }))]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Commission earned"
          value={bdt(totals.earned)}
          icon={<Percent className="h-4 w-4" />}
          hint={AGENT_COMMISSION_HINT}
        />
        <StatCard label="Paid out" value={bdt(totals.paid)} icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard
          label="In process"
          value={bdt(totals.pending)}
          icon={<Clock className="h-4 w-4" />}
          hint="Payment requests that are pending or approved but not paid yet."
        />
        <StatCard label="Due to pay" value={bdt(totals.due)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Advance given"
          value={bdt(totals.advance)}
          icon={<TrendingDown className="h-4 w-4" />}
          hint="Paid more than the commission earned so far. It settles automatically as new delivered orders add commission."
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Create an agent, set the commission percent and assign resellers to start tracking commission."
        />
      ) : (
        <div className="space-y-4">
          {view.map((v) => (
            <div key={v.agent.id} className="surface-card overflow-hidden shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5">
                <div className="min-w-0">
                  <div className="truncate text-base font-bold">{v.agent.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {v.perf.resellerCount} reseller(s) · commission rate {v.agent.commission_rate || 0}% · settled net
                    profit {bdt(v.perf.commissionBase)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={
                        "text-lg font-black " + (v.settle.balance >= 0 ? "text-primary" : "text-destructive")
                      }
                    >
                      {v.settle.balance < 0 ? "−" : ""}
                      {bdt(Math.abs(v.settle.balance))}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {v.settle.balance < 0 ? "advance adjusted later" : "current balance"}
                    </div>
                  </div>
                  <button
                    onClick={() => setPaying(v.agent)}
                    className="btn-brand inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> New payment
                  </button>
                </div>
              </div>

              {tab === "summary" && (
                <div className="space-y-4 p-4 sm:p-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Mini label="Earned" value={bdt(v.settle.earned)} hint={AGENT_COMMISSION_HINT} />
                    <Mini label="Paid" value={bdt(v.settle.paid)} tone="text-emerald-600" />
                    <Mini label="Approved (unpaid)" value={bdt(v.settle.approved)} />
                    <Mini
                      label="Payable now"
                      value={bdt(v.settle.payable)}
                      tone="text-primary"
                      hint="Earned commission minus already paid and approved amounts."
                    />
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Month wise commission
                    </div>
                    {v.months.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        No delivered order yet, so no commission is earned.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border">
                        <div className="hidden grid-cols-4 gap-2 bg-muted/40 px-3 py-2 text-[11px] font-bold uppercase text-muted-foreground sm:grid">
                          <div>Month</div>
                          <div className="text-right">Settled orders</div>
                          <div className="text-right">Net profit</div>
                          <div className="text-right">Commission</div>
                        </div>
                        {v.months.map((m) => (
                          <div
                            key={m.key}
                            className="grid grid-cols-2 gap-2 border-t px-3 py-2 text-sm sm:grid-cols-4"
                          >
                            <div className="font-medium">
                              {new Date(`${m.key}-01T00:00:00`).toLocaleDateString(undefined, {
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-right tabular-nums text-muted-foreground">{m.orders}</div>
                            <div className="text-right tabular-nums">{bdt(m.base)}</div>
                            <div className="text-right font-bold tabular-nums text-primary">{bdt(m.commission)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "payouts" && (
                <div className="space-y-2 p-3 sm:p-4">
                  {v.payouts.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">No payment record yet.</p>
                  )}
                  {v.payouts.map((p) => (
                    <div key={p.id} className="rounded-lg border bg-card p-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold tabular-nums">{bdt(Number(p.amount))}</span>
                            <span
                              className={
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                                (STATUS_TONE[p.status] ?? "bg-muted text-muted-foreground")
                              }
                            >
                              {p.status}
                            </span>
                            {p.kind === "advance" && (
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                                Advance
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {new Date(p.created_at).toLocaleString()}
                            {p.period_from && p.period_to
                              ? ` · period ${p.period_from} → ${p.period_to}`
                              : ""}
                            {p.method ? ` · ${p.method}` : ""}
                            {p.reference ? ` · ${p.reference}` : ""}
                          </div>
                          {(p.note || p.admin_note) && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {[p.note, p.admin_note].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.status === "pending" && (
                            <button
                              onClick={() => setStatus(p, "approved")}
                              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                          )}
                          {p.status !== "paid" && p.status !== "rejected" && (
                            <button
                              onClick={() => setStatus(p, "paid")}
                              className="btn-brand inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                            >
                              <Wallet className="h-3.5 w-3.5" /> Mark paid
                            </button>
                          )}
                          {p.status !== "rejected" && p.status !== "paid" && (
                            <button
                              onClick={() => {
                                const note = window.prompt("Reject reason (optional)") ?? "";
                                setStatus(p, "rejected", note ? { admin_note: note } : {});
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                            >
                              <Ban className="h-3.5 w-3.5" /> Reject
                            </button>
                          )}
                          <button
                            onClick={() => setRemoving(p)}
                            title="Delete record"
                            className="grid h-7 w-7 place-items-center rounded-md border text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "timeline" && (
                <div className="p-3 sm:p-4">
                  <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Commission in, payments out — same money timeline format as the
                    reseller ledger.
                  </p>
                  <LedgerTimeline
                    ledger={v.ledger}
                    frozen={v.settle.approved}
                    available={Math.max(v.settle.balance, 0)}
                    emptyText="No commission or payment yet."
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {paying && (
        <PaymentModal
          agent={paying}
          suggested={view.find((v) => v.agent.id === paying.id)?.settle.payable ?? 0}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            load();
          }}
        />
      )}

      <ConfirmModal
        isOpen={!!removing}
        title="Delete this payment record?"
        description="The amount will no longer count against the agent's commission balance."
        confirmText="Delete"
        variant="danger"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await remove(removing);
        }}
      />
    </div>
  );
}

function PaymentModal({
  agent,
  suggested,
  onClose,
  onSaved,
}: {
  agent: Agent;
  suggested: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(Math.max(Math.round(suggested), 0) || ""));
  const [kind, setKind] = useState("payment");
  const [status, setStatus] = useState("pending");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter a payment amount");
    setBusy(true);
    const now = new Date().toISOString();
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("agent_payouts").insert({
      agent_id: agent.id,
      amount: value,
      kind,
      status,
      method: method.trim() || null,
      reference: reference.trim() || null,
      note: note.trim() || null,
      period_from: from || null,
      period_to: to || null,
      created_by: auth?.user?.id ?? null,
      approved_at: status === "approved" || status === "paid" ? now : null,
      paid_at: status === "paid" ? now : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment record created");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="surface-card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:max-h-[88dvh] sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">Pay commission</h3>
            <p className="truncate text-xs text-muted-foreground">
              {agent.display_name} · payable now {bdt(suggested)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Amount (৳)</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cls}
                required
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pay any amount — the rest stays as balance. Paying more than earned shows as advance (minus) and
                settles automatically later.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={cls}>
                <option value="payment">Commission payment</option>
                <option value="advance">Advance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={cls}>
                <option value="pending">Pending (needs approval)</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid now</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Method</label>
              <input
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                placeholder="bKash / Nagad / Bank"
                className={cls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Reference / TrxID</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={cls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Period from</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Period to</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cls} />
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Note</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save payment
          </button>
        </div>
      </form>
    </div>
  );
}

function Mini({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background p-2.5" title={hint}>
      <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-0.5 text-sm font-black " + (tone ?? "")}>{value}</div>
    </div>
  );
}
