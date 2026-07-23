import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Search = { l?: string; q?: number };

export const Route = createFileRoute("/s/$code/checkout")({
  component: Checkout,
  validateSearch: (s: Record<string, unknown>): Search => ({
    l: typeof s.l === "string" ? s.l : undefined,
    q: typeof s.q === "number" ? s.q : s.q ? Number(s.q) : 1,
  }),
});

function Checkout() {
  const { code } = Route.useParams();
  const { l: listingId, q: qty = 1 } = Route.useSearch();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    area: "outside_dhaka" as "inside_dhaka" | "outside_dhaka" | "sub_dhaka",
    landmark: "",
    notes: "",
  });

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("reseller_listings")
        .select("id,selling_price,extra_delivery_inside,extra_delivery_outside,custom_title, product:products(id,name,delivery_inside,delivery_outside,product_images(url,is_primary))")
        .eq("id", listingId)
        .eq("is_active", true)
        .maybeSingle();
      if (data) {
        setListing(data);
        setProduct((data as any).product);
      }
      setLoading(false);
    })();
  }, [listingId]);

  const totals = useMemo(() => {
    if (!listing || !product) return { subtotal: 0, ship: 0, total: 0 };
    const sub = Number(listing.selling_price) * qty;
    const ship =
      form.area === "inside_dhaka"
        ? Number(product.delivery_inside) + Number(listing.extra_delivery_inside)
        : Number(product.delivery_outside) + Number(listing.extra_delivery_outside);
    return { subtotal: sub, ship, total: sub + ship };
  }, [listing, product, qty, form.area]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_public_order", {
      _reseller_code: code,
      _customer_name: form.name,
      _customer_phone: form.phone,
      _customer_email: form.email || null,
      _address_line: form.address,
      _city: form.city || null,
      _area: form.area,
      _landmark: form.landmark || null,
      _payment_method: "cod",
      _notes: form.notes || null,
      _items: [{ listing_id: listing.id, quantity: qty }],
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.order_number) {
      nav({ to: "/s/$code/thanks", params: { code }, search: { n: row.order_number } });
    }
  }

  if (loading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (!listing)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
        Cart empty.{" "}
        <Link to="/s/$code" params={{ code }} className="underline">Back to store</Link>
      </div>
    );

  const img = product?.product_images?.find((i: any) => i.is_primary)?.url ?? product?.product_images?.[0]?.url;
  const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Checkout — Cash on delivery</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Full name" required>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} />
            </Field>
            <Field label="Phone" required>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} placeholder="017XXXXXXXX" />
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
              <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as any })} className={inp}>
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
          <button
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--store-primary)" }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Place order — ৳{totals.total.toLocaleString()}
          </button>
        </form>

        <aside className="h-fit space-y-3 rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Order summary</h3>
          <div className="flex gap-3 rounded-md border p-3">
            {img && <img src={img} alt="" className="h-16 w-16 rounded object-cover" />}
            <div className="flex-1 text-sm">
              <div className="line-clamp-2">{listing.custom_title || product?.name}</div>
              <div className="text-xs text-muted-foreground">Qty: {qty}</div>
              <div className="mt-1 font-semibold">৳{(Number(listing.selling_price) * qty).toLocaleString()}</div>
            </div>
          </div>
          <div className="space-y-1 border-t pt-3 text-sm">
            <Row label="Subtotal" value={`৳${totals.subtotal.toLocaleString()}`} />
            <Row label="Shipping" value={`৳${totals.ship.toLocaleString()}`} />
            <Row label="Total" value={`৳${totals.total.toLocaleString()}`} bold />
          </div>
          <p className="text-xs text-muted-foreground">
            Payment method: Cash on Delivery. Courier apnar order verify korar por deliver hobe.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={"flex justify-between " + (bold ? "text-base font-semibold" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className={bold ? "text-foreground" : ""}>{value}</span>
    </div>
  );
}
