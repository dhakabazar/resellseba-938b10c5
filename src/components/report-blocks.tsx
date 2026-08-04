import { ORDER_TABS, orderStatusLabel, orderStatusTone, type OrderTabKey } from "@/lib/courier-status";
import { bdt, type FinanceReport, type MoneyBucket, type ProductLine, type TrendPoint } from "@/lib/finance-report";

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
    <section className="surface-card mb-6 overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = "p-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** Status-tab wise money breakdown — same buckets as the order list tabs. */
export function StatusReportTable({ report, showAdminCost = true }: { report: FinanceReport; showAdminCost?: boolean }) {
  const rows: { key: OrderTabKey; label: string; b: MoneyBucket }[] = ORDER_TABS.filter((t) => t.key !== "all").map(
    (t) => ({ key: t.key, label: t.label, b: report.byStatusTab[t.key] }),
  );
  return (
    <table className="w-full min-w-[760px] text-sm">
      <thead className="bg-muted/20 text-left">
        <tr>
          <th className={th}>Status</th>
          <th className={`${th} text-right`}>Orders</th>
          <th className={`${th} text-right`}>Sell value</th>
          <th className={`${th} text-right`}>Delivery</th>
          {showAdminCost && <th className={`${th} text-right`}>Product+pkg cost</th>}
          <th className={`${th} text-right`}>Profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t">
            <td className="p-3">
              <span className={"rounded-full px-2 py-0.5 text-[11px] capitalize " + orderStatusTone(statusOfTab(r.key))}>
                {r.label}
              </span>
            </td>
            <td className="p-3 text-right">{r.b.orders}</td>
            <td className="p-3 text-right">{bdt(r.b.gross)}</td>
            <td className="p-3 text-right text-muted-foreground">{bdt(r.b.delivery)}</td>
            {showAdminCost && <td className="p-3 text-right text-muted-foreground">{bdt(r.b.adminCost)}</td>}
            <td className="p-3 text-right font-medium">{bdt(r.b.profit)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t bg-muted/30 font-medium">
        <tr>
          <td className="p-3">Total</td>
          <td className="p-3 text-right">{report.all.orders}</td>
          <td className="p-3 text-right">{bdt(report.all.gross)}</td>
          <td className="p-3 text-right">{bdt(report.all.delivery)}</td>
          {showAdminCost && <td className="p-3 text-right">{bdt(report.all.adminCost)}</td>}
          <td className="p-3 text-right">{bdt(report.all.profit)}</td>
        </tr>
      </tfoot>
    </table>
  );
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
    <table className="w-full min-w-[760px] text-sm">
      <thead className="bg-muted/20 text-left">
        <tr>
          <th className={th}>Product</th>
          <th className={`${th} text-right`}>Orders</th>
          <th className={`${th} text-right`}>Qty</th>
          <th className={`${th} text-right`}>Delivered qty</th>
          <th className={`${th} text-right`}>Sell value</th>
          {showCost && <th className={`${th} text-right`}>Cost</th>}
          <th className={`${th} text-right`}>Profit</th>
          <th className={`${th} text-right`}>Delivered profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.key} className="border-t">
            <td className="p-3 font-medium">{p.name}</td>
            <td className="p-3 text-right text-muted-foreground">{p.orders}</td>
            <td className="p-3 text-right">{p.qty}</td>
            <td className="p-3 text-right text-muted-foreground">{p.deliveredQty}</td>
            <td className="p-3 text-right">{bdt(p.gross)}</td>
            {showCost && <td className="p-3 text-right text-muted-foreground">{bdt(p.cost)}</td>}
            <td className="p-3 text-right">{bdt(p.profit)}</td>
            <td className="p-3 text-right font-semibold text-success">{bdt(p.deliveredProfit)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="p-8 text-center text-muted-foreground">
              এই filter-এ কোনো product নেই।
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
    <table className="w-full min-w-[560px] text-sm">
      <thead className="bg-muted/20 text-left">
        <tr>
          <th className={th}>Period</th>
          <th className={`${th} text-right`}>Orders</th>
          <th className={`${th} text-right`}>Sell value</th>
          <th className={`${th} text-right`}>Profit</th>
          <th className={`${th} text-right`}>Delivered profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.key} className="border-t">
            <td className="p-3 font-mono text-xs">{t.key}</td>
            <td className="p-3 text-right">{t.orders}</td>
            <td className="p-3 text-right">{bdt(t.gross)}</td>
            <td className="p-3 text-right">{bdt(t.profit)}</td>
            <td className="p-3 text-right font-medium text-success">{bdt(t.deliveredProfit)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="p-8 text-center text-muted-foreground">
              কোনো data নেই।
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Raw per-status list (all 10 statuses, not just tabs). */
export function RawStatusList({ report }: { report: FinanceReport }) {
  const entries = Object.entries(report.byStatus).sort((a, b) => b[1].orders - a[1].orders);
  return (
    <div className="flex flex-wrap gap-2 p-4">
      {entries.map(([s, b]) => (
        <div key={s} className="rounded-lg border px-3 py-2">
          <div className={"mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] capitalize " + orderStatusTone(s)}>
            {orderStatusLabel(s)}
          </div>
          <div className="text-sm font-semibold">{b.orders} order</div>
          <div className="text-[11px] text-muted-foreground">
            {bdt(b.gross)} sell · {bdt(b.profit)} profit
          </div>
        </div>
      ))}
      {entries.length === 0 && <div className="text-sm text-muted-foreground">কোনো order নেই।</div>}
    </div>
  );
}
