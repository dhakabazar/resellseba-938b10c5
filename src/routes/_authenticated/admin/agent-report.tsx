import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-kit";
import { DateRangeBar, DEFAULT_DATE_RANGE, inRange, type DateRangeState } from "@/components/date-range-filter";
import { SearchableSelect } from "@/components/searchable-select";
import {
  buildAgentPerformance,
  bdt,
  waNumber,
  AGENT_SALES_HINT,
  type Agent,
  type AgentOrder,
  type AgentPerformance,
} from "@/lib/agents";
import {
  Loader2,
  RefreshCw,
  Target,
  Users,
  ShoppingCart,
  TrendingUp,
  ChevronDown,
  Phone,
  MessageCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/agent-report")({
  component: AgentReportPage,
});

type ResellerLite = {
  id: string;
  business_name: string;
  code: string;
  status: string;
  contact_phone: string | null;
  agent_id: string | null;
};

function AgentReportPage() {
  const [range, setRange] = useState<DateRangeState>(DEFAULT_DATE_RANGE);
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [resellers, setResellers] = useState<ResellerLite[]>([]);
  const [orders, setOrders] = useState<AgentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [a, r, o] = await Promise.all([
      supabase.from("agents").select("*").order("display_name"),
      supabase.from("resellers").select("id,business_name,code,status,contact_phone,agent_id"),
      supabase
        .from("orders")
        .select("id,reseller_id,status,created_at,total,shipping_cost,sa_cost_total,received_amount,packaging_total")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);
    if (o.error) toast.error(o.error.message);
    setAgents((a.data ?? []) as Agent[]);
    setResellers((r.data ?? []) as ResellerLite[]);
    setOrders((o.data ?? []) as AgentOrder[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const scoped = useMemo(() => orders.filter((o) => inRange(o.created_at, range)), [orders, range]);

  const perf: AgentPerformance[] = useMemo(() => {
    const rows = agents
      .filter((a) => !agentId || a.id === agentId)
      .map((a) =>
        buildAgentPerformance(
          a,
          resellers.filter((r) => r.agent_id === a.id),
          scoped,
        ),
      );
    return rows.sort((x, y) => y.sales - x.sales);
  }, [agents, resellers, scoped, agentId]);

  const totals = useMemo(
    () =>
      perf.reduce(
        (acc, p) => ({
          resellers: acc.resellers + p.resellerCount,
          orders: acc.orders + p.orders,
          sales: acc.sales + p.sales,
          profit: acc.profit + p.profit,
          target: acc.target + p.target,
        }),
        { resellers: 0, orders: 0, sales: 0, profit: 0, target: 0 },
      ),
    [perf],
  );

  const agentName = (id: string) => agents.find((a) => a.id === id)?.display_name ?? "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agent performance report"
        description="Sales target vs achievement for every commission agent, plus how each assigned reseller is performing."
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
        <DateRangeBar value={range} onChange={setRange} />
        <div className="w-full md:w-64">
          <SearchableSelect
            value={agentId}
            onChange={setAgentId}
            placeholder="All agents"
            options={[
              { value: "", label: "All agents" },
              ...agents.map((a) => ({ value: a.id, label: a.display_name })),
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Agents" value={String(perf.length)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Assigned resellers" value={String(totals.resellers)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Orders" value={String(totals.orders)} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard
          label="Sales received"
          value={bdt(totals.sales)}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={AGENT_SALES_HINT}
        />
        <StatCard
          label="Target"
          value={bdt(totals.target)}
          icon={<Target className="h-4 w-4" />}
          hint="Combined sale target set for the agents in view. Achievement is measured against sales received in the selected period."
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : perf.length === 0 ? (
        <EmptyState
          title="No agent data"
          description="Create an agent and assign resellers to see the follow-up performance report here."
        />
      ) : (
        <div className="space-y-4">
          {perf.map((p) => {
            const pct = Math.min(p.achievedPct, 100);
            const expanded = open === p.agentId;
            return (
              <div key={p.agentId} className="surface-card overflow-hidden shadow-sm">
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold">{agentName(p.agentId)}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.resellerCount} reseller(s) · {p.activeResellers} active · {p.sellingResellers} ordering in
                        this period
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-primary">{bdt(p.sales)}</div>
                      <div className="text-[11px] text-muted-foreground">of {bdt(p.target)} target</div>
                    </div>
                  </div>

                  <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          "h-full rounded-full transition-all " +
                          (p.achievedPct >= 100 ? "bg-emerald-500" : p.achievedPct >= 50 ? "bg-primary" : "bg-amber-500")
                        }
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span title="Sales received divided by the sale target.">{p.achievedPct}% achieved</span>
                      <span>{p.gap > 0 ? `${bdt(p.gap)} to go` : "Target reached"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Mini label="Orders" value={String(p.orders)} />
                    <Mini label="Delivered" value={String(p.delivered)} />
                    <Mini label="Failed / returned" value={String(p.failed)} />
                    <Mini
                      label="Net profit"
                      value={bdt(p.profit)}
                      tone={p.profit >= 0 ? "text-emerald-600" : "text-destructive"}
                      hint="Received amount − delivery charge − product cost − packaging cost. Failed orders subtract delivery and packaging as loss."
                    />
                    <Mini
                      label={`Commission (${p.rate}%)`}
                      value={bdt(p.commission)}
                      tone="text-primary"
                      hint={AGENT_COMMISSION_HINT}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setOpen(expanded ? null : p.agentId)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      <ChevronDown className={"h-3.5 w-3.5 transition " + (expanded ? "rotate-180" : "")} />
                      {expanded ? "Hide resellers" : "Reseller performance"}
                    </button>
                    <Link
                      to="/admin/agent-payouts"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      <Wallet className="h-3.5 w-3.5" /> Commission & payout history
                    </Link>
                  </div>

                </div>

                {expanded && (
                  <div className="space-y-2 border-t bg-muted/20 p-3 sm:p-4">
                    {p.resellers.length === 0 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">No reseller assigned yet.</p>
                    )}
                    {p.resellers.map((r) => (
                      <div key={r.reseller_id} className="rounded-lg border bg-card p-3 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to="/admin/orders"
                              search={{ reseller: r.reseller_id }}
                              className="truncate text-sm font-semibold hover:underline"
                            >
                              {r.business_name}
                            </Link>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              #{r.code} · {r.status}
                              {r.lastOrderAt
                                ? ` · last order ${new Date(r.lastOrderAt).toLocaleDateString()}`
                                : " · no order in range"}
                            </div>
                          </div>
                          {r.phone && (
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${r.phone}`}
                                className="grid h-7 w-7 place-items-center rounded-md border hover:bg-muted"
                                aria-label="Call reseller"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${waNumber(r.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="grid h-7 w-7 place-items-center rounded-md border text-emerald-600 hover:bg-muted"
                                aria-label="WhatsApp reseller"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(r.phone!);
                                  toast.success("Phone copied");
                                }}
                                className="grid h-7 w-7 place-items-center rounded-md border hover:bg-muted"
                                aria-label="Copy phone"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Mini label="Orders" value={String(r.orders)} />
                          <Mini label="Delivered" value={String(r.delivered)} />
                          <Mini label="Sales" value={bdt(r.sales)} hint={AGENT_SALES_HINT} />
                          <Mini
                            label="Profit"
                            value={bdt(r.profit)}
                            tone={r.profit >= 0 ? "text-emerald-600" : "text-destructive"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-2.5" title={hint}>
      <div className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-0.5 text-sm font-black " + (tone ?? "")}>{value}</div>
    </div>
  );
}
