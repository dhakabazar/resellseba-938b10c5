import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, Loader2, Minus, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addToCart, clearCart, removeFromCart, setCartQty } from "@/lib/store-cart";
import { areaOptions, productDeliveryCharge, type DeliveryArea } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { bdt } from "@/lib/finance-report";
import { useAdvancedSettings } from "@/lib/advanced-settings";
import { useServerFn } from "@tanstack/react-start";
import { listActiveGateways, startGatewayPayment } from "@/lib/gateways.functions";
import { PaymentLogo } from "@/components/payments/payment-brand";
import { useStore } from "@/components/store/store-context";
import { borderc, cx, EmptyState, GhostButton, Heading, muted, PrimaryButton, ProductGrid, SectionHead } from "@/components/store/ui";
import { Button } from "@/components/ui/button";
import { PoripatiGrid } from "@/components/store/themes/poripati";

type PayMethod = { method: string; label: string; instructions: string | null };
type GatewayOption = { value: string; method: string; label: string; instructions: null; provider: string };

function useAreas() {
  const { settings } = useAdvancedSettings();
  return areaOptions(settings.delivery);
}

export function CheckoutPageContent({
  code: propCode,
  directListing,
  directQty,
  payFlag,
}: {
  code?: string;
  directListing?: string;
  directQty?: number;
  payFlag?: string;
}) {
  const AREAS = useAreas();
  const store = useStore();
  const code = propCode || store.code;
  const nav = useNavigate();
  const poripati = store.theme.id === "poripati";
  const [recVisible, setRecVisible] = useState(16);
  /** Manual methods arrive with the storefront bootstrap payload — no extra call. */
  const methods: PayMethod[] = store.paymentMethods.map((m) => ({
    method: m.method,
    label: m.label ?? m.method,
    instructions: m.instructions,
  }));
  const [payMethod, setPayMethod] = useState<string>("cod");
  const [manualSender, setManualSender] = useState<string>("");
  const [manualTrxId, setManualTrxId] = useState<string>("");
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [gateways, setGateways] = useState<{ provider: string; label: string; method: string }[]>([]);
  const loadGateways = useServerFn(listActiveGateways);
  const startPayment = useServerFn(startGatewayPayment);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "outside_dhaka" as DeliveryArea,
    notes: "",
  });

  const lines = useMemo(
    () =>
      store.cart
        .map((c) => ({ line: c, listing: store.byListingId(c.listingId) }))
        .filter((x) => x.listing) as { line: { listingId: string; qty: number }; listing: NonNullable<ReturnType<typeof store.byListingId>> }[],
    [store.cart, store],
  );

  const cartListingIds = useMemo(() => new Set(lines.map((l) => l.listing.id)), [lines]);
  const recommended = useMemo(
    () => store.listings.filter((l) => !cartListingIds.has(l.id)),
    [store.listings, cartListingIds],
  );

  const inlineBtnRef = useRef<HTMLDivElement | null>(null);
  const [isInlineBtnVisible, setIsInlineBtnVisible] = useState(false);

  useEffect(() => {
    const el = inlineBtnRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInlineBtnVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lines.length]);

  /** Direct "Order now" links still work: merge into the cart once. */
  useEffect(() => {
    if (directListing) {
      addToCart(code, directListing, directQty && directQty > 0 ? directQty : 1);
      nav({ to: store.url("/checkout"), search: {}, replace: true });
    }
  }, [directListing, directQty, code, nav, store]);

  /**
   * The shopper came back from a gateway without paying (cancelled or failed).
   * They land here, on their own store, so they can retry or switch to COD.
   */
  useEffect(() => {
    if (!payFlag) return;
    toast.error(
      payFlag === "cancelled"
        ? "Payment was cancelled — your cart is still here, try again or choose Cash on Delivery."
        : "Payment did not go through — please try again or choose Cash on Delivery.",
    );
    nav({ to: store.url("/checkout"), search: {}, replace: true });
  }, [payFlag, code, nav, store]);

  /** Automatic gateways come from the server (credentials never reach the browser). */
  useEffect(() => {
    loadGateways({ data: { code } })
      .then((rows) => setGateways(rows))
      .catch(() => setGateways([]));
  }, [code, loadGateways]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, x) => s + Number(x.listing.selling_price) * x.line.qty, 0);
    const perItem = lines.map((x) => ({
      name: x.listing.custom_title || x.listing.product?.name || "Product",
      charge: productDeliveryCharge(x.listing.product ?? {}, form.area, {
        inside: x.listing.extra_delivery_inside,
        outside: x.listing.extra_delivery_outside,
      }),
    }));
    const top = perItem.reduce<{ name: string; charge: number } | null>(
      (best, i) => (!best || i.charge > best.charge ? i : best),
      null,
    );
    const ship = top ? top.charge : 0;
    return { subtotal, ship, total: subtotal + ship, shipFrom: top?.name ?? null, multi: perItem.length > 1 };
  }, [lines, form.area]);

  const errors = {
    name: nameError(form.name),
    phone: phoneError(form.phone),
    address: addressError(form.address),
  };
  const valid = !errors.name && !errors.phone && !errors.address;

  const extraMethods = methods.filter((m) => m.method !== "cod");
  const gatewayOptions: GatewayOption[] = gateways.map((g) => ({
    value: `api:${g.provider}`,
    method: g.method,
    label: g.label,
    instructions: null,
    provider: g.provider,
  }));
  const codMeta = methods.find((m) => m.method === "cod");
  const activeManualMethod = extraMethods.find((m) => m.method === payMethod);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return;
    setTouched({ name: true, phone: true, address: true });
    if (!valid) {
      toast.error(errors.name || errors.phone || errors.address || "Please check your details");
      return;
    }

    // If a manual personal payment method is chosen, enforce mandatory Transaction ID (TrxID)
    if (activeManualMethod) {
      if (!manualTrxId.trim()) {
        toast.error("অনুগ্রহ করে ট্রানজেকশন আইডি (Transaction ID) প্রদান করুন।");
        return;
      }
    }

    setBusy(true);
    const gateway = gatewayOptions.find((g) => g.value === payMethod);

    // Build combined order notes including manual payment details if applicable
    let finalNotes = form.notes.trim();
    if (activeManualMethod) {
      const paymentNoteParts: string[] = [];
      if (manualSender.trim()) paymentNoteParts.push(`Sender: ${manualSender.trim()}`);
      paymentNoteParts.push(`TrxID: ${manualTrxId.trim()}`);
      const paymentInfoTag = `[Manual Payment: ${activeManualMethod.label}${paymentNoteParts.length ? ` | ${paymentNoteParts.join(" | ")}` : ""}]`;
      finalNotes = finalNotes ? `${finalNotes}\n${paymentInfoTag}` : paymentInfoTag;
    }

    const { data, error } = await supabase.rpc("create_public_order", {
      _reseller_code: code,
      _customer_name: sanitizeName(form.name).trim(),
      _customer_phone: normalizePhone(form.phone),
      _customer_email: null as never,
      _address_line: form.address.trim(),
      _city: null as never,
      _area: form.area,
      _landmark: null as never,
      _payment_method: (gateway ? gateway.method : payMethod) as never,
      _notes: finalNotes || (null as never),
      _items: lines.map((x) => ({ listing_id: x.listing.id, quantity: x.line.qty })) as never,
    });

    if (error) {
      setBusy(false);
      toast.error(error.message || "অর্ডার সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.order_number) {
      setBusy(false);
      toast.error("Order could not be created");
      return;
    }

    if (gateway) {
      try {
        const r = await startPayment({
          data: {
            orderNumber: row.order_number,
            code,
            provider: gateway.provider,
            storeOrigin: window.location.origin,
          },
        });
        clearCart(code);
        window.location.href = r.redirectUrl;
        return;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Payment could not be started");
        setBusy(false);
        return;
      }
    }

    clearCart(code);
    setBusy(false);
    nav({ to: store.url("/thanks"), search: { n: row.order_number } });
  }

  const inp =
    "w-full bg-transparent text-sm text-[var(--st-fg)] outline-none placeholder:text-muted-foreground/35 placeholder:font-normal leading-relaxed";

  if (!lines.length)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Your cart is empty" hint="Add a product to continue to checkout." />
        <div className="mt-6 text-center">
          <Link to={store.url("/")}>
            <GhostButton>Browse products</GhostButton>
          </Link>
        </div>
      </div>
    );

  function getAreaCharge(areaVal: DeliveryArea) {
    if (!lines.length) return 0;
    const perItem = lines.map((x) =>
      productDeliveryCharge(x.listing.product ?? {}, areaVal, {
        inside: x.listing.extra_delivery_inside,
        outside: x.listing.extra_delivery_outside,
      })
    );
    return Math.max(0, ...perItem);
  }

  const AREA_NAMES: Record<string, string> = {
    inside_dhaka: "ঢাকার ভেতরে",
    sub_dhaka: "সাব ঢাকা",
    outside_dhaka: "ঢাকার বাইরে",
  };

  return (
    <div className={cx("mx-auto px-1.5 sm:px-4 pb-6 pt-4 sm:pb-10 sm:pt-8", poripati ? "max-w-7xl" : "max-w-6xl")}>
      <div className={cx("text-center px-1", poripati && "border-b border-[var(--st-border)] pb-7")}>
        {poripati && <div className="mb-2 text-[10px] font-bold uppercase text-[var(--st-primary)]">নিরাপদ চেকআউট</div>}
        <Heading as="h1" className="text-xl sm:text-3xl font-extrabold text-center">
          {(() => {
            const h = store.content.text("co_headline");
            if (!h || h === "Complete your order") return "অর্ডার সম্পন্ন করুন";
            return h;
          })()}
        </Heading>
        <p className={cx("mx-auto mt-1 max-w-xl text-xs sm:text-sm text-center", muted)}>
          {(() => {
            const n = store.content.text("co_note");
            if (!n || n.startsWith("Fill in your delivery details")) {
              return "আপনার সঠিক তথ্য দিয়ে অর্ডার কনফার্ম করুন। আমাদের টিম ডেলিভারির আগে কল করে কনফার্ম করবে।";
            }
            return n;
          })()}
        </p>
      </div>

      <div className={cx("mt-4 sm:mt-6 grid gap-3 sm:gap-5", poripati ? "lg:grid-cols-[1.15fr_.85fr] lg:gap-12" : "lg:grid-cols-[1fr_380px]")}>
        <form
          id="checkout-form"
          onSubmit={submit}
          noValidate
          className={cx("space-y-3.5 sm:space-y-4 border bg-[var(--st-surface)] p-2.5 sm:p-5", borderc, !poripati && "rounded-[var(--st-radius)]")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="আপনার নাম" required error={touched.name ? errors.name : null}>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: sanitizeName(e.target.value) })}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                autoComplete="name"
                inputMode="text"
                placeholder="আপনার পুরো নাম লিখুন"
                className={inp}
              />
            </Field>

            <Field label="মোবাইল নম্বর" required error={touched.phone ? errors.phone : null}>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value) })}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                autoComplete="tel"
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                className={cx(inp, "tracking-[0.06em]")}
              />
            </Field>
          </div>

          <Field label="সম্পূর্ণ ঠিকানা" required error={touched.address ? errors.address : null}>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, address: true }))}
              autoComplete="street-address"
              placeholder="বাসা/রোড নম্বর, এলাকা, থানা, জেলা"
              className={inp}
            />
          </Field>

          {/* Collapsible Order note right below address */}
          <div>
            <button
              type="button"
              onClick={() => setNoteOpen((prev) => !prev)}
              className={cx(
                "inline-flex items-center gap-1 text-xs font-semibold text-[var(--st-primary)] hover:opacity-85 transition-opacity py-0.5",
              )}
            >
              {noteOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              <span>{noteOpen ? "অর্ডার নোট লুকান" : "অর্ডার নোট"}</span>
            </button>

            {noteOpen && (
              <div className="mt-2">
                <Field label="অর্ডার নোট">
                  <textarea
                    rows={2}
                    autoFocus
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="পণ্য বা ডেলিভারি সম্পর্কে বিশেষ কিছু জানানোর থাকলে লিখুন..."
                    className={inp}
                  />
                </Field>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--st-fg)]">ডেলিভারি এলাকা</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {AREAS.map((a) => {
                const charge = getAreaCharge(a.value);
                const chargeText = charge === 0 ? "ফ্রি" : `৳${charge}`;
                const isSelected = form.area === a.value;

                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setForm({ ...form, area: a.value })}
                    aria-pressed={isSelected}
                    className={cx(
                      "flex items-center justify-center gap-1 sm:gap-1.5 rounded-[var(--st-radius-sm)] border py-2 px-1.5 sm:px-2.5 text-center transition-all whitespace-nowrap",
                      isSelected
                        ? "border-[var(--st-primary)] bg-[var(--st-primary)] text-[var(--st-on-primary)] shadow-sm font-bold"
                        : cx(borderc, "text-[var(--st-fg)] hover:border-[var(--st-primary)]/60 bg-[var(--st-surface)] font-medium"),
                    )}
                  >
                    <span className="text-[11px] sm:text-xs font-semibold">{AREA_NAMES[a.value] || a.label}</span>
                    <span
                      className={cx(
                        "text-[11px] sm:text-xs font-bold",
                        isSelected ? "opacity-95 text-[var(--st-on-primary)]" : "text-[var(--st-primary)]",
                      )}
                    >
                      {chargeText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--st-fg)]">পেমেন্ট মেথড</div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
              {[
                {
                  value: "cod",
                  method: "cod",
                  label: "ক্যাশ অন ডেলিভারি",
                  instructions: codMeta?.instructions ?? "পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন।",
                },
                ...extraMethods.map((m) => ({ ...m, value: m.method })),
                ...gatewayOptions,
              ].map((m) => {
                const selected = payMethod === m.value;
                const online = "provider" in m;
                const logoFor = (online ? m.provider : m.method) as string;
                return (
                  <button
                    type="button"
                    key={m.value}
                    onClick={() => setPayMethod(m.value)}
                    aria-pressed={selected}
                    className={cx(
                      "group relative flex items-center gap-1.5 sm:gap-2 rounded-[var(--st-radius-sm)] border p-1.5 sm:py-2 sm:px-2.5 text-left transition-all",
                      selected
                        ? "border-[var(--st-primary)] bg-[var(--st-primary)]/[0.08] ring-1 ring-[var(--st-primary)]"
                        : cx(borderc, "hover:border-[var(--st-primary)]/60 bg-[var(--st-surface)]"),
                    )}
                  >
                    <span
                      className={cx(
                        "grid h-7 w-8 shrink-0 place-items-center overflow-hidden rounded-[var(--st-radius-sm)] border bg-[var(--st-bg-alt)] p-0.5 sm:h-8 sm:w-9",
                        selected ? "border-[var(--st-primary)]" : borderc,
                      )}
                    >
                      {m.value === "cod" ? (
                        <Truck className="h-4 w-4 text-[var(--st-primary)]" />
                      ) : (
                        <PaymentLogo method={logoFor} width={32} height={22} fit="contain" alt={m.label} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] sm:text-xs font-bold leading-tight text-[var(--st-fg)] line-clamp-2">{m.label}</span>
                    </span>
                    <span
                      aria-hidden
                      className={cx(
                        "grid h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 place-items-center rounded-full border transition-all",
                        selected ? "border-[var(--st-primary)] bg-[var(--st-primary)] text-white" : borderc,
                      )}
                    >
                      {selected && <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-on-primary)]" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Manual Personal Payment Instructions & Input Drawer */}
            {activeManualMethod && (
              <div className={cx("mt-4 overflow-hidden rounded-[var(--st-radius-sm)] border-2 border-[var(--st-primary)] bg-[var(--st-surface)] shadow-md")}>
                {/* Highlighted Banner */}
                <div className="bg-gradient-to-r from-[var(--st-primary)] to-[var(--st-accent)] p-4 text-[var(--st-on-primary)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full">
                      {activeManualMethod.label} পার্সোনাল পেমেন্ট
                    </span>
                    <span className="text-[11px] font-semibold opacity-90">Send Money</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/25 p-3 backdrop-blur-sm">
                    <div>
                      <div className="text-[11px] opacity-85">সেন্ড মানি নম্বর (Send Money Number):</div>
                      <div className="text-lg sm:text-xl font-mono font-black tracking-wider text-white select-all">
                        01710778457
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("01710778457");
                        setCopiedNumber(true);
                        toast.success("নম্বর কপি করা হয়েছে: 01710778457");
                        setTimeout(() => setCopiedNumber(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-2 text-xs font-bold text-[var(--st-primary)] shadow-sm transition-all hover:bg-white/95 active:scale-95"
                    >
                      {copiedNumber ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      {copiedNumber ? "কপি হয়েছে" : "নম্বর কপি করুন"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-relaxed opacity-95">
                    📢 <strong>01710778457</strong> নম্বরে Send Money করে নিচে Transaction ID দিয়ে সাবমিট করুন।
                  </p>
                </div>

                {/* Additional instructions if present */}
                {activeManualMethod.instructions && activeManualMethod.instructions !== "01710778457" && (
                  <div className={cx("border-b bg-[var(--st-bg-alt)]/60 p-3 text-xs leading-relaxed", borderc, muted)}>
                    {activeManualMethod.instructions}
                  </div>
                )}

                {/* Form fields */}
                <div className="p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="ট্রানজেকশন আইডি (TrxID)" required hint="টাকা পাঠানোর পর প্রাপ্ত TrxID">
                      <input
                        type="text"
                        required
                        value={manualTrxId}
                        onChange={(e) => setManualTrxId(e.target.value)}
                        placeholder="TrxID দিন (যেমন: 9J28DA10X)"
                        className={cx(inp, "uppercase font-mono tracking-wider font-semibold")}
                      />
                    </Field>
                    <Field label="টাকা পাঠানোর নম্বর" hint="ঐচ্ছিক">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={manualSender}
                        onChange={(e) => setManualSender(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className={cx(inp, "tracking-wide")}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Bottom CTA Bar (Mobile & PC) - shown only when the inline button is scrolled out of view */}
          <div
            className={cx(
              "fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--st-surface)]/95 backdrop-blur-md p-3 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)] transition-all duration-300",
              borderc,
              isInlineBtnVisible ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100",
            )}
          >
            <div className="mx-auto max-w-lg">
              <PrimaryButton
                type="submit"
                form="checkout-form"
                onClick={submit}
                disabled={busy}
                className="w-full py-3.5 text-base font-bold justify-center animate-order-jiggle shadow-md"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> অর্ডার প্রসেস হচ্ছে...
                  </>
                ) : (
                  `অর্ডার কনফার্ম করুন — ${bdt(totals.total)}`
                )}
              </PrimaryButton>
            </div>
          </div>
        </form>

        <aside className={cx("h-fit space-y-3.5 sm:space-y-4 border bg-[var(--st-surface)] p-2.5 sm:p-5", borderc, !poripati && "rounded-[var(--st-radius)]", poripati && "lg:sticky lg:top-32")}>
          <Heading className="text-sm sm:text-base font-bold">আপনার কার্ট ({store.cartCount})</Heading>
          <div className="space-y-2.5 sm:space-y-3">
            {lines.map(({ line, listing }) => {
              const img = store.image(listing);
              return (
                <div key={listing.id} className={cx("flex gap-2.5 sm:gap-3 rounded-[var(--st-radius-sm)] border p-2 sm:p-3", borderc)}>
                  {img && <img src={img} alt="" className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-[var(--st-radius-sm)] object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs sm:text-sm text-[var(--st-fg)] font-medium">{store.title(listing)}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className={cx("inline-flex items-center rounded-[var(--st-radius-sm)] border", borderc)}>
                        <button
                          type="button"
                          aria-label="Decrease"
                          onClick={() => setCartQty(code, listing.id, line.qty - 1)}
                          className="px-2 py-1 sm:px-2.5 sm:py-1.5"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[2.5ch] text-center text-xs font-semibold">{line.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase"
                          onClick={() => setCartQty(code, listing.id, line.qty + 1)}
                          className="px-2 py-1 sm:px-2.5 sm:py-1.5"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeFromCart(code, listing.id)}
                        className={cx("p-1", muted, "hover:text-[var(--st-primary)]")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <span className="ml-auto text-xs sm:text-sm font-bold text-[var(--st-fg)]">
                        {bdt(Number(listing.selling_price) * line.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cx("space-y-1.5 border-t pt-3 text-sm", borderc)}>
            <Row label="সাবটোটাল" value={bdt(totals.subtotal)} />
            <Row label="ডেলিভারি চার্জ" value={totals.ship ? bdt(totals.ship) : "ফ্রি"} />
            <Row label="সর্বমোট পরিশোধযোগ্য" value={bdt(totals.total)} bold />
          </div>

          {/* Inline Order button under cart summary (visible on all devices including mobile) */}
          <div ref={inlineBtnRef} className="pt-2">
            <PrimaryButton
              type="submit"
              form="checkout-form"
              onClick={submit}
              disabled={busy}
              className="w-full py-3.5 text-base font-bold justify-center animate-order-jiggle shadow-md"
            >
              {busy ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> অর্ডার প্রসেস হচ্ছে...
                </>
              ) : (
                `অর্ডার কনফার্ম করুন — ${bdt(totals.total)}`
              )}
            </PrimaryButton>
          </div>
        </aside>
      </div>

      {recommended.length > 0 && (
        <section className="mt-12 sm:mt-16 border-t border-[var(--st-border)] pt-8 sm:pt-10">
          <SectionHead title="আপনার পছন্দ হতে পারে" subtitle="অন্যান্য আকর্ষণীয় ও জনপ্রিয় পণ্যসমূহ" />
          {poripati ? (
            <PoripatiGrid listings={recommended.slice(0, recVisible)} />
          ) : (
            <ProductGrid listings={recommended.slice(0, recVisible)} />
          )}
          {recVisible < recommended.length && (
            <div className="mt-8 sm:mt-10 flex justify-center">
              <Button
                variant="outline"
                className="rounded-full px-8 py-2.5 font-bold text-sm hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] transition-colors shadow-sm"
                onClick={() => setRecVisible((v) => v + 16)}
              >
                আরও দেখুন
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="pt-2">
      <div
        className={cx(
          "relative rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3 pt-2.5 pb-2 sm:px-3.5 sm:pt-3 sm:pb-2.5 transition-all focus-within:border-[var(--st-primary)] focus-within:ring-1 focus-within:ring-[var(--st-primary)]/30",
          error ? "border-destructive ring-1 ring-destructive/30" : borderc,
          className,
        )}
      >
        <label className="absolute -top-2.5 left-3 z-10 flex items-center gap-1 bg-[var(--st-surface)] px-1.5 text-xs sm:text-[13px] font-bold text-[var(--st-fg)] leading-none select-none pointer-events-none">
          <span>{label}</span>
          {required && <span className="text-destructive font-bold text-sm leading-none">*</span>}
        </label>
        {hint && !error && (
          <span className={cx("absolute -top-2.5 right-3 z-10 bg-[var(--st-surface)] px-1.5 text-[10px] sm:text-[11px] font-medium opacity-80 leading-none", muted)}>
            {hint}
          </span>
        )}
        {children}
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-destructive px-1">{error}</p>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cx("flex justify-between", bold ? "text-base font-semibold text-[var(--st-fg)]" : muted)}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
