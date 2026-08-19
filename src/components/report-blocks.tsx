import { ORDER_TABS, orderStatusLabel, orderStatusTone, type OrderTabKey } from "@/lib/courier-status";
import { bdt, PROFIT_FORMULA_HINT, type FinanceReport, type MoneyBucket, type ProductLine, type TrendPoint } from "@/lib/finance-report";

/** Shared money table shell so every report block looks identical. */
export function ReportCard({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card mb-6 overflow-hidden border-none shadow-elegant">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-5 py-4">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground/60">{hint}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/** Shared section-tab strip for report pages (keeps long reports out of one scroll). */
export function ReportTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: string; hint?: string }[];
  active: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="surface-card mb-6 overflow-x-auto p-1.5">
      <div className="flex min-w-max items-center gap-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              title={t.hint}
              className={
                "rounded-lg px-3 py-2 text-xs font-medium transition-colors " +
                (on
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const th = "px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** Status-tab wise money breakdown — same buckets as the order list tabs. */
export function StatusReportTable({
  report,
  showAdminCost = true,
}: {
  report: FinanceReport;
  showAdminCost?: boolean;
}) {
  const rows: { key: OrderTabKey; label: string; b: MoneyBucket }[] = ORDER_TABS.filter((t) => t.key !== "all").map(
    (t) => ({ key: t.key, label: t.label, b: report.byStatusTab[t.key] }),
  );
  return (
    <table className={"w-full text-sm " + (showAdminCost ? "min-w-[900px]" : "min-w-[780px]")}>
      <thead className="bg-muted/20 text-center">
        <tr>
          <th className={th}>Status</th>
          <th className={th}>Orders</th>
          <th className={th}>Sell value</th>
          <th className={th} title="Money the courier actually collected">
            Received
          </th>
          <th className={th} title="Order value that was never collected (partial / failed delivery)">
            Not received
          </th>
          <th className={th}>Delivery</th>
          {showAdminCost && <th className={th}>Product cost</th>}
          {showAdminCost && <th className={th}>Packaging cost</th>}
          <th className={th} title={PROFIT_FORMULA_HINT}>
            Profit / loss
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t">
            <td className="px-2 py-2 text-center">
              <span className={"rounded-full px-2 py-0.5 text-[11px] capitalize " + orderStatusTone(statusOfTab(r.key))}>
                {r.label}
              </span>
              {r.b.partialOrders > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                  {r.b.partialOrders} partial
                </span>
              )}
            </td>
            <td className="px-2 py-2 text-center">{r.b.orders}</td>
            <td className="px-2 py-2 text-center">{bdt(r.b.gross)}</td>
            <td className="px-2 py-2 text-center tabular-nums">{bdt(r.b.received)}</td>
            <td className="px-2 py-2 text-center tabular-nums text-destructive">
              {r.b.shortfall ? `−${bdt(r.b.shortfall)}` : "—"}
            </td>
            <td className="px-2 py-2 text-center text-muted-foreground">{bdt(r.b.delivery)}</td>
            {showAdminCost && (
              <td className="px-2 py-2 text-center tabular-nums">{bdt(r.b.adminCost - r.b.packaging)}</td>
            )}
            {showAdminCost && (
              <td className="px-2 py-2 text-center tabular-nums text-violet-500">{bdt(r.b.packaging)}</td>
            )}
            <td className={"px-2 py-2 text-center font-medium " + toneOf(r.b.profit)}>{bdt(r.b.profit)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t bg-muted/30 font-medium">
        <tr>
          <td className="px-2 py-2 text-center">Total</td>
          <td className="px-2 py-2 text-center">{report.all.orders}</td>
          <td className="px-2 py-2 text-center">{bdt(report.all.gross)}</td>
          <td className="px-2 py-2 text-center">{bdt(report.all.received)}</td>
          <td className="px-2 py-2 text-center text-destructive">
            {report.all.shortfall ? `−${bdt(report.all.shortfall)}` : "—"}
          </td>
          <td className="px-2 py-2 text-center">{bdt(report.all.delivery)}</td>
          {showAdminCost && (
            <td className="px-2 py-2 text-center tabular-nums">{bdt(report.all.adminCost - report.all.packaging)}</td>
          )}
          {showAdminCost && (
            <td className="px-2 py-2 text-center tabular-nums text-violet-500">{bdt(report.all.packaging)}</td>
          )}
          <td className={"px-2 py-2 text-center " + toneOf(report.all.profit)}>{bdt(report.all.profit)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Green for profit, red for loss. */
export function toneOf(v: number) {
  return v < 0 ? "text-destructive" : v > 0 ? "text-success" : "";
}



function statusOfTab(key: OrderTabKey) {
  const t = ORDER_TABS.find((x) => x.key === key);
  return t?.statuses[0] ?? "pending";
}

/** Product-wise profit report. */
export function ProductReportTable({
  products,
  limit,
  showCost = true,
}: {
  products: ProductLine[];
  limit?: number;
  showCost?: boolean;
}) {
  const rows = limit ? products.slice(0, limit) : products;
  return (
    <table className="w-full min-w-[860px] text-sm">
      <thead className="bg-muted/20 text-center">
        <tr>
          <th className={th}>Product</th>
          <th className={th}>Orders</th>
          <th className={th}>Qty</th>
          <th className={th}>Delivered qty</th>
          <th className={th} title="Quantity in returned / cancelled orders">Lost qty</th>
          <th className={th}>Sell value</th>
          {showCost && <th className={th}>Cost</th>}
          <th className={th}>Profit</th>
          <th className={th} title="Delivered profit minus not-received amount and failed-delivery loss share">
            Settled net
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.key} className="border-t">
            <td className="px-2 py-2 text-center font-medium">{p.name}</td>
            <td className="px-2 py-2 text-center text-muted-foreground">{p.orders}</td>
            <td className="px-2 py-2 text-center">{p.qty}</td>
            <td className="px-2 py-2 text-center text-muted-foreground">{p.deliveredQty}</td>
            <td className="px-2 py-2 text-center text-muted-foreground">{p.lostQty || "—"}</td>
            <td className="px-2 py-2 text-center">{bdt(p.gross)}</td>
            {showCost && <td className="px-2 py-2 text-center text-muted-foreground">{bdt(p.cost)}</td>}
            <td className="px-2 py-2 text-center">{bdt(p.profit)}</td>
            <td className={"px-2 py-2 text-center font-semibold " + toneOf(p.deliveredProfit)}>
              {bdt(p.deliveredProfit)}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">
              No products match this filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Day/month trend report. */
export function TrendReportTable({ trend, limit = 30 }: { trend: TrendPoint[]; limit?: number }) {
  const rows = trend.slice(0, limit);
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead className="bg-muted/20 text-center">
        <tr>
          <th className={th}>Period</th>
          <th className={th}>Orders</th>
          <th className={th}>Sell value</th>
          <th className={th}>Received</th>
          <th className={th}>Profit</th>
          <th className={th} title="Delivered/partial profit minus failed-delivery loss">Settled net</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.key} className="border-t">
            <td className="px-2 py-2 text-center font-mono text-xs">{t.key}</td>
            <td className="px-2 py-2 text-center">{t.orders}</td>
            <td className="px-2 py-2 text-center">{bdt(t.gross)}</td>
            <td className="px-2 py-2 text-center tabular-nums">{bdt(t.received)}</td>
            <td className={"px-2 py-2 text-center " + toneOf(t.profit)}>{bdt(t.profit)}</td>
            <td className={"px-2 py-2 text-center font-medium " + toneOf(t.deliveredProfit)}>
              {bdt(t.deliveredProfit)}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
              No data available.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Raw per-status breakdown — same column layout as the per-order details table. */
export function RawStatusList({ report, showAdminCost = true }: { report: FinanceReport; showAdminCost?: boolean }) {
  const entries = Object.entries(report.byStatus).sort((a, b) => b[1].orders - a[1].orders);
  return (
    <table className="w-full min-w-[960px] text-sm">
      <thead className="bg-muted/20 text-center">
        <tr>
          <th className={th}>Status</th>
          <th className={th}>Orders</th>
          <th className={th}>Sell value</th>
          <th className={th}>Delivery</th>
          <th className={th}>Customer total</th>
          <th className={th}>Received</th>
          <th className={th} title="Order value never collected">Not received</th>
          {showAdminCost && <th className={th}>Total cost</th>}
          <th className={th}>Profit</th>
          <th className={th}>Avg / order</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([s, b]) => (
          <tr key={s} className="border-t">
            <td className="px-2 py-2 text-center">
              <span className={"rounded-full px-2 py-0.5 text-[11px] capitalize " + orderStatusTone(s)}>
                {orderStatusLabel(s)}
              </span>
            </td>
            <td className="px-2 py-2 text-center">{b.orders}</td>
            <td className="px-2 py-2 text-center">{bdt(b.gross)}</td>
            <td className="px-2 py-2 text-center text-muted-foreground">{bdt(b.delivery)}</td>
            <td className="px-2 py-2 text-center">{bdt(b.customerTotal)}</td>
            <td className="px-2 py-2 text-center tabular-nums">{bdt(b.received)}</td>
            <td className="px-2 py-2 text-center tabular-nums text-destructive">
              {b.shortfall ? `−${bdt(b.shortfall)}` : "—"}
            </td>
            {showAdminCost && <td className="px-2 py-2 text-center text-muted-foreground">{bdt(b.adminCost)}</td>}
            <td className={"px-2 py-2 text-center font-medium " + toneOf(b.profit)}>{bdt(b.profit)}</td>
            <td className="px-2 py-2 text-center text-muted-foreground">
              {bdt(b.orders ? b.customerTotal / b.orders : 0)}
            </td>
          </tr>
        ))}
        {entries.length === 0 && (
          <tr>
            <td colSpan={showAdminCost ? 10 : 9} className="px-2 py-8 text-center text-muted-foreground">
              No orders yet.
            </td>
          </tr>
        )}
      </tbody>
      <tfoot className="border-t bg-muted/30 font-medium">
        <tr>
          <td className="px-2 py-2 text-center">Total</td>
          <td className="px-2 py-2 text-center">{report.all.orders}</td>
          <td className="px-2 py-2 text-center">{bdt(report.all.gross)}</td>
          <td className="px-2 py-2 text-center">{bdt(report.all.delivery)}</td>
          <td className="px-2 py-2 text-center">{bdt(report.all.customerTotal)}</td>
          <td className="px-2 py-2 text-center">{bdt(report.all.received)}</td>
          <td className="px-2 py-2 text-center text-destructive">
            {report.all.shortfall ? `−${bdt(report.all.shortfall)}` : "—"}
          </td>
          {showAdminCost && <td className="px-2 py-2 text-center">{bdt(report.all.adminCost)}</td>}
          <td className={"px-2 py-2 text-center " + toneOf(report.all.profit)}>{bdt(report.all.profit)}</td>
          <td className="px-2 py-2 text-center">{bdt(report.avgOrderValue)}</td>
        </tr>
      </tfoot>
    </table>
  );
}


/** Sortable table header cell — click to toggle asc/desc, arrow shows direction. */
export function SortTh<K extends string>({
  label,
  sortKey,
  active,
  dir,
  onSort,
  hint,
  align = "center",
}: {
  label: string;
  sortKey: K;
  active: K;
  dir: "asc" | "desc";
  onSort: (k: K) => void;
  hint?: string;
  align?: "left" | "center" | "right";
}) {
  const on = active === sortKey;
  return (
    <th
      className={
        "px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground " +
        (align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center")
      }
      title={hint}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={
          "inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground " +
          (on ? "text-primary" : "")
        }
      >
        <span>{label}</span>
        <span className="text-[9px] leading-none">{on ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
