/**
 * Compact money summary shown inside the order list rows — same breakdown style
 * as the Transaction report so both sides stay readable.
 *
 * `ResellerTotalCell` = money received + reseller buy / delivery / packaging / profit.
 * `AdminTotalCell`    = admin revenue + admin buy / delivery / packaging / profit.
 */
import {
  bdt,
  orderDeliveryCost,
  orderKeptProductCost,
  orderPackaging,
  orderProfit,
  orderReceived,
  type ProfitOrder,
} from "@/lib/finance-report";

type Tone = "delivery" | "profit" | "loss" | "cost" | "pack";

function Chip({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const cls =
    tone === "delivery"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-600"
      : tone === "profit"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
        : tone === "loss"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : tone === "pack"
            ? "border-violet-500/30 bg-violet-500/10 text-violet-600"
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

function Summary({
  headLabel,
  headValue,
  headTone,
  buy,
  delivery,
  packaging,
  profit,
}: {
  headLabel: string;
  headValue: number;
  headTone?: "primary" | "foreground";
  buy: number;
  delivery: number;
  packaging: number;
  profit: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="flex items-baseline gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{headLabel}</span>
        <span
          className={
            "text-sm font-black tabular-nums " + (headTone === "primary" ? "text-primary" : "text-foreground")
          }
        >
          {bdt(headValue)}
        </span>
      </span>
      <div className="flex flex-wrap gap-1">
        <Chip label="buy" value={bdt(buy)} tone="cost" />
        <Chip label="del" value={bdt(delivery)} tone="delivery" />
        <Chip label="pac" value={bdt(packaging)} tone="pack" />
        <Chip label={profit < 0 ? "loss" : "pft"} value={bdt(profit)} tone={profit < 0 ? "loss" : "profit"} />
      </div>
    </div>
  );
}

/** Reseller side: money received from the customer vs what the order cost them. */
export function ResellerTotalCell({ order }: { order: ProfitOrder; showProfit?: boolean }) {
  return (
    <Summary
      headLabel="sell"
      headValue={orderReceived(order)}
      buy={orderKeptProductCost(order)}
      delivery={orderDeliveryCost(order)}
      packaging={orderPackaging(order)}
      profit={orderProfit(order)}
    />
  );
}

/** Admin side: revenue = money received − what the reseller finally earns. */
export function AdminTotalCell({ order, buyingCost }: { order: ProfitOrder; buyingCost: number }) {
  const revenue = orderReceived(order) - orderProfit(order);
  const delivery = orderDeliveryCost(order);
  const packaging = orderPackaging(order);
  const profit = revenue - buyingCost - delivery - packaging;
  return (
    <Summary
      headLabel="rev"
      headValue={revenue}
      headTone="primary"
      buy={buyingCost}
      delivery={delivery}
      packaging={packaging}
      profit={profit}
    />
  );
}
