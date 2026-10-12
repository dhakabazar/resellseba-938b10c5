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
import { getTrackingCookies, trackPurchase } from "@/lib/tracking";
import { useServerFn } from "@tanstack/react-start";
import { getPublicOrderDetailsServer, trackPurchaseServer } from "@/lib/capi.functions";
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

function payLabel(m: string | null) {
  if (!m || m === "cod") return "ক্যাশ অন ডেলিভারি";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function areaLabel(a: string) {
  return a === "inside_dhaka" ? "ঢাকার ভিতরে" : a === "sub_dhaka" ? "ঢাকার আশেপাশে" : "ঢাকার বাইরে";
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
  const getOrderDetails = useServerFn(getPublicOrderDetailsServer);
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
    let alive = true;
    (async () => {
      try {
        const data = await getOrderDetails({ data: { orderNumber: n } });
        if (!alive) return;

        if (data) {
          setOrder(data as unknown as OrderDetail);

          if (!fired.current) {
            fired.current = true;
            const eventId = `pur_${data.order_number}`;
            // 1. Client-side pixel event
            trackPurchase({
              orderNumber: n,
              total: Number(data.total),
              items: (data.order_items ?? []).map((i: any) => ({
                id: i.product_id ?? "",
                name: i.product_name,
                price: Number(i.reseller_price),
                qty: i.quantity,
              })),
              eventId,
            });

            // 2. Server-side CAPI event (deduped by matching eventId)
            const cookies = getTrackingCookies();
            capi({
              data: {
                orderNumber: n,
                code,
                eventId,
                origin: window.location.origin,
                fbp: cookies.fbp,
                fbc: cookies.fbc,
                ttp: cookies.ttp,
                userAgent: cookies.userAgent,
              },
            }).catch((err) => {
              console.error("[ThanksPage] CAPI Purchase failed:", err);
            });
          }
        } else if (!fired.current) {
          // Fallback tracking if order details query returned empty
          fired.current = true;
          const eventId = `pur_${n}`;
          trackPurchase({
            orderNumber: n,
            total: 0,
            eventId,
          });
          const cookies = getTrackingCookies();
          capi({
            data: {
              orderNumber: n,
              code,
              eventId,
              origin: window.location.origin,
              fbp: cookies.fbp,
              fbc: cookies.fbc,
              ttp: cookies.ttp,
              userAgent: cookies.userAgent,
            },
          }).catch(() => {});
        }
      } catch (err) {
        console.error("[ThanksPage] Order load error:", err);
        if (!fired.current && alive) {
          // Order lookup failed — still report the purchase (server reads the order itself).
          fired.current = true;
          const eventId = `pur_${n}`;
          trackPurchase({ orderNumber: n, total: 0, eventId });
          const cookies = getTrackingCookies();
          capi({
            data: { orderNumber: n, code, eventId, origin: window.location.origin, ...cookies },
          }).catch(() => {});
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [n, code, capi, getOrderDetails]);

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
          <Check className="h-3.5 w-3.5" /> অর্ডার সফলভাবে সম্পন্ন হয়েছে
        </div>

        <Heading as="h1" className="mt-3 text-2xl font-extrabold sm:text-3xl lg:text-4xl">
          {(() => {
            const s = content.text("co_success");
            if (!s || s === "Order received!") return "ধন্যবাদ! আপনার অর্ডারটি গ্রহণ করা হয়েছে";
            return s;
          })()}
        </Heading>

        <p className={cx("mx-auto mt-2 max-w-lg text-sm leading-relaxed", muted)}>
          {(() => {
            const sn = content.text("co_success_note");
            if (!sn || sn.startsWith("We will call you shortly")) {
              return "আমাদের প্রতিনিধি দ্রুত আপনার সাথে যোগাযোগ করে অর্ডারটি কনফার্ম করবেন।";
            }
            return sn;
          })()}
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
        <div className={cx("mt-6 overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] shadow-md", borderc)}>
          {/* Header with total */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[var(--st-primary)] to-[var(--st-primary)]/75 px-5 py-5 text-white">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <div className="absolute -bottom-10 right-16 h-20 w-20 rounded-full bg-white/10" />
            <div className="relative flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest opacity-80">মোট বিল</div>
                <div className="mt-1 text-3xl font-extrabold tabular-nums">{bdt(Number(order.total))}</div>
                <div className="mt-1 text-[11px] opacity-85">
                  {itemCount} টি পণ্য · {payLabel(order.payment_method)}
                </div>
              </div>
              <div className="text-right text-[11px] opacity-90">
                <Clock className="ml-auto mb-1 h-4 w-4" />
                {new Date(order.created_at).toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
          </div>

          {/* Items List */}
          {order.order_items && order.order_items.length > 0 && (
            <div className="px-5 pt-4">
              <div className={cx("mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider", muted)}>
                <Package className="h-3.5 w-3.5" /> অর্ডারকৃত পণ্য
              </div>
              <div className="space-y-2">
                {order.order_items.map((it, i) => (
                  <div
                    key={it.id}
                    className={cx("flex items-center gap-3 rounded-[var(--st-radius-sm)] border bg-[var(--st-bg-alt)]/40 p-3", borderc)}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--st-primary)]/12 text-sm font-extrabold text-[var(--st-primary)]">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--st-fg)]">{it.product_name}</div>
                      <div className={cx("mt-0.5 text-xs", muted)}>
                        {bdt(Number(it.reseller_price))} × <span className="font-bold">{it.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold tabular-nums text-[var(--st-fg)]">
                      {bdt(Number(it.reseller_price) * it.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Breakdown */}
          <div className={cx("mx-5 my-4 space-y-2 rounded-[var(--st-radius-sm)] border border-dashed p-4 text-sm", borderc)}>
            <div className="flex justify-between">
              <span className={muted}>পণ্যের দাম</span>
              <span className="font-semibold tabular-nums text-[var(--st-fg)]">{bdt(itemsTotal || Number(order.total))}</span>
            </div>
            <div className="flex justify-between">
              <span className={muted}>ডেলিভারি চার্জ</span>
              <span className="font-semibold tabular-nums text-[var(--st-fg)]">{deliveryFee ? bdt(deliveryFee) : "ফ্রি"}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>ছাড়</span>
                <span className="font-semibold tabular-nums">− {bdt(discount)}</span>
              </div>
            )}
            <div className={cx("flex items-center justify-between border-t pt-3 font-bold text-[var(--st-fg)]", borderc)}>
              <span>সর্বমোট</span>
              <span className="text-xl tabular-nums text-[var(--st-primary)]">{bdt(Number(order.total))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className={muted}>পেমেন্ট</span>
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 font-bold",
                  order.payment_status === "paid"
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-amber-500/15 text-amber-700",
                )}
              >
                {order.payment_status === "paid"
                  ? "পরিশোধিত"
                  : order.payment_status === "partial"
                    ? "আংশিক পরিশোধিত"
                    : "ডেলিভারির সময় পরিশোধ"}
              </span>
            </div>
          </div>

          {/* Customer / Delivery Info */}
          <div className={cx("grid gap-3 border-t px-5 py-4 text-xs sm:grid-cols-2", borderc)}>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-primary)]" />
              <div>
                <div className={cx("text-[10px] font-bold uppercase tracking-wider", muted)}>ডেলিভারি ঠিকানা</div>
                <div className="mt-0.5 font-bold text-[var(--st-fg)]">{order.customer_name}</div>
                <div className={cx("text-[11px]", muted)}>{order.address_line}</div>
                {order.area && <div className={cx("text-[11px]", muted)}>{areaLabel(order.area)}</div>}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-primary)]" />
              <div>
                <div className={cx("text-[10px] font-bold uppercase tracking-wider", muted)}>মোবাইল</div>
                <div className="mt-0.5 font-bold text-[var(--st-fg)]">{order.customer_phone}</div>
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
