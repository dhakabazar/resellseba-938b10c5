/**
 * Transaction report — single money report for admin and reseller.
 * Replaces the old money timeline / earning report: every order settlement,
 * security deposit and withdraw request in one running-balance table.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Download, Search, X, ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/ui-kit";
import { SearchableSelect } from "@/components/searchable-select";
import { Pagination } from "@/components/data-list";
import { resolveRange, rangeLabel, type DateRangeState } from "@/components/date-range-filter";
import { DATE_PRESET_OPTIONS, type DatePreset } from "@/components/order-filters";
import { bdt, toCsv, downloadCsv, PROFIT_FORMULA_HINT } from "@/lib/finance-report";
import { orderStatusLabel, orderStatusTone } from "@/lib/courier-status";

export type TxRow = {
  at: string;
  kind: string; // profit | loss | deposit | withdraw
  direction: string; // in | out | void
  reseller_id: string;
  reseller_name: string;
  reseller_code: string;
  order_id: string | null;
  order_number: string | null;
  status: string;
  label: string;
  note: string | null;
  sell_subtotal: number;
  sell_delivery: number;
  sell_total: number;
  buy_product: number;
  buy_delivery: number;
  packaging: number;
  buy_total: number;
  /** Money the courier collected on delivery (advance baade). */
  collected: number;
  /** Total money received for this order = collected + advance already paid. */
  received: number;
  advance: number;
  advance_by: string | null;
  amount: number;
  running: number;
};

