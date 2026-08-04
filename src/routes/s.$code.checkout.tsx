import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { initBkash, initSslcommerz } from "@/lib/payments.functions";
import { productDeliveryCharge, type DeliveryArea } from "@/lib/delivery";
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

function Checkout() {
  const { code } = Route.useParams();
  const { l: directListing, q: directQty } = Route.useSearch();
  const nav = useNavigate();
  const store = useStore();
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [payMethod, setPayMethod] = useState<string>("cod");
  const [busy, setBusy] = useState(false);
  const runSsl = useServerFn(initSslcommerz);
  const runBkash = useServerFn(initBkash);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    area: "outside_dhaka" as DeliveryArea,
    landmark: "",
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
    /** Delivery follows backend rule: highest single-item charge in the cart. */
    const ship = lines.reduce(
      (max, x) =>
        Math.max(
          max,
          productDeliveryCharge(x.listing.product ?? {}, form.area, {
            inside: x.listing.extra_delivery_inside,
            outside: x.listing.extra_delivery_outside,
          }),
        ),
      0,
    );
    return { subtotal, ship, total: subtotal + ship };
  }, [lines, form.area]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_public_order", {
      _reseller_code: code,
      _customer_name: form.name,
      _customer_phone: form.phone,
      _customer_email: form.email || (null as never),
      _address_line: form.address,
      _city: form.city || (null as never),
      _area: form.area,
      _landmark: form.landmark || (null as never),
      _payment_method: payMethod as never,
      _notes: form.notes || (null as never),
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
    "w-full rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3 py-2.5 text-sm text-[var(--st-fg)] outline-none placeholder:text-[var(--st-muted)] focus:border-[var(--st-primary)]",
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Heading as="h1" className="text-2xl md:text-3xl">
        {store.content.text("co_headline")}
      </Heading>
      <p className={cx("mt-1 text-sm", muted)}>{store.content.text("co_note")}</p>


      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className={cx("space-y-4 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-5", borderc)}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Full name" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
            </Field>
            <Field label="Phone" required>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="017XXXXXXXX" className={inp} />
            </Field>
          </div>
          <Field label="Email (optional)">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
          </Field>
          <Field label="Full address" required>
            <textarea required rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inp} />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="City">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inp} />
            </Field>
            <Field label="Delivery area" required>
              <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as DeliveryArea })} className={inp}>
                <option value="inside_dhaka">Inside Dhaka</option>
                <option value="sub_dhaka">Sub Dhaka</option>
                <option value="outside_dhaka">Outside Dhaka</option>
              </select>
            </Field>
            <Field label="Landmark">
              <input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className={inp} />
            </Field>
          </div>
          <Field label="Order notes">
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inp} />
          </Field>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]">Payment method</div>
            <div className="grid gap-2 md:grid-cols-2">
              {["cod", ...methods.map((m) => m.method).filter((m) => m !== "cod")].map((m) => {
                const meta = methods.find((x) => x.method === m);
                if (m !== "cod" && !meta) return null;
                const label = m === "cod" ? "Cash on Delivery" : (meta?.label ?? m);
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPayMethod(m)}
                    className={cx(
                      "rounded-[var(--st-radius-sm)] border px-3 py-2.5 text-left text-sm",
                      payMethod === m ? "border-[var(--st-primary)] bg-[var(--st-primary)]/8" : borderc,
                    )}
                  >
                    <div className="font-medium capitalize">{label}</div>
                    {meta?.instructions && <div className={cx("text-xs", muted)}>{meta.instructions}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <PrimaryButton disabled={busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Place order — {bdt(totals.total)}
          </PrimaryButton>
          <p className={cx("flex items-center gap-2 text-xs", muted)}>
            <ShieldCheck className="h-3.5 w-3.5" /> Your information is used only to deliver this order.
          </p>
        </form>

        <aside className={cx("h-fit space-y-4 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-5", borderc)}>
          <Heading className="text-base">Your cart ({store.cartCount})</Heading>
          <div className="space-y-3">
            {lines.map(({ line, listing }) => {
              const img = store.image(listing);
              return (
                <div key={listing.id} className={cx("flex gap-3 rounded-[var(--st-radius-sm)] border p-3", borderc)}>
                  {img && <img src={img} alt="" className="h-16 w-16 rounded-[var(--st-radius-sm)] object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm">{store.title(listing)}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className={cx("inline-flex items-center rounded-[var(--st-radius-sm)] border", borderc)}>
                        <button
                          type="button"
                          aria-label="Decrease"
                          onClick={() => setCartQty(code, listing.id, line.qty - 1)}
                          className="px-2 py-1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[2.5ch] text-center text-xs font-semibold">{line.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase"
                          onClick={() => setCartQty(code, listing.id, line.qty + 1)}
                          className="px-2 py-1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeFromCart(code, listing.id)}
                        className={cx("p-1", muted)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <span className="ml-auto text-sm font-semibold">
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
            <Row label="Total payable" value={bdt(totals.total)} bold />
          </div>
          <Link to="/s/$code" params={{ code }} className={cx("block text-center text-xs hover:text-[var(--st-primary)]", muted)}>
            ← Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">
        {label} {required && <span className="text-[var(--st-primary)]">*</span>}
      </label>
      {children}
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
