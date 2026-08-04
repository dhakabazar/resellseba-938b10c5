import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Minus, Plus, ShieldCheck, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { initBkash, initSslcommerz } from "@/lib/payments.functions";
import { productDeliveryCharge, type DeliveryArea } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { addToCart, bdt, clearCart, removeFromCart, setCartQty } from "@/lib/store-cart";
import { useStore } from "@/components/store/store-context";
import { borderc, cx, EmptyState, GhostButton, Heading, muted, PrimaryButton } from "@/components/store/ui";

type Search = { l?: string; q?: number };

export const Route = createFileRoute("/s/$code/checkout")({
  component: Checkout,
  validateSearch: (s: Record<string, unknown>): Search => ({
    l: typeof s.l === "string" ? s.l : undefined,
    q: s.q ? Number(s.q) : undefined,
  }),
});

type PayMethod = { method: string; label: string; instructions: string | null };

const AREAS: { value: DeliveryArea; label: string }[] = [
  { value: "inside_dhaka", label: "Inside Dhaka" },
  { value: "sub_dhaka", label: "Sub Dhaka" },
  { value: "outside_dhaka", label: "Outside Dhaka" },
];

function Checkout() {
  const { code } = Route.useParams();
  const { l: directListing, q: directQty } = Route.useSearch();
  const nav = useNavigate();
  const store = useStore();
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [payMethod, setPayMethod] = useState<string>("cod");
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const runSsl = useServerFn(initSslcommerz);
  const runBkash = useServerFn(initBkash);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    area: "outside_dhaka" as DeliveryArea,
    notes: "",
  });

  /** Direct "Order now" links still work: merge into the cart once. */
  useEffect(() => {
    if (directListing) {
      addToCart(code, directListing, directQty && directQty > 0 ? directQty : 1);
      nav({ to: "/s/$code/checkout", params: { code }, search: {}, replace: true });
    }
  }, [directListing, directQty, code, nav]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("public_payment_methods")
        .select("method,label,instructions,reseller_id")
        .or(`reseller_id.eq.${store.resellerId},reseller_id.is.null`);
      const byMethod = new Map<string, PayMethod & { reseller_id?: string | null }>();
      for (const r of data ?? []) {
        if (!r.method) continue;
        const existing = byMethod.get(r.method);
        if (!existing || (r.reseller_id && !existing.reseller_id))
          byMethod.set(r.method, { method: r.method, label: r.label ?? r.method, instructions: r.instructions, reseller_id: r.reseller_id });
      }
      setMethods(Array.from(byMethod.values()));
    })();
  }, [store.resellerId]);

  const lines = useMemo(
    () =>
      store.cart
        .map((c) => ({ line: c, listing: store.byListingId(c.listingId) }))
        .filter((x) => x.listing) as { line: { listingId: string; qty: number }; listing: NonNullable<ReturnType<typeof store.byListingId>> }[],
    [store.cart, store],
  );

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, x) => s + Number(x.listing.selling_price) * x.line.qty, 0);
    /**
     * Delivery is never summed across products. Each product carries its own
     * delivery method (area / flat / free) and the cart charges only the
     * single highest one — same rule the backend applies.
     */
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

  /** Extra payment options only render when the reseller actually enabled one. */
  const extraMethods = methods.filter((m) => m.method !== "cod");
  const codMeta = methods.find((m) => m.method === "cod");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return;
    setTouched({ name: true, phone: true, address: true });
    if (!valid) {
      toast.error(errors.name || errors.phone || errors.address || "Please check your details");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_public_order", {
      _reseller_code: code,
      _customer_name: sanitizeName(form.name).trim(),
      _customer_phone: normalizePhone(form.phone),
      _customer_email: null as never,
      _address_line: form.address.trim(),
      _city: null as never,
      _area: form.area,
      _landmark: null as never,
      _payment_method: payMethod as never,
      _notes: form.notes.trim() || (null as never),
      _items: lines.map((x) => ({ listing_id: x.listing.id, quantity: x.line.qty })) as never,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.order_number) {
      setBusy(false);
      toast.error("Order could not be created");
      return;
    }

    try {
      if (payMethod === "sslcommerz") {
        const r = await runSsl({ data: { orderNumber: row.order_number, code } });
        clearCart(code);
        window.location.href = r.redirectUrl;
        return;
      }
      if (payMethod === "bkash") {
        const r = await runBkash({ data: { orderNumber: row.order_number, code } });
        clearCart(code);
        window.location.href = r.redirectUrl;
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment init failed");
      setBusy(false);
      return;
    }

    clearCart(code);
    setBusy(false);
    nav({ to: "/s/$code/thanks", params: { code }, search: { n: row.order_number } });
  }

  const inp = cx(
    "w-full rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3.5 py-3 text-base text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)] sm:text-sm",
    borderc,
  );

  if (!lines.length)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Your cart is empty" hint="Add a product to continue to checkout." />
        <div className="mt-6 text-center">
          <Link to="/s/$code" params={{ code }}>
            <GhostButton>Browse products</GhostButton>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:pb-10 sm:pt-8">
      <div className="text-center sm:text-left">
        <Heading as="h1" className="text-2xl sm:text-3xl">
          {store.content.text("co_headline")}
        </Heading>
        <p className={cx("mx-auto mt-1.5 max-w-xl text-sm sm:mx-0", muted)}>{store.content.text("co_note")}</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
        <form
          onSubmit={submit}
          noValidate
          className={cx("space-y-4 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4 sm:p-5", borderc)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" required error={touched.name ? errors.name : null}>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: sanitizeName(e.target.value) })}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                autoComplete="name"
                inputMode="text"
                placeholder="Full name"
                className={inp}
              />
            </Field>

            <Field label="Mobile number" required error={touched.phone ? errors.phone : null} hint="11 digits, starts with 01">
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


          <Field label="Full address" required error={touched.address ? errors.address : null}>
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, address: true }))}
              autoComplete="street-address"
              placeholder="House / road, area, upazila, district"
              className={inp}
            />
          </Field>

          <div>
            <div className="mb-1.5 text-xs font-medium">Delivery area</div>
            <div className="grid grid-cols-3 gap-2">
              {AREAS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setForm({ ...form, area: a.value })}
                  aria-pressed={form.area === a.value}
                  className={cx(
                    "rounded-[var(--st-radius-sm)] border px-2 py-2.5 text-xs font-medium sm:text-sm",
                    form.area === a.value
                      ? "border-[var(--st-primary)] bg-[var(--st-primary)] text-[var(--st-on-primary)]"
                      : cx(borderc, "text-[var(--st-fg)] hover:border-[var(--st-primary)]"),
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setNoteOpen((v) => !v)}
              className={cx("inline-flex items-center gap-1.5 text-xs font-medium", muted, "hover:text-[var(--st-primary)]")}
            >
              <Plus className={cx("h-3.5 w-3.5 transition-transform", noteOpen && "rotate-45")} />
              Add note (optional)
            </button>
            {noteOpen && (
              <textarea
                rows={2}
                autoFocus
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything we should know about your order?"
                className={cx(inp, "mt-2")}
              />
            )}
          </div>

          {extraMethods.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]">Payment method</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {[{ method: "cod", label: "Cash on Delivery", instructions: codMeta?.instructions ?? null }, ...extraMethods].map((m) => (
                  <button
                    type="button"
                    key={m.method}
                    onClick={() => setPayMethod(m.method)}
                    className={cx(
                      "rounded-[var(--st-radius-sm)] border px-3 py-2.5 text-left text-sm",
                      payMethod === m.method
                        ? "border-[var(--st-primary)] bg-[var(--st-primary)]/10 text-[var(--st-fg)]"
                        : borderc,
                    )}
                  >
                    <div className="font-medium capitalize">{m.label}</div>
                    {m.instructions && <div className={cx("text-xs", muted)}>{m.instructions}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {extraMethods.length === 0 && (
            <div className={cx("flex items-start gap-2 rounded-[var(--st-radius-sm)] border border-dashed p-3 text-xs", borderc, muted)}>
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-primary)]" />
              <span>Cash on Delivery — pay the courier when your parcel arrives.</span>
            </div>
          )}

          <div className="hidden sm:block">
            <PrimaryButton disabled={busy} className="w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Place order — {bdt(totals.total)}
            </PrimaryButton>
          </div>
          <p className={cx("flex items-center justify-center gap-2 text-xs sm:justify-start", muted)}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[var(--st-primary)]" /> {store.content.text("co_trust")}
          </p>

          {/* Sticky mobile CTA — same form submit, always in thumb reach. */}
          <div
            className={cx(
              "fixed inset-x-0 bottom-0 z-30 border-t bg-[var(--st-surface)] p-3 shadow-[0_-10px_30px_-24px_rgba(0,0,0,0.6)] sm:hidden",
              borderc,
            )}
          >
            <PrimaryButton disabled={busy} className="w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Place order — {bdt(totals.total)}
            </PrimaryButton>
          </div>
        </form>

        <aside className={cx("h-fit space-y-4 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4 sm:p-5", borderc)}>
          <Heading className="text-base">Your cart ({store.cartCount})</Heading>
          <div className="space-y-3">
            {lines.map(({ line, listing }) => {
              const img = store.image(listing);
              return (
                <div key={listing.id} className={cx("flex gap-3 rounded-[var(--st-radius-sm)] border p-3", borderc)}>
                  {img && <img src={img} alt="" className="h-16 w-16 shrink-0 rounded-[var(--st-radius-sm)] object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm text-[var(--st-fg)]">{store.title(listing)}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className={cx("inline-flex items-center rounded-[var(--st-radius-sm)] border", borderc)}>
                        <button
                          type="button"
                          aria-label="Decrease"
                          onClick={() => setCartQty(code, listing.id, line.qty - 1)}
                          className="px-2.5 py-1.5"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[2.5ch] text-center text-xs font-semibold">{line.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase"
                          onClick={() => setCartQty(code, listing.id, line.qty + 1)}
                          className="px-2.5 py-1.5"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeFromCart(code, listing.id)}
                        className={cx("p-1.5", muted, "hover:text-[var(--st-primary)]")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <span className="ml-auto text-sm font-semibold text-[var(--st-fg)]">
                        {bdt(Number(listing.selling_price) * line.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={cx("space-y-1.5 border-t pt-3 text-sm", borderc)}>
            <Row label="Subtotal" value={bdt(totals.subtotal)} />
            <Row label="Delivery charge" value={totals.ship ? bdt(totals.ship) : "Free"} />
            {totals.multi && (
              <p className={cx("text-[11px] leading-snug", muted)}>
                {totals.ship
                  ? `Highest single-product delivery charge applied${totals.shipFrom ? ` (${totals.shipFrom})` : ""} — charges are not added up.`
                  : "Free delivery on this cart."}
              </p>
            )}
            <Row label="Total payable" value={bdt(totals.total)} bold />

          </div>
          <Link
            to="/s/$code"
            params={{ code }}
            className={cx("flex items-center justify-center gap-1 text-xs hover:text-[var(--st-primary)]", muted)}
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-90" /> Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium text-[var(--st-fg)]">
          {label} {required && <span className="text-[var(--st-primary)]">*</span>}
        </label>
        {hint && !error && <span className={cx("text-[11px]", muted)}>{hint}</span>}
      </div>
      {children}
      {error && <p className="mt-1 text-[11px] font-medium text-[var(--st-primary)]">{error}</p>}
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
