import { bdt } from "@/lib/finance-report";
import {
  areaLabel,
  globalDelivery,
  resolveDelivery,
  resolvedCharge,
  type ProductDeliveryMode,
} from "@/lib/delivery";

/** One line of a per-unit money breakdown. Used by product create/edit and reseller catalog. */
export function CalcRow({
  label,
  value,
  strong,
  tone,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success" | "danger";
  muted?: boolean;
}) {
  return (
    <div className={"flex items-center justify-between py-1 " + (strong ? "border-t pt-2 font-semibold" : "")}>
      <span className={muted ? "text-xs text-muted-foreground" : "text-xs"}>{label}</span>
      <span
        className={
          "text-sm tabular-nums " +
          (tone === "success" ? "text-success " : tone === "danger" ? "text-destructive " : "") +
          (strong ? "font-semibold" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

export function CalcPanel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export type ProductCalcInput = {
  buying: number;
  resellerPrice: number;
  packaging: number;
  /** `global` = inherit Admin → Advanced settings → Delivery charge. */
  deliveryMode: ProductDeliveryMode;
  deliveryFlat: number;
  deliveryInside: number;
  deliveryOutside: number;
  deliverySub?: number;
  sellPrice: number; // suggested (admin) or reseller's own selling price
};

/** Merge product delivery config over the global rule. */
function resolved(i: ProductCalcInput) {
  return resolveDelivery(
    {
      delivery_mode: i.deliveryMode,
      delivery_flat: i.deliveryFlat,
      delivery_inside: i.deliveryInside,
      delivery_outside: i.deliveryOutside,
      delivery_sub: i.deliverySub ?? null,
    },
    globalDelivery(),
  );
}

export function productCalc(i: ProductCalcInput) {
  const r = resolved(i);
  const dIn = resolvedCharge(r, "inside_dhaka");
  const dSub = resolvedCharge(r, "sub_dhaka");
  const dOut = resolvedCharge(r, "outside_dhaka");
  const resellerCost = i.resellerPrice + i.packaging;
  return {
    mode: r.mode,
    source: r.source,
    dIn,
    dSub,
    dOut,
    adminProfit: i.resellerPrice - i.buying,
    adminReceives: resellerCost,
    resellerCost,
    minSell: resellerCost,
    resellerProfit: i.sellPrice - resellerCost,
    customerInside: i.sellPrice + dIn,
    customerSub: i.sellPrice + dSub,
    customerOutside: i.sellPrice + dOut,
    margin: i.sellPrice > 0 ? ((i.sellPrice - resellerCost) / i.sellPrice) * 100 : 0,
  };
}

function deliveryLabel(i: ProductCalcInput, c: ReturnType<typeof productCalc>) {
  const tag = c.source === "global" ? " · global rule" : "";
  if (c.mode === "free") return `Free shipping (customer pays ৳0)${tag}`;
  if (c.mode === "flat") return `Flat ${bdt(c.dIn)} (all areas)${tag}`;
  if (c.mode === "custom") return `Custom ${bdt(c.dIn)} (editable per order)${tag}`;
  return `${areaLabel("inside_dhaka")} ${bdt(c.dIn)} · ${areaLabel("sub_dhaka")} ${bdt(c.dSub)} · ${areaLabel("outside_dhaka")} ${bdt(c.dOut)}${tag}`;
}

/** Admin-side + reseller-side calculation, side by side. Shown on product create/edit. */
export function AdminProductCalc({ input }: { input: ProductCalcInput }) {
  const c = productCalc(input);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CalcPanel title="Admin calculation" hint="Per unit, on a delivered order">
        <CalcRow label="Reseller price (charged to reseller)" value={bdt(input.resellerPrice)} />
        <CalcRow label="− Buying price" value={bdt(input.buying)} muted />
        <CalcRow label="Admin profit / unit" value={bdt(c.adminProfit)} strong tone={c.adminProfit >= 0 ? "success" : "danger"} />
        <div className="mt-2 border-t pt-2">
          <CalcRow label="+ Packaging collected" value={bdt(input.packaging)} muted />
          <CalcRow label="Admin receives / unit" value={bdt(c.adminReceives)} />
          <CalcRow label="Delivery charge" value={deliveryLabel(input, c)} muted />
        </div>
      </CalcPanel>

      <CalcPanel title="Reseller calculation" hint="Product + packaging is the reseller cost">
        <CalcRow label="Product price" value={bdt(input.resellerPrice)} />
        <CalcRow label="+ Packaging" value={bdt(input.packaging)} muted />
        <CalcRow label="Reseller cost / minimum sell" value={bdt(c.minSell)} strong />
        <div className="mt-2 border-t pt-2">
          <CalcRow label={`Sell price ${bdt(input.sellPrice)} → profit`} value={bdt(c.resellerProfit)} tone={c.resellerProfit >= 0 ? "success" : "danger"} strong />
          <CalcRow label="Margin" value={`${c.margin.toFixed(1)}%`} muted />
          <CalcRow label={`Customer pays (${areaLabel("inside_dhaka")})`} value={bdt(c.customerInside)} muted />
          <CalcRow label={`Customer pays (${areaLabel("sub_dhaka")})`} value={bdt(c.customerSub)} muted />
          <CalcRow label={`Customer pays (${areaLabel("outside_dhaka")})`} value={bdt(c.customerOutside)} muted />
        </div>
      </CalcPanel>
    </div>
  );
}

/** Reseller-only view — never exposes admin buying price. */
export function ResellerProductCalc({ input }: { input: ProductCalcInput }) {
  const c = productCalc(input);
  return (
    <CalcPanel title="Your calculation" hint="Per unit, on a delivered order">
      <CalcRow label="Product price (paid to admin)" value={bdt(input.resellerPrice)} />
      <CalcRow label="+ Packaging (paid to admin)" value={bdt(input.packaging)} muted />
      <CalcRow label="Your cost / minimum sell" value={bdt(c.minSell)} strong />
      <div className="mt-2 border-t pt-2">
        <CalcRow label={`Your sell price ${bdt(input.sellPrice)} → profit`} value={bdt(c.resellerProfit)} strong tone={c.resellerProfit >= 0 ? "success" : "danger"} />
        <CalcRow label="Margin" value={`${c.margin.toFixed(1)}%`} muted />
        <CalcRow label="Delivery (collected from customer)" value={deliveryLabel(input, c)} muted />
        <CalcRow label={`Customer pays (${areaLabel("inside_dhaka")})`} value={bdt(c.customerInside)} muted />
        <CalcRow label={`Customer pays (${areaLabel("sub_dhaka")})`} value={bdt(c.customerSub)} muted />
        <CalcRow label={`Customer pays (${areaLabel("outside_dhaka")})`} value={bdt(c.customerOutside)} muted />
      </div>
    </CalcPanel>
  );
}