/** Date on top, time below. */
function DateCell({ at }: { at: string }) {
  const d = new Date(at);
  return (
    <div className="whitespace-nowrap leading-tight">
      <div className="text-[11px] font-semibold">{d.toLocaleDateString()}</div>
      <div className="text-[10px] text-muted-foreground">
        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

/** Two stacked labelled money values (Buy/Sell, Admin/Reseller). */
function StackCell({
  top,
  bottom,
}: {
  top: [string, number];
  bottom: [string, number];
}) {
  return (
    <div className="whitespace-nowrap text-right leading-tight tabular-nums">
      <div className="text-[11px]">
        <span className="text-muted-foreground">{top[0]}-</span>
        <span className="font-semibold">{bdt(Number(top[1]))}</span>
      </div>
      <div className="text-[11px]">
        <span className="text-muted-foreground">{bottom[0]}-</span>
        <span className="font-semibold">{bdt(Number(bottom[1]))}</span>
      </div>
    </div>
  );
}

const PARTIAL_STATUSES = ["partial", "partial_full", "partial_item", "partial_delivery", "damaged"];

/** Product came back — product cost is not charged. */
const NO_PRODUCT_COST_STATUSES = ["returned", "pending_return", "cancelled", "partial_delivery"];


/** At-a-glance partial settlement summary: collected vs order value. */
function PartialSummary({ r }: { r: TxRow }) {
  const total = Number(r.sell_total) || 0;
  const received = Number(r.received) || 0;
  const advance = Number(r.advance) || 0;
  const collected = Number(r.collected ?? received - advance) || 0;
  const gap = Math.max(total - received, 0);
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  return (
    <div className="mt-1 max-w-[240px] rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
      <div className="flex items-center justify-between text-[10px] font-semibold">
        <span className="text-amber-600">Collected {bdt(received)}</span>
        <span className="text-muted-foreground">of {bdt(total)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-amber-500/15">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px]">
        <span className="font-semibold text-amber-600">{pct}% received</span>
        {gap > 0 && <span className="text-destructive">short {bdt(gap)}</span>}
      </div>
      {advance > 0 && (
        <div className="mt-1 border-t border-amber-500/20 pt-1 text-[9px] text-muted-foreground">
          Courier {bdt(collected)} + advance {bdt(advance)} ({r.advance_by ?? "reseller"})
        </div>
      )}
    </div>
  );
}

/**
 * Running balance: every in adds, every out subtracts, so Balance is always the
 * simple sum of the Amount column above it. When a single reseller is selected the
 * balance runs per reseller; with "All resellers" it is one combined balance.
 */
function withRunningBalance(rows: TxRow[], perReseller: boolean): TxRow[] {
  const asc = [...rows].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const run = new Map<string, number>();
  const balances = new Map<TxRow, number>();
  for (const r of asc) {
    const key = perReseller ? (r.reseller_id ?? "-") : "all";
    let bal = run.get(key) ?? 0;
    const amount = Number(r.amount) || 0;
    if (r.direction === "in") bal += amount;
    else if (r.direction === "out") bal -= amount;
    run.set(key, bal);
    balances.set(r, bal);
  }
  return rows.map((r) => ({ ...r, running: balances.get(r) ?? (Number(r.running) || 0) }));
}




const KIND_OPTIONS = [
  { value: "", label: "All transactions" },
  { value: "profit", label: "Order profit" },
  { value: "loss", label: "Order loss" },
  { value: "deposit", label: "Security deposit" },
  { value: "withdraw", label: "Withdraw" },
];

export function TransactionReport({
  resellerId,
  admin = false,
}: {
  /** Fixed reseller (reseller panel) or the admin's selected reseller. */
  resellerId?: string | null;
  admin?: boolean;
}) {
  const [range, setRange] = useState<DateRangeState>({ preset: "lifetime", from: "", to: "" });
  const [reseller, setReseller] = useState<string>(resellerId ?? "");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number | "all">(20);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [resellers, setResellers] = useState<{ id: string; business_name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    void supabase
      .from("resellers")
      .select("id,business_name,code")
      .order("business_name")
      .then(({ data }) => setResellers(data ?? []));
  }, [admin]);

  useEffect(() => {
    if (!admin && !resellerId) return;
    const { fromTs, toTs } = resolveRange(range);
    setLoading(true);
    setError(null);
    void supabase
      .rpc("transaction_report", {
        _reseller_id: (admin ? reseller : resellerId) || null,
        _from: fromTs != null ? new Date(fromTs).toISOString() : null,
        _to: toTs != null ? new Date(toTs).toISOString() : null,
        _limit: 1000,
      } as never)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setRows(withRunningBalance((data ?? []) as TxRow[], Boolean((admin ? reseller : resellerId) || "")));
        setLoading(false);
      });
  }, [admin, reseller, resellerId, range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (!q) return true;
      const haystack = [r.reseller_name, r.reseller_code, r.order_number, r.note, r.label, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, kind, search]);

  const paged = useMemo(() => {
    if (perPage === "all") return filtered;
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  useEffect(() => {
    setPage(1);
  }, [kind, reseller, range, search, perPage]);


  const totals = useMemo(() => {
    let inflow = 0,
      outflow = 0,
      deposit = 0,
      withdraw = 0,
      profit = 0,
      loss = 0;
    for (const r of filtered) {
      if (r.kind === "deposit") deposit += Number(r.amount);

      if (r.direction === "in") inflow += Number(r.amount);
      if (r.direction === "out") outflow += Number(r.amount);
      if (r.kind === "withdraw" && r.direction === "out") withdraw += Number(r.amount);
      if (r.kind === "profit") profit += Number(r.amount);
      if (r.kind === "loss") loss += Number(r.amount);
    }
    return { inflow, outflow, deposit, withdraw, profit, loss, balance: inflow - outflow };
  }, [filtered]);

  const exportCsv = () => {
    const csv = toCsv(
      [
        "Date",
        "Type",
        "Reseller",
        "Order",
        "Status",
        "Note",
        "Sell subtotal",
        "Sell delivery",
        "Sell total",
        "Collected by courier",
        "Received (incl. advance)",
        "Buy product",
        "Buy delivery",
        "Packaging",
        "Buy total",
        "Advance",
        "Advance by",
        "Amount",
        "Direction",
        "Running balance",
      ],
      filtered.map((r) => [
        new Date(r.at).toLocaleString(),
        r.kind,
        `${r.reseller_name} (${r.reseller_code})`,
        r.order_number ?? "",
        r.status,
        r.note ?? "",
        r.sell_subtotal,
        r.sell_delivery,
        r.sell_total,
        r.collected ?? 0,
        r.received,
        r.buy_product,
        r.buy_delivery,
        r.packaging,
        r.buy_total,
        r.advance ?? 0,
        r.advance_by ?? "",
        r.amount,
        r.direction,
        r.running,
      ]),

    );
    downloadCsv(`transaction-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Transaction report</h1>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            {admin ? "All reseller money movements in one ledger." : "Your profit, loss, deposit and withdraw ledger."}
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border px-3 text-xs font-semibold hover:bg-accent sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      <div className="surface-card p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex w-full min-w-[240px] flex-col gap-1 sm:w-[30%]">
            <span className="text-[11px] font-medium text-muted-foreground">Search</span>
            <div className="flex h-9 items-center rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order, reseller, note…"
                className="h-full w-full bg-transparent text-sm outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {admin && (
            <SearchableSelect
              label="Reseller"
              placeholder="All resellers"
              value={reseller}
              onChange={setReseller}
              options={[
                { value: "", label: "All resellers" },
                ...resellers.map((r) => ({ value: r.id, label: `${r.business_name} · ${r.code}` })),
              ]}
              className="min-w-[150px] flex-1"
            />
          )}
          <SearchableSelect
            label="Type"
            value={kind}
            onChange={setKind}
            options={KIND_OPTIONS}
            className="min-w-[130px] flex-1"
          />
          <div className="flex min-w-[150px] flex-1 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Date</span>
            <select
              value={range.preset}
              onChange={(e) => {
                const p = e.target.value as DatePreset;
                setRange(p === "custom" ? { ...range, preset: "custom" } : { preset: p, from: "", to: "" });
              }}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {DATE_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === range.preset ? `${o.label} · ${rangeLabel(range)}` : o.label}
                </option>
              ))}
            </select>
          </div>
          {range.preset === "custom" && (
            <>
              <div className="flex min-w-[130px] flex-1 flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">From</span>
                <input
                  type="date"
                  value={range.from}
                  max={range.to || undefined}
                  onChange={(e) => setRange({ ...range, from: e.target.value })}
                  className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex min-w-[130px] flex-1 flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">To</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from || undefined}
                  onChange={(e) => setRange({ ...range, to: e.target.value })}
                  className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          )}
          <div className="flex w-20 shrink-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">Per page</span>
            <select
              value={String(perPage)}
              onChange={(e) => {
                const v = e.target.value;
                setPerPage(v === "all" ? "all" : Number(v));
                setPage(1);
              }}
              className="h-9 rounded-md border bg-background px-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
            >
              {[20, 50, 100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="all">All</option>
            </select>
          </div>
        </div>

      </div>


      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total in" value={bdt(totals.inflow)} icon={<ArrowDownRight className="h-4 w-4" />} />
        <StatCard label="Total out" value={bdt(totals.outflow)} icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Balance" value={bdt(totals.balance)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Order profit / loss"
          value={`${bdt(totals.profit)} / ${bdt(totals.loss)}`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Security deposit" value={bdt(totals.deposit)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Withdrawn" value={bdt(totals.withdraw)} icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Transactions" value={String(filtered.length)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Loss orders" value={String(filtered.filter((r) => r.kind === "loss").length)} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">{PROFIT_FORMULA_HINT}</p>

      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-destructive">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">No transaction in this range.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  {admin && <th className="px-3 py-2 text-left">Reseller</th>}
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Meta / note</th>
                  <th className="px-3 py-2 text-right">Order value</th>
                  <th className="px-3 py-2 text-right">Received (incl. advance)</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 text-right">Delivery</th>
                  <th className="px-3 py-2 text-right">Packaging</th>
                  <th className="px-3 py-2 text-right">Advance</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((r, i) => {
                  const inflow = r.direction === "in";
                  const voided = r.direction === "void";
                  const isPartial = !!r.order_id && PARTIAL_STATUSES.includes(r.status);
                  return (
                    <tr key={`${r.at}-${i}`} className="align-top hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                            (r.kind === "deposit"
                              ? "bg-primary/10 text-primary"
                              : r.kind === "withdraw"
                                ? "bg-amber-500/15 text-amber-600"
                                : inflow
                                  ? "bg-success/15 text-success"
                                  : "bg-destructive/15 text-destructive")
                          }
                        >
                          {r.kind}
                        </span>
                      </td>
                      {admin && (
                        <td className="px-3 py-2">
                          <div className="max-w-[150px] truncate text-[11px] font-semibold">{r.reseller_name}</div>
                          <div className="text-[10px] text-muted-foreground">{r.reseller_code}</div>
                        </td>
                      )}
                      <td className="px-3 py-2">

                        <DateCell at={r.at} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${orderStatusTone(r.status)}`}>
                          {orderStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-3 py-2">
                        {r.order_id ? (
                          <Link
                            to={admin ? "/admin/orders" : "/reseller/orders"}
                            search={{ q: r.order_number ?? "" } as never}
                            className="font-semibold text-primary hover:underline"
                          >
                            #{r.order_number}
                          </Link>
                        ) : (
                          <span className="font-semibold">{r.label}</span>
                        )}
                        <div className="mt-0.5 break-words text-[11px] text-muted-foreground">
                          {r.note || r.label}
                        </div>
                        {isPartial && <PartialSummary r={r} />}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.order_id ? (
                          <div className="whitespace-nowrap leading-tight">
                            <div className="text-[11px] font-bold">{bdt(Number(r.sell_total))}</div>
                            <div className="text-[10px] text-muted-foreground">customer total</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.order_id ? (
                          <div className="whitespace-nowrap leading-tight">
                            <div className="text-[11px] font-bold">{bdt(Number(r.received))}</div>
                            {Number(r.advance) > 0 && (
                              <div className="text-[9px] text-muted-foreground">
                                courier {bdt(Number(r.collected ?? 0))} + advance {bdt(Number(r.advance))}
                              </div>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.order_id ? (
                          <StackCell
                            top={["Buy", NO_PRODUCT_COST_STATUSES.includes(r.status) ? 0 : Number(r.buy_product)]}
                            bottom={["Sell", Number(r.sell_subtotal)]}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.order_id ? (
                          <StackCell
                            top={["Admin", Number(r.buy_delivery)]}
                            bottom={["Reseller", Number(r.sell_delivery)]}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.order_id ? bdt(Number(r.packaging)) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.order_id && Number(r.advance) > 0 ? (
                          <div className="whitespace-nowrap leading-tight">
                            <div className="text-[11px] font-semibold tabular-nums">{bdt(Number(r.advance))}</div>
                            <div className="mt-0.5">
                              <span
                                className={
                                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize " +
                                  ((r.advance_by ?? "reseller") === "admin"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-amber-500/15 text-amber-600")
                                }
                              >
                                {(r.advance_by ?? "reseller") === "admin" ? "received by admin" : "received by reseller"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td
                        className={
                          "px-3 py-2 text-right font-bold tabular-nums " +
                          (voided ? "text-muted-foreground line-through" : inflow ? "text-success" : "text-destructive")
                        }
                      >
                        {inflow ? "+" : "−"}
                        {bdt(Number(r.amount))}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{bdt(Number(r.running))}</td>

                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && perPage !== "all" && (
          <div className="border-t px-3 py-2">
            <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
