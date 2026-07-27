import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-kit";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle2, PackageSearch } from "lucide-react";

type Item = {
  product_name: string;
  quantity: number;
  sa_price: number;        // reseller_price + packaging (admin cost to reseller)
  reseller_price: number;  // customer selling price
  profit: number;
  line_total: number;
};

type Row = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  created_at: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  sa_cost_total: number;
  reseller_profit: number;
  order_items: Item[];
};

export const Route = createFileRoute("/_authenticated/reseller/earnings")({
  component: EarningsPage,
});

const STATUS_FILTERS = ["all", "delivered", "pending", "processing", "shipped", "returned", "cancelled"] as const;

function EarningsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ delivered_profit: 0, pending_payout: 0, paid_out: 0, available: 0 });
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase.from("resellers").select("id").eq("user_id", user.id).maybeSingle();
      if (!r) return setLoading(false);
      const [ordersRes, summaryRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,order_number,status,payment_status,created_at,subtotal,shipping_cost,total,sa_cost_total,reseller_profit,order_items(product_name,quantity,sa_price,reseller_price,profit,line_total)")
          .eq("reseller_id", r.id)
          .order("created_at", { ascending: false }),
        supabase.rpc("reseller_profit_summary", { _reseller_id: r.id }),
      ]);
      setRows((ordersRes.data ?? []) as unknown as Row[]);
      const s = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
      if (s) setSummary({
        delivered_profit: Number(s.delivered_profit),
        pending_payout: Number(s.pending_payout),
        paid_out: Number(s.paid_out),
        available: Number(s.available),
      });
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter !== "all") out = out.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((r) =>
      r.order_number.toLowerCase().includes(q) ||
      r.order_items.some((i) => i.product_name.toLowerCase().includes(q))
    );
    return out;
  }, [rows, filter, query]);

  const pendingProfit = useMemo(
    () => rows.filter((r) => !["delivered", "returned", "cancelled"].includes(r.status)).reduce((s, r) => s + Number(r.reseller_profit), 0),
    [rows]
  );

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Earnings" description="Per-order profit breakdown — product cost, delivery, ki koto pelen, koto due." />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Delivered profit (lifetime)" value={`৳${summary.delivered_profit.toLocaleString()}`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="In-transit profit" value={`৳${pendingProfit.toLocaleString()}`} hint="Delivered hole confirmed" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Paid out" value={`৳${summary.paid_out.toLocaleString()}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Available to withdraw" value={`৳${summary.available.toLocaleString()}`} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order number or product…"
          className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="ml-auto flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={"rounded-full border px-3 py-1 text-xs capitalize transition-colors " + (filter === f ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No orders match" description="Filter change korun ba onno keyword try korun." />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const confirmed = o.status === "delivered";
            const lost = o.status === "returned" || o.status === "cancelled";
            return (
              <div key={o.id} className="surface-card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-3 text-sm">
                  <span className="font-mono text-xs">{o.order_number}</span>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] capitalize " + statusStyle(o.status)}>{o.status}</span>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] capitalize " + payStyle(o.payment_status)}>{o.payment_status}</span>
                  <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                  <div className="ml-auto text-right">
                    <div className="text-[11px] text-muted-foreground">Your profit</div>
                    <div className={"text-base font-semibold " + (lost ? "text-muted-foreground line-through" : confirmed ? "text-success" : "text-foreground")}>
                      ৳{Number(o.reseller_profit).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="divide-y">
                  {o.order_items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 px-4 py-3 text-xs md:grid-cols-6">
                      <div className="col-span-2 md:col-span-2">
                        <div className="text-sm font-medium">{it.product_name}</div>
                        <div className="text-[11px] text-muted-foreground">Qty × {it.quantity}</div>
                      </div>
                      <Cell label="Sell price" value={`৳${Number(it.reseller_price).toLocaleString()}`} />
                      <Cell label="Product + pkg cost" value={`৳${Number(it.sa_price).toLocaleString()}`} />
                      <Cell label="Line total" value={`৳${Number(it.line_total).toLocaleString()}`} />
                      <Cell label="Profit" value={`৳${Number(it.profit).toLocaleString()}`} accent />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-4 py-3 text-xs md:grid-cols-5">
                  <Cell label="Subtotal (sell)" value={`৳${Number(o.subtotal).toLocaleString()}`} />
                  <Cell label="Delivery (admin collects)" value={`৳${Number(o.shipping_cost).toLocaleString()}`} />
                  <Cell label="Customer total" value={`৳${Number(o.total).toLocaleString()}`} />
                  <Cell label="Admin cost" value={`৳${Number(o.sa_cost_total).toLocaleString()}`} />
                  <Cell label="Your profit" value={`৳${Number(o.reseller_profit).toLocaleString()}`} accent />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div className="mt-4">
          <EmptyState title="No orders yet" description="Store share korun r prothom order asa matro ekhane breakdown ashbe." icon={<PackageSearch className="h-8 w-8" />} />
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-sm " + (accent ? "font-semibold text-success" : "font-medium")}>{value}</div>
    </div>
  );
}

function statusStyle(s: string) {
  return s === "delivered" ? "bg-success/20 text-success"
    : s === "shipped" || s === "processing" || s === "forwarded" || s === "confirmed" ? "bg-primary/15 text-primary"
    : s === "returned" || s === "cancelled" ? "bg-destructive/20 text-destructive"
    : "bg-warning/20 text-warning-foreground";
}
function payStyle(s: string) {
  return s === "paid" ? "bg-success/20 text-success"
    : s === "refunded" ? "bg-destructive/20 text-destructive"
    : s === "partial" ? "bg-warning/20 text-warning-foreground"
    : "bg-muted text-muted-foreground";
}
