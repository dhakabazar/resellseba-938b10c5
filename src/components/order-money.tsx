/**
 * Shared order money panel — the exact same math as the Transaction report.
 * Used by the admin + reseller order list collapse and both order detail drawers.
 * `role="reseller"` hides every admin-only figure (admin invoice / platform margin).
 */
import {
  bdt,
  isFailedOrder,
  orderAdvance,
  orderCost,
  orderDeliveryCost,
  orderKeptProductCost,
  orderPackaging,
  orderProfit,
  orderReceived,
  orderShortfall,
  resellerHeldAdvance,
  type ProfitOrder,
} from "@/lib/finance-report";

type MoneyOrder = ProfitOrder & {
  subtotal?: number | string | null;
  discount?: number | string | null;
};

const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

function Row({
  label,
  value,
  hint,
  tone,
  strong,
  dashed = true,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger" | "muted" | "primary";
  strong?: boolean;
  dashed?: boolean;
}) {
  return (
    <div className={"flex items-start justify-between gap-3 py-1.5 " + (dashed ? "border-b border-dashed border-border/60" : "")}>
      <div className="min-w-0">
        <span className={"text-[12px] " + (strong ? "font-bold" : "font-medium text-foreground/80")}>{label}</span>
        {hint && <div className="text-[10px] leading-snug text-muted-foreground">{hint}</div>}
      </div>
      <span
        className={
          "shrink-0 tabular-nums " +
          (strong ? "text-[13px] font-black " : "text-[12px] font-semibold ") +
          (tone === "success"
            ? "text-success"
            : tone === "danger"
              ? "text-destructive"
              : tone === "primary"
                ? "text-primary"
                : tone === "muted"
                  ? "text-muted-foreground"
                  : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

/** Advance chip that explains the balance effect (same wording as the transaction report). */
export function AdvanceChip({ order, className = "" }: { order: MoneyOrder; className?: string }) {
  const adv = orderAdvance(order);
  if (adv <= 0) return null;
  const byReseller = order.advance_by !== "admin";
  return (
    <span
      className={
        "inline-flex flex-wrap items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold " +
        (byReseller
          ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
          : "border-sky-500/30 bg-sky-500/10 text-sky-600") +
        " " +
        className
      }
    >
      Advance {bdt(adv)}
      <span className="font-semibold opacity-80">
        · {byReseller ? "reseller · deducted from balance" : "admin · balance unchanged"}
      </span>
    </span>
  );
}

export function OrderMoneyPanel({
  order,
  role,
  className = "",
}: {
  order: MoneyOrder;
  role: "admin" | "reseller";
  className?: string;
}) {
  const subtotal = n(order.subtotal);
  const discount = n(order.discount);
  const total = n(order.total);
  const advance = orderAdvance(order);
  const heldByReseller = resellerHeldAdvance(order);
  const received = orderReceived(order);
  const collected = Math.max(received - advance, 0);
  const codDue = Math.max(total - advance, 0);
  const failed = isFailedOrder(order);
  const packaging = orderPackaging(order);
  const delivery = orderDeliveryCost(order);
  const productCost = failed ? 0 : orderKeptProductCost(order);
  const cost = orderCost(order);
  const profit = orderProfit(order);
  const shortfall = orderShortfall(order);
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

  return (
    <div className={"rounded-xl border bg-background p-3 shadow-sm " + className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Money breakdown</h4>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-black " +
            (profit < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")
          }
        >
          {profit < 0 ? "Loss" : "Profit"} {bdt(profit)}
        </span>
      </div>

      <div className="space-y-3">
        <Block title="Customer bill">
          <Row label="Subtotal" value={bdt(subtotal)} />
          <Row label="Delivery charge" value={bdt(n(order.shipping_cost))} />
          {discount > 0 && <Row label="Discount" value={`− ${bdt(discount)}`} tone="danger" />}
          <Row label="Order value" value={bdt(total)} tone="primary" strong dashed={false} />
        </Block>

        <Block title="Collection">
          {advance > 0 ? (
            <>
              <Row
                label="Advance already paid"
                value={bdt(advance)}
                hint={
                  order.advance_by === "admin"
                    ? "Held by admin — no plus/minus on the reseller balance"
                    : "Held by the reseller — deducted from their final amount"
                }
              />
              <Row label="COD to collect" value={bdt(codDue)} hint="Order value − advance" />
            </>
          ) : (
            <Row label="COD to collect" value={bdt(codDue)} />
          )}
          <Row label="Collected by courier" value={bdt(collected)} tone={failed ? "danger" : undefined} />
          <Row
            label="Received (incl. advance)"
            value={bdt(received)}
            hint={advance > 0 ? `Courier ${bdt(collected)} + advance ${bdt(advance)}` : undefined}
            tone={shortfall > 0 ? "danger" : "success"}
            strong
            dashed={false}
          />
          {total > 0 && shortfall > 0 && (
            <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-amber-500/15">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] font-semibold">
                <span className="text-amber-600">{pct}% received</span>
                <span className="text-destructive">short {bdt(shortfall)}</span>
              </div>
            </div>
          )}
        </Block>

        <Block title={role === "admin" ? "Cost side" : "Your cost"}>
          <Row
            label={role === "admin" ? "Product cost" : "Product price (paid to admin)"}
            value={bdt(productCost)}
            hint={failed ? "Parcel came back — no product cost" : undefined}
          />
          <Row label="Delivery charge (courier)" value={bdt(delivery)} />
          <Row label="Packaging" value={bdt(packaging)} />
          <Row label="Total cost" value={bdt(cost)} strong dashed={false} />
        </Block>

        <Block title="Result">
          {heldByReseller > 0 && (
            <Row label="− Advance already with reseller" value={bdt(heldByReseller)} tone="danger" />
          )}
          <Row
            label={
              profit < 0
                ? role === "admin"
                  ? "Reseller loss"
                  : "Your loss"
                : role === "admin"
                  ? "Reseller profit"
                  : "Your profit"
            }
            value={bdt(profit)}
            hint={
              failed
                ? "Failed delivery — delivery charge + packaging loss"
                : "Received − product cost − delivery − packaging"
            }
            tone={profit < 0 ? "danger" : "success"}
            strong
            dashed={false}
          />
        </Block>

        {role === "admin" && (
          <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-2.5 py-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Admin only</div>
            <Row label="Reseller invoice (product + packaging)" value={bdt(n(order.sa_cost_total))} />
            <Row label="Delivery cost set by admin" value={bdt(delivery)} dashed={false} />
          </div>
        )}
      </div>
    </div>
  );
}
