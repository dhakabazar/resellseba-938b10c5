import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowUp, ArrowDown, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export type OverviewRow = {
  reseller_id: string;
  code: string | null;
  business_name: string | null;
  owner_phone: string | null;
  delivered_profit: number;
  deposit_balance: number;
  frozen_amount: number;
  requests_count: number;
  requested_total: number;
  pending_amount: number;
  approved_amount: number;
  paid_out: number;
  rejected_amount: number;
  available: number;
  last_request_at: string | null;
};

type SortKey = keyof Omit<OverviewRow, "reseller_id">;

const COLS: { key: SortKey; label: string; money?: boolean; num?: boolean }[] = [
  { key: "business_name", label: "Reseller" },
  { key: "delivered_profit", label: "Profit", money: true },
  { key: "deposit_balance", label: "Deposit", money: true },
  { key: "frozen_amount", label: "Frozen", money: true },
  { key: "requests_count", label: "Requests", num: true },
  { key: "requested_total", label: "Requested", money: true },
  { key: "pending_amount", label: "Pending", money: true },
  { key: "approved_amount", label: "Approved", money: true },
  { key: "paid_out", label: "Withdrawn", money: true },
  { key: "rejected_amount", label: "Rejected", money: true },
  { key: "available", label: "Balance left", money: true },
  { key: "last_request_at", label: "Last request" },
];

const bdt = (n: number) => `৳${Number(n || 0).toLocaleString()}`;

export function PayoutOverview() {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "available", dir: "desc" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_payout_overview" as any);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any[]).map((r) => ({
      ...r,
      delivered_profit: Number(r.delivered_profit ?? 0),
      deposit_balance: Number(r.deposit_balance ?? 0),
      frozen_amount: Number(r.frozen_amount ?? 0),
      requests_count: Number(r.requests_count ?? 0),
      requested_total: Number(r.requested_total ?? 0),
      pending_amount: Number(r.pending_amount ?? 0),
      approved_amount: Number(r.approved_amount ?? 0),
      paid_out: Number(r.paid_out ?? 0),
      rejected_amount: Number(r.rejected_amount ?? 0),
      available: Number(r.available ?? 0),
    })) as OverviewRow[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => [r.business_name, r.code, r.owner_phone].join(" ").toLowerCase().includes(q))
      : rows;
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av ?? "").localeCompare(String(bv ?? "")) * mul;
    });
  }, [rows, query, sort]);

  const totals = useMemo(() => filtered.reduce((t, r) => ({
    profit: t.profit + r.delivered_profit,
    requested: t.requested + r.requested_total,
    pending: t.pending + r.pending_amount + r.approved_amount,
    paid: t.paid + r.paid_out,
    available: t.available + r.available,
  }), { profit: 0, requested: 0, pending: 0, paid: 0, available: 0 }), [filtered]);

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: typeof rows[0]?.[key] === "number" ? "desc" : "asc" }));
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          ["Total profit", totals.profit],
          ["Total requested", totals.requested],
          ["Awaiting payment", totals.pending],
          ["Total withdrawn", totals.paid],
          ["Balance left", totals.available],
        ].map(([label, value]) => (
          <div key={label as string} className="surface-card p-3">
            <div className="text-[11px] uppercase text-muted-foreground">{label as string}</div>
            <div className="mt-1 text-lg font-bold tabular-nums">{bdt(value as number)}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reseller, code, phone…"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={"p-3 " + (c.money || c.num ? "text-right" : "")}>
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={"inline-flex items-center gap-1 hover:text-foreground " + (sort.key === c.key ? "text-foreground" : "")}
                  >
                    {c.label}
                    {sort.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.reseller_id} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{r.business_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.code || "—"}{r.owner_phone ? ` · ${r.owner_phone}` : ""}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">{bdt(r.delivered_profit)}</td>
                <td className="p-3 text-right tabular-nums">{bdt(r.deposit_balance)}</td>
                <td className="p-3 text-right tabular-nums">{bdt(r.frozen_amount)}</td>
                <td className="p-3 text-right tabular-nums">{r.requests_count}</td>
                <td className="p-3 text-right tabular-nums">{bdt(r.requested_total)}</td>
                <td className="p-3 text-right tabular-nums text-warning-foreground">{bdt(r.pending_amount)}</td>
                <td className="p-3 text-right tabular-nums text-primary">{bdt(r.approved_amount)}</td>
                <td className="p-3 text-right font-semibold tabular-nums text-success">{bdt(r.paid_out)}</td>
                <td className="p-3 text-right tabular-nums text-destructive">{bdt(r.rejected_amount)}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{bdt(r.available)}</td>
                <td className="p-3 text-right text-xs text-muted-foreground">
                  {r.last_request_at ? new Date(r.last_request_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No resellers found.</p>}
    </div>
  );
}
