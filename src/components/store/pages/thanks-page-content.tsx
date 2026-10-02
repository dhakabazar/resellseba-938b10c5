import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackPurchase } from "@/lib/tracking";
import { useServerFn } from "@tanstack/react-start";
import { trackPurchaseServer } from "@/lib/capi.functions";
import { verifyGatewayPayment } from "@/lib/gateways.functions";
import { useStore } from "@/components/store/store-context";
import { cx, Heading, muted, PrimaryButton } from "@/components/store/ui";

export function ThanksPageContent({
  code: propCode,
  n,
  pay,
  txn,
}: {
  code?: string;
  n: string;
  pay?: string;
  txn?: string;
}) {
  const store = useStore();
  const code = propCode || store.code;
  const fired = useRef(false);
  const { content } = store;
  const poripati = store.theme.id === "poripati";
  const capi = useServerFn(trackPurchaseServer);
  const verifyPayment = useServerFn(verifyGatewayPayment);
  const [payState, setPayState] = useState<"idle" | "checking" | "paid" | "partial" | "failed" | "cancelled">(
    pay ? "checking" : "idle",
  );

  /** An online payment came back — re-confirm with the gateway, never trust the URL. */
  useEffect(() => {
    if (!pay || !n) return;
    if (pay === "cancelled") {
      setPayState("cancelled");
      return;
    }
    setPayState("checking");
    verifyPayment({ data: { orderNumber: n } })
      .then((r) => setPayState(r.status === "paid" ? "paid" : r.status === "partial" ? "partial" : "failed"))
      .catch(() => setPayState("failed"));
  }, [pay, n, verifyPayment]);

  useEffect(() => {
    if (!n || fired.current) return;
    fired.current = true;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,total,order_items(product_id,product_name,reseller_price,quantity)")
        .eq("order_number", n)
        .maybeSingle();
      if (!data) return;
      const eventId = `purchase_${data.id}`;
      trackPurchase({
        orderNumber: n,
        total: Number(data.total),
        items: (data.order_items ?? []).map((i) => ({
          id: i.product_id ?? "",
          name: i.product_name,
          price: Number(i.reseller_price),
          qty: i.quantity,
        })),
        eventId,
      });
      // fire server-side CAPI (deduped by eventId)
      capi({ data: { orderNumber: n, code, eventId, origin: window.location.origin } }).catch(() => {});
    })();
  }, [n, code, capi]);

  return (
    <div className={cx("mx-auto max-w-md px-4 py-20 text-center", poripati && "my-10 border-y border-[var(--st-border)]")}>
      <div className={cx("mx-auto grid h-16 w-16 place-items-center bg-[var(--st-primary)]/15 text-[var(--st-primary)]", !poripati && "rounded-full")}>
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <Heading as="h1" className="mt-5 text-2xl md:text-3xl">
        {content.text("co_success")}
      </Heading>
      <p className={cx("mt-3 text-sm", muted)}>
        Order number: <span className="font-mono font-semibold text-[var(--st-fg)]">{n}</span>
      </p>
      {payState !== "idle" && <PaymentBanner state={payState} txn={txn} />}
      <p className={cx("mt-2 text-sm leading-relaxed", muted)}>{content.text("co_success_note")}</p>
      <div className="mt-7 flex justify-center">
        <Link to={store.url("/")}>
          <PrimaryButton>Continue shopping</PrimaryButton>
        </Link>
      </div>
    </div>
  );
}

/** Online-payment outcome, shown only when the customer returns from a gateway. */
function PaymentBanner({
  state,
  txn,
}: {
  state: "checking" | "paid" | "partial" | "failed" | "cancelled";
  txn?: string;
}) {
  if (state === "checking")
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <Loader2 className="h-4 w-4 animate-spin" /> Verifying payment with gateway…
      </div>
    );
  if (state === "paid")
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" /> Payment successful
        {txn && <span className="font-mono opacity-75">· {txn}</span>}
      </div>
    );
  if (state === "partial")
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
        <CheckCircle2 className="h-4 w-4" /> Advance payment recorded · remaining amount will be COD.
      </div>
    );
  if (state === "cancelled")
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" /> Payment was cancelled · your order has been placed as Cash on Delivery.
      </div>
    );
  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
      <XCircle className="h-4 w-4" /> Online payment failed · order is recorded as Cash on Delivery.
    </div>
  );
}
