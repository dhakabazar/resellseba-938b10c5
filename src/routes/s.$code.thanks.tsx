import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackPurchase } from "@/lib/tracking";
import { useServerFn } from "@tanstack/react-start";
import { trackPurchaseServer } from "@/lib/capi.functions";
import { verifyGatewayPayment } from "@/lib/gateways.functions";
import { useStore } from "@/components/store/store-context";
import { cx, Heading, muted, PrimaryButton } from "@/components/store/ui";

export const Route = createFileRoute("/s/$code/thanks")({
  head: () => ({
    meta: [
      { title: "Order received · Reseller Store" },
      { name: "description", content: "Order confirmation and verified payment result for reseller store customers." },
      { property: "og:title", content: "Order received · Reseller Store" },
      { property: "og:description", content: "View your order number and confirmed payment status after checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): { n: string; pay?: string; txn?: string } => ({
    n: typeof s.n === "string" ? s.n : "",
    ...(typeof s.pay === "string" ? { pay: s.pay } : {}),
    ...(typeof s.txn === "string" ? { txn: s.txn } : {}),
  }),
  component: Thanks,
});

function Thanks() {
  const { code } = Route.useParams();
  const { n, pay, txn } = Route.useSearch();
  const fired = useRef(false);
  const { content } = useStore();
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
      capi({ data: { orderNumber: n, code, eventId } }).catch(() => {});
    })();
  }, [n, code, capi]);


  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--st-primary)]/15 text-[var(--st-primary)]">
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
        <Link to="/s/$code" params={{ code }}>
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
  const map = {
    checking: { icon: <Loader2 className="h-4 w-4 animate-spin" />, title: "Confirming your payment…", tone: "border-[var(--st-border)] text-[var(--st-fg)]" },
    paid: { icon: <CheckCircle2 className="h-4 w-4" />, title: "Payment received", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" },
    failed: { icon: <XCircle className="h-4 w-4" />, title: "Payment was not completed — the order is saved as unpaid", tone: "border-red-500/40 bg-red-500/10 text-red-600" },
    cancelled: { icon: <XCircle className="h-4 w-4" />, title: "Payment cancelled — the order is saved as unpaid", tone: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
    partial: { icon: <AlertTriangle className="h-4 w-4" />, title: "Part of the bill is paid — the rest is due on delivery", tone: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  } as const;
  const m = map[state];
  return (
    <div className={cx("mx-auto mt-5 flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold", m.tone)}>
      {m.icon}
      <span>{m.title}</span>
      {txn && state === "paid" && <span className="font-mono font-normal opacity-80">#{txn}</span>}
    </div>
  );
}
