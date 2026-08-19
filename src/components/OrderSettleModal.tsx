/**
 * Admin settlement modal — final money decision of an order.
 * Used for delivered / partial (3 kinds) / return received / damaged.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { orderStatusLabel } from "@/lib/courier-status";
import { bdt } from "@/lib/finance-report";
import { CalcPanel, CalcRow } from "@/components/price-breakdown";

type Item = {
  id: string;
  product_name: string;
  quantity: number;
  returned_qty: number;
  sa_price: number;
  reseller_price: number;
  line_total: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  sa_cost_total: number;
  packaging_total: number;
  delivery_cost: number | null;
  received_amount: number | null;
  settlement_note: string | null;
};

const num = (v: unknown) => Number(v ?? 0) || 0;

export function OrderSettleModal({
  open,
  orderId,
  targetStatus,
  onClose,
  onSaved,
}: {
  open: boolean;
  orderId: string | null;
  targetStatus: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [received, setReceived] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [packaging, setPackaging] = useState(0);
  const [note, setNote] = useState("");

  const itemPartial = targetStatus === "partial_item";
  const failed = targetStatus === "returned";
  const deliveryOnly = targetStatus === "partial_delivery";

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    (async () => {
      const [o, it] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,order_number,customer_name,status,subtotal,discount,shipping_cost,total,sa_cost_total,packaging_total,delivery_cost,received_amount,settlement_note",
          )
          .eq("id", orderId)
          .maybeSingle(),
        supabase
          .from("order_items")
          .select("id,product_name,quantity,returned_qty,sa_price,reseller_price,line_total")
          .eq("order_id", orderId),
      ]);
      const row = o.data as OrderRow | null;
      setOrder(row);
      setItems(((it.data ?? []) as Item[]).map((x) => ({ ...x, returned_qty: num(x.returned_qty) })));
      if (row) {
        const del = num(row.delivery_cost) || num(row.shipping_cost);
        setDelivery(del);
        setPackaging(num(row.packaging_total));
        setNote(row.settlement_note ?? "");
        setReceived(
          targetStatus === "returned"
            ? 0
            : row.received_amount != null
              ? num(row.received_amount)
              : targetStatus === "partial_delivery"
                ? num(row.shipping_cost)
                : num(row.total),
        );
      }
      setLoading(false);
    })();
  }, [open, orderId, targetStatus]);

  const calc = useMemo(() => {
    const fullProduct = Math.max(num(order?.sa_cost_total) - num(order?.packaging_total), 0);
    const fullItemCost = items.reduce((s, i) => s + num(i.sa_price) * i.quantity, 0);
    const keptItemCost = items.reduce(
      (s, i) => s + num(i.sa_price) * Math.max(i.quantity - num(i.returned_qty), 0),
      0,
    );
    const productCost =
      failed || deliveryOnly
        ? 0
        : itemPartial && fullItemCost > 0
          ? Math.round(fullProduct * (keptItemCost / fullItemCost) * 100) / 100
          : fullProduct;
    const recv = failed ? 0 : received;
    const cost = productCost + delivery + packaging;
    return { productCost, cost, recv, profit: Math.round((recv - cost) * 100) / 100 };
  }, [order, items, itemPartial, failed, deliveryOnly, received, delivery, packaging]);

  if (!open || typeof document === "undefined") return null;

  const save = async () => {
    if (!order) return;
    if (itemPartial && !items.some((i) => num(i.returned_qty) > 0)) {
      toast.error("Enter which items were returned (returned qty)");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: targetStatus as never,
        received_amount: failed ? 0 : received,
        delivery_cost: delivery,
        packaging_total: packaging,
        settlement_note: note || null,
        settled_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    if (itemPartial) {
      for (const i of items) {
        await supabase.from("order_items").update({ returned_qty: num(i.returned_qty) }).eq("id", i.id);
      }
    }
    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: targetStatus as never,
      note: note ? `Settled: ${note}` : `Settled as ${orderStatusLabel(targetStatus)}`,
    });
    toast.success(`Order #${order.order_number} settled — ${orderStatusLabel(targetStatus)}`);
    setSaving(false);
    onSaved();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold">Settle order — {orderStatusLabel(targetStatus)}</h3>
            <p className="text-[11px] text-muted-foreground">
              {order ? `#${order.order_number} · ${order.customer_name}` : "Loading…"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading || !order ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label={failed ? "Received (return = 0)" : "Received amount"}
                value={failed ? 0 : received}
                onChange={setReceived}
                disabled={failed}
                hint={`Customer total ${bdt(num(order.total))}`}
              />
              <Field label="Delivery charge (cost)" value={delivery} onChange={setDelivery} hint="Admin cost" />
              <Field label="Packaging cost" value={packaging} onChange={setPackaging} hint="Admin cost" />
            </div>

            {itemPartial && (
              <div className="rounded-lg border">
                <div className="border-b bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Which items were returned
                </div>
                <div className="divide-y">
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{i.product_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Qty {i.quantity} · sell {bdt(num(i.line_total))}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={i.quantity}
                        value={i.returned_qty}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === i.id
                                ? { ...x, returned_qty: Math.min(Math.max(num(e.target.value), 0), x.quantity) }
                                : x,
                            ),
                          )
                        }
                        className="w-20 rounded-md border bg-background px-2 py-1 text-right text-xs tabular-nums"
                      />
                      <span className="text-[11px] text-muted-foreground">returned</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CalcPanel title="Reseller calculation" hint="Received − product cost − delivery − packaging">
              <CalcRow label="Received from customer" value={bdt(calc.recv)} />
              <CalcRow label="− Product cost (kept items)" value={bdt(calc.productCost)} muted />
              <CalcRow label="− Delivery charge" value={bdt(delivery)} muted />
              <CalcRow label="− Packaging" value={bdt(packaging)} muted />
              <CalcRow
                label="Reseller profit / loss"
                value={bdt(calc.profit)}
                strong
                tone={calc.profit >= 0 ? "success" : "danger"}
              />
            </CalcPanel>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Settlement note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Write a short note — it will show in the transaction report"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t bg-muted/10 px-5 py-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-1.5 text-xs font-semibold hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || loading || !order}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving…" : "Settle order"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(num(e.target.value))}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm tabular-nums disabled:opacity-60"
      />
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
