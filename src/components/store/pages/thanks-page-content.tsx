import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MapPin,
  Package,
  Phone,
  PhoneCall,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackPurchase } from "@/lib/tracking";
import { useServerFn } from "@tanstack/react-start";
import { trackPurchaseServer } from "@/lib/capi.functions";
import { verifyGatewayPayment } from "@/lib/gateways.functions";
import { useStore } from "@/components/store/store-context";
import { bdt } from "@/lib/store-cart";
import { borderc, cx, Heading, muted, PrimaryButton } from "@/components/store/ui";

interface OrderDetail {
  id: string;
  order_number: string;
  total: number;
  delivery_charge: number | null;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  area: string | null;
  payment_method: string | null;
  payment_status: string | null;
  created_at: string;
  order_items?: {
    id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    reseller_price: number;
    variant_label?: string | null;
  }[];
}

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
  const { content, settings } = store;
  const poripati = store.theme.id === "poripati";
  const capi = useServerFn(trackPurchaseServer);
  const verifyPayment = useServerFn(verifyGatewayPayment);
  const [payState, setPayState] = useState<"idle" | "checking" | "paid" | "partial" | "failed" | "cancelled">(
    pay ? "checking" : "idle",
  );
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [copied, setCopied] = useState(false);

  const phone = settings?.support_phone?.trim();
  const rawWa = settings?.whatsapp?.replace(/[^\d]/g, "");
  const waUrl = rawWa
    ? `https://wa.me/${rawWa}?text=${encodeURIComponent(`Hello, I placed order #${n}. Could you please update me?`)}`
    : undefined;

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
    if (!n) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,order_number,total,delivery_charge:delivery_fee,customer_name,customer_phone,address_line,area,payment_method,payment_status,created_at,order_items(id,product_id,product_name,reseller_price,quantity,variant_label)")
        .eq("order_number", n)
        .maybeSingle();

      if (data) {
        setOrder(data as unknown as OrderDetail);

        if (!fired.current) {
          fired.current = true;
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
        }
      }
    })();
  }, [n, code, capi]);

  function copyOrderNumber() {
    if (!n) return;
    navigator.clipboard.writeText(n);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const itemsTotal = (order?.order_items ?? []).reduce(
    (sum, item) => sum + Number(item.reseller_price) * item.quantity,
    0,
  );
  const deliveryFee = order?.delivery_charge ?? (order ? Math.max(0, Number(order.total) - itemsTotal) : 0);

  return (
    <div className={cx("mx-auto max-w-2xl px-4 py-12 sm:py-16", poripati && "my-8")}>
      {/* Top Celebratory Header */}
      <div className="text-center">
        <div className="relative mx-auto inline-flex items-center justify-center">
          <div className="absolute -inset-3 rounded-full bg-emerald-500/20 blur-xl dark:bg-emerald-500/15" />
          <div
            className={cx(
              "relative grid h-20 w-20 place-items-center bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30",
              poripati ? "rounded-2xl" : "rounded-full",
            )}
          >
            <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
          </div>
        </div>

        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          <Check className="h-3.5 w-3.5" /> Order Placed Successfully
        </div>

        <Heading as="h1" className="mt-3 text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {content.text("co_success") || "ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে"}
        </Heading>

        <p className={cx("mx-auto mt-2 max-w-lg text-sm leading-relaxed", muted)}>
          {content.text("co_success_note") || "আমাদের প্রতিনিধি দ্রুত আপনার সাথে যোগাযোগ করে অর্ডারটি কনফার্ম করবেন।"}
        </p>

        {payState !== "idle" && <PaymentBanner state={payState} txn={txn} />}
      </div>

      {/* Order Number Quick Pill */}
      <div
        className={cx(
          "mt-8 flex items-center justify-between gap-3 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4 sm:px-6 shadow-sm",
          borderc,
        )}
      >
        <div>
          <div className={cx("text-xs font-medium uppercase tracking-wider", muted)}>Order Reference</div>
          <div className="mt-0.5 font-mono text-lg font-bold tracking-tight text-[var(--st-fg)] sm:text-xl">
            #{n}
          </div>
        </div>
        <button
          onClick={copyOrderNumber}
          aria-label="Copy order number"
          className={cx(
            "inline-flex items-center gap-1.5 rounded-[var(--st-radius-sm)] border px-3 py-1.5 text-xs font-semibold transition-all hover:bg-[var(--st-bg-alt)] active:scale-95",
            borderc,
            copied ? "border-emerald-500 text-emerald-600" : "text-[var(--st-fg)]",
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy #
            </>
          )}
        </button>
      </div>

      {/* Order Process Tracker */}
      <div className={cx("mt-6 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-5 sm:p-6 shadow-sm", borderc)}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--st-fg)]">Next Steps</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 font-bold text-xs">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--st-fg)]">1. অর্ডার প্রাপ্তি</div>
              <div className={cx("mt-0.5 text-[11px] leading-snug", muted)}>আপনার অর্ডার সিস্টেম এ সেভ হয়েছে</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--st-primary)]/15 text-[var(--st-primary)] font-bold text-xs">
              <PhoneCall className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--st-fg)]">2. কনফার্মেশন কল</div>
              <div className={cx("mt-0.5 text-[11px] leading-snug", muted)}>ঠিকানা যাচাইয়ের জন্য কল করা হবে</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--st-bg-alt)] text-[var(--st-muted)] font-bold text-xs">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--st-fg)]">3. হোম ডেলিভারি</div>
              <div className={cx("mt-0.5 text-[11px] leading-snug", muted)}>কুরিয়ারের মাধ্যমে ডেলিভারি সম্পন্ন</div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Summary & Customer Info */}
      {order && (
        <div className={cx("mt-6 overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] shadow-sm", borderc)}>
          <div className={cx("border-b px-5 py-4", borderc)}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--st-fg)]">Order Details</h2>
          </div>

          {/* Items List */}
          {order.order_items && order.order_items.length > 0 && (
            <div className={cx("divide-y px-5 py-2", borderc)}>
              {order.order_items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug text-[var(--st-fg)]">{it.product_name}</div>
                    {it.variant_label && (
                      <div className={cx("text-xs", muted)}>{it.variant_label}</div>
                    )}
                    <div className={cx("text-xs", muted)}>
                      Qty: <span className="font-bold">{it.quantity}</span> × {bdt(Number(it.reseller_price))}
                    </div>
                  </div>
                  <div className="text-right font-bold text-[var(--st-fg)]">
                    {bdt(Number(it.reseller_price) * it.quantity)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Financial Breakdown */}
          <div className={cx("border-t bg-[var(--st-bg-alt)]/50 px-5 py-4 text-xs space-y-1.5", borderc)}>
            <div className="flex justify-between">
              <span className={muted}>Subtotal</span>
              <span className="font-semibold text-[var(--st-fg)]">{bdt(itemsTotal || Number(order.total))}</span>
            </div>
            <div className="flex justify-between">
              <span className={muted}>Delivery Charge</span>
              <span className="font-semibold text-[var(--st-fg)]">{deliveryFee ? bdt(deliveryFee) : "Free"}</span>
            </div>
            <div className={cx("flex justify-between border-t pt-2 text-sm font-bold text-[var(--st-fg)]", borderc)}>
              <span>Total Payable</span>
              <span className="text-base text-[var(--st-primary)]">{bdt(Number(order.total))}</span>
            </div>
          </div>

          {/* Customer / Delivery Info */}
          <div className={cx("border-t px-5 py-4 text-xs space-y-2", borderc)}>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--st-primary)]" />
              <div>
                <span className="font-bold text-[var(--st-fg)]">{order.customer_name}</span> · {order.customer_phone}
                <div className={cx("mt-0.5 text-[11px]", muted)}>{order.address_line}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to={store.url("/")} className="w-full sm:w-auto">
          <PrimaryButton className="w-full justify-center gap-2 py-3.5 sm:px-8">
            <ShoppingBag className="h-4 w-4" /> Continue Shopping <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Link>

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-6 py-3.5 text-sm font-bold transition-colors hover:border-emerald-500 hover:text-emerald-600 sm:w-auto",
              borderc,
            )}
          >
            WhatsApp Support
          </a>
        )}

        {phone && (
          <a
            href={`tel:${phone}`}
            className={cx(
              "inline-flex w-full items-center justify-center gap-2 rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-6 py-3.5 text-sm font-bold transition-colors hover:border-[var(--st-primary)] hover:text-[var(--st-primary)] sm:w-auto",
              borderc,
            )}
          >
            <Phone className="h-4 w-4" /> Call Helpline
          </a>
        )}
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
