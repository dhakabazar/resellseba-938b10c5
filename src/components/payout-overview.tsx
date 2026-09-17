import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowUp, ArrowDown, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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

type SortKey = keyof Omit<OverviewRow, "reseller_id" | "code" | "owner_phone">;

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
const num = (v: unknown) => Number(v ?? 0);

type Totals = { profit: number; requested: number; pending: number; paid: number; available: number };
const ZERO: Totals = { profit: 0, requested: 0, pending: 0, paid: 0, available: 0 };

/** Compact inline report for one reseller — used by the payout request collapse. */
export function ResellerPayoutSummary({ search }: { search: string }) {
  const [row, setRow] = useState<OverviewRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void supabase
      .rpc("admin_payout_overview" as any, {
        _search: search || null,
        _sort: "available",
        _dir: "desc",
        _limit: 1,
        _offset: 0,
        _active_only: false,
      } as any)
      .then(({ data, error }) => {
        if (!alive) return;
        const r = ((data as any)?.rows ?? [])[0];
        if (error || !r) setRow(null);
        else
          setRow({
            reseller_id: r.reseller_id,
            code: r.code ?? null,
            business_name: r.business_name ?? null,
            owner_phone: r.owner_phone ?? null,
            delivered_profit: num(r.delivered_profit),
            deposit_balance: num(r.deposit_balance),
            frozen_amount: num(r.frozen_amount),
            requests_count: num(r.requests_count),
            requested_total: num(r.requested_total),
            pending_amount: num(r.pending_amount),
            approved_amount: num(r.approved_amount),
            paid_out: num(r.paid_out),
            rejected_amount: num(r.rejected_amount),
            available: num(r.available),
            last_request_at: r.last_request_at ?? null,
          });
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [search]);

  if (loading)
    return (
      <div className="grid place-items-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  if (!row) return <p className="py-4 text-center text-xs text-muted-foreground">No report found for this reseller.</p>;

  const cells: [string, string][] = [
    ["Profit", bdt(row.delivered_profit)],
    ["Deposit", bdt(row.deposit_balance)],
    ["Frozen", bdt(row.frozen_amount)],
    ["Requests", String(row.requests_count)],
    ["Requested", bdt(row.requested_total)],
    ["Pending", bdt(row.pending_amount)],
    ["Approved", bdt(row.approved_amount)],
    ["Withdrawn", bdt(row.paid_out)],
    ["Rejected", bdt(row.rejected_amount)],
    ["Balance left", bdt(row.available)],
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map(([label, value]) => (
        <div key={label} className="rounded-md border bg-background p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function PayoutOverview({ initialSearch = "" }: { initialSearch?: string }) {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [totals, setTotals] = useState<Totals>(ZERO);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [activeOnly, setActiveOnly] = useState(true);
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "available", dir: "desc" });
  const reqRef = useRef(0);

  // Debounce typing so each keystroke doesn't hit the database.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  // Following a reseller link from the requests tab pre-fills the search.
  useEffect(() => {
    setQuery(initialSearch);
    setActiveOnly(initialSearch ? false : true);
  }, [initialSearch]);

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_payout_overview" as any, {
      _search: search || null,
      _sort: sort.key,
      _dir: sort.dir,
      _limit: perPage,
      _offset: (page - 1) * perPage,
      _active_only: activeOnly,
    } as any);
    if (id !== reqRef.current) return;
    if (error) {
      toast.error(error.message);
      setRows([]);
      setTotals(ZERO);
      setTotal(0);
    } else {
      const payload = (data ?? {}) as any;
      setRows(((payload.rows ?? []) as any[]).map((r) => ({
        reseller_id: r.reseller_id,
        code: r.code ?? null,
        business_name: r.business_name ?? null,
        owner_phone: r.owner_phone ?? null,
        delivered_profit: num(r.delivered_profit),
        deposit_balance: num(r.deposit_balance),
        frozen_amount: num(r.frozen_amount),
        requests_count: num(r.requests_count),
        requested_total: num(r.requested_total),
        pending_amount: num(r.pending_amount),
        approved_amount: num(r.approved_amount),
        paid_out: num(r.paid_out),
        rejected_amount: num(r.rejected_amount),
        available: num(r.available),
        last_request_at: r.last_request_at ?? null,
      })));
      const t = payload.totals ?? {};
      setTotals({
        profit: num(t.profit),
        requested: num(t.requested),
        pending: num(t.pending),
        paid: num(t.paid),
        available: num(t.available),
      });
      setTotal(num(payload.total));
    }
    setBusy(false);
    setLoading(false);
  }, [search, sort.key, sort.dir, perPage, page, activeOnly]);

  useEffect(() => { void load(); }, [load]);

  function toggle(key: SortKey) {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "business_name" ? "asc" : "desc" }));
  }

  const pages = Math.max(1, Math.ceil(total / perPage));

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
        <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => { setActiveOnly(e.target.checked); setPage(1); }}
            className="h-3.5 w-3.5"
          />
          Only resellers with activity
        </label>
        <select
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
          className="h-9 rounded-md border bg-background px-2 text-xs"
          aria-label="Rows per page"
        >
          {[25, 50, 100, 200, 500, 1000, 5000].map((n) => <option key={n} value={n}>{n} / page</option>)}
          <option value={1000000}>All</option>
        </select>
        <button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-muted disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </button>
      </div>

      <div className="surface-card relative overflow-x-auto">
        {busy && <div className="absolute inset-0 z-10 grid place-items-center bg-background/50"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
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
            {rows.map((r) => (
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

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No resellers found.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{total.toLocaleString()} resellers · page {page} of {pages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || busy}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || busy}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 hover:bg-muted disabled:opacity-50"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
