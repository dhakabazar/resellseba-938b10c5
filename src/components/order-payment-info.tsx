import { prepaidAmount } from "@/lib/order-payment";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type OrderPaymentFields = {
  id: string;
  total: number;
  payment_method: string;
  payment_status: string;
  payment_provider?: string | null;
  transaction_id?: string | null;
  payment_sender?: string | null;
  payment_config_id?: string | null;
  paid_amount?: number | null;
  advance_amount?: number | null;
  advance_by?: string | null;
};

const STATUS: Record<string, { t: string; c: string }> = {
  paid: { t: "Paid", c: "bg-success/15 text-success" },
  partial: { t: "Partial", c: "bg-warning/15 text-warning" },
  unpaid: { t: "Unpaid", c: "bg-muted text-muted-foreground" },
  refunded: { t: "Refunded", c: "bg-destructive/15 text-destructive" },
};

/** Who received the money, through which account, txn and paid/unpaid — plus confirm for manual payments. */
export function OrderPaymentInfo({
  order,
  canConfirm,
  onChanged,
}: {
  order: OrderPaymentFields;
  canConfirm?: boolean;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const st = STATUS[order.payment_status] ?? STATUS.unpaid;
  const provider = order.payment_provider?.replace(/^manual:/, "") || null;
  const manual = Boolean(order.payment_config_id);
  const receiver = order.advance_by === "admin" ? "Admin" : order.advance_by === "reseller" ? "Reseller" : null;
  const paid = prepaidAmount(order);

  async function confirm() {
    const v = window.prompt("এই অর্ডারে মোট কত টাকা নিশ্চিতভাবে পেয়েছেন?", String(order.total));
    if (v === null) return;
    const amount = Number(v);
    if (!v.trim() || !Number.isFinite(amount) || amount < paid) return toast.error("সঠিক মোট টাকা দিন; নিশ্চিত পেমেন্ট কমানো যাবে না");
    setBusy(true);
    const { error } = await supabase.rpc("confirm_manual_payment" as never, {
      _order_id: order.id,
      _amount: amount,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment updated");
    onChanged?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold uppercase">{order.payment_method}</span>
      {provider && <span className="text-muted-foreground">via {provider}</span>}
      <span className={"rounded-full px-2 py-0.5 font-semibold " + st.c}>{st.t}</span>
      {paid > 0 && <span className="font-semibold">৳{paid.toLocaleString()}</span>}
      {receiver && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">→ {receiver}</span>
      )}
      {order.transaction_id && <span className="font-mono text-muted-foreground">TrxID {order.transaction_id}</span>}
      {order.payment_sender && <span className="text-muted-foreground">from {order.payment_sender}</span>}
      {manual && canConfirm && order.payment_status !== "paid" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void confirm()}
          className="rounded-md border border-primary px-2 py-0.5 font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {busy ? "…" : "Verify payment"}
        </button>
      )}
    </div>
  );
}
