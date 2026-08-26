/**
 * Compact colour-coded money summary shown inside the order list rows.
 * `ResellerTotalCell` = customer bill + delivery charge + reseller profit.
 * `AdminTotalCell`    = admin revenue + admin buying cost + admin profit.
 */
import {
  bdt,
  orderDeliveryCost,
  orderProfit,
  orderReceived,
  type ProfitOrder,
} from "@/lib/finance-report";

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "delivery" | "profit" | "loss" | "cost";
}) {
  const cls =
    tone === "delivery"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-600"
      : tone === "profit"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
        : tone === "loss"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-[1px] text-[9px] font-bold leading-tight tabular-nums ${cls}`}
    >
      <span className="opacity-70">{label}</span>
      {value}
    </span>
  );
}

export function ResellerTotalCell({ order, showProfit = true }: { order: ProfitOrder; showProfit?: boolean }) {
  const total = Number(order.total ?? 0) || 0;
  const delivery = Number(order.shipping_cost ?? 0) || 0;
  const profit = orderProfit(order);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="text-sm font-black tabular-nums text-foreground">{bdt(total)}</span>
      <div className="flex flex-wrap gap-1">
        <Chip label="del" value={bdt(delivery)} tone="delivery" />
        {showProfit && (
          <Chip label={profit < 0 ? "loss" : "pft"} value={bdt(profit)} tone={profit < 0 ? "loss" : "profit"} />
        )}
      </div>
    </div>
  );
}

/** Admin side: revenue = money received − what the reseller finally earns. */
export function AdminTotalCell({ order, buyingCost }: { order: ProfitOrder; buyingCost: number }) {
  const revenue = orderReceived(order) - orderProfit(order);
  const profit = revenue - buyingCost;
  const delivery = orderDeliveryCost(order);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="text-sm font-black tabular-nums text-primary">{bdt(revenue)}</span>
      <div className="flex flex-wrap gap-1">
        <Chip label="buy" value={bdt(buyingCost)} tone="cost" />
        <Chip label="del" value={bdt(delivery)} tone="delivery" />
        <Chip label={profit < 0 ? "loss" : "pft"} value={bdt(profit)} tone={profit < 0 ? "loss" : "profit"} />
      </div>
    </div>
  );
}
