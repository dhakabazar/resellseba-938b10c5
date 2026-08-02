import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productDeliveryCharge } from "@/lib/delivery";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Plus, Send, X, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

type Listing = {
  id: string;
  selling_price: number;
  products: {
    id: string;
    name: string;
    reseller_price: number;
    packaging_cost: number;
    delivery_inside: number;
    delivery_outside: number;
    delivery_mode: string | null;
    delivery_flat: number | null;
    og_image_url: string | null;
  } | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  payment_status: string;
  forwarded_to_admin: boolean;
  created_at: string;
};

type Line = { listing_id: string; qty: number };

export const Route = createFileRoute("/_authenticated/reseller/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const { user } = useAuth();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: r } = await supabase
      .from("resellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!r) return setLoading(false);
    setResellerId(r.id);
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,order_number,customer_name,customer_phone,total,status,payment_status,forwarded_to_admin,created_at")
        .eq("reseller_id", r.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reseller_listings")
        .select("id,selling_price,products(id,name,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url)")
        .eq("reseller_id", r.id)
        .eq("is_active", true),
    ]);
    setOrders((o ?? []) as OrderRow[]);
    setListings((l ?? []) as Listing[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user]);

  async function forward(id: string) {
    const { error } = await supabase
      .from("orders")
      .update({ forwarded_to_admin: true, forwarded_at: new Date().toISOString(), status: "forwarded" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Forwarded to admin");
      load();
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this order?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Customer order gulo ekhane manage korun. Forward korle admin process korbe."
        actions={
          <button
            onClick={() => setOpen(true)}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> New order
          </button>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Manually order add korun ba customer order asle ekhane dekhben."
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div>Order</div>
            <div>Customer</div>
            <div>Total</div>
            <div>Payment</div>
            <div>Status</div>
            <div></div>
          </div>
          {orders.map((o) => (
            <div
              key={o.id}
              className="grid grid-cols-1 items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr_auto]"
            >
              <div>
                <div className="font-medium">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="truncate">{o.customer_name}</div>
                <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
              </div>
              <div className="font-semibold">৳{Number(o.total).toFixed(0)}</div>
              <div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{o.payment_status}</span>
              </div>
              <div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    o.status === "delivered"
                      ? "bg-success/15 text-success"
                      : o.status === "cancelled" || o.status === "returned"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary"
                  }`}
                >
                  {o.status}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <Link
                  to="/reseller/orders/$id/invoice"
                  params={{ id: o.id }}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  <FileText className="h-3.5 w-3.5" /> Invoice
                </Link>
                {!o.forwarded_to_admin && o.status !== "cancelled" && (
                  <button
                    onClick={() => forward(o.id)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <Send className="h-3.5 w-3.5" /> Forward
                  </button>
                )}
                {!o.forwarded_to_admin && (
                  <button
                    onClick={() => remove(o.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && resellerId && (
        <NewOrderModal
          listings={listings}
          resellerId={resellerId}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewOrderModal({
  listings,
  resellerId,
  onClose,
  onCreated,
}: {
  listings: Listing[];
  resellerId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState<"inside_dhaka" | "outside_dhaka" | "sub_dhaka">("outside_dhaka");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    let subtotal = 0;
    let saCost = 0;
    let shipping = 0;
    for (const line of lines) {
      const l = listings.find((x) => x.id === line.listing_id);
      if (!l?.products) continue;
      subtotal += Number(l.selling_price) * line.qty;
      saCost += (Number(l.products.reseller_price) + Number(l.products.packaging_cost)) * line.qty;
      const dc = productDeliveryCharge(l.products, area);
      shipping = Math.max(shipping, dc);
    }
    const total = subtotal + shipping;
    const profit = subtotal - saCost;
    return { subtotal, shipping, total, saCost, profit };
  }, [lines, listings, area]);

  function addLine() {
    if (!listings[0]) return toast.error("First add active listings from Catalog.");
    setLines((prev) => [...prev, { listing_id: listings[0].id, qty: 1 }]);
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) return toast.error("At least one product select korun.");
    setBusy(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          reseller_id: resellerId,
          customer_name: name,
          customer_phone: phone,
          address_line: address,
          area,
          payment_method: paymentMethod as any,
          reseller_note: note || null,
          subtotal: totals.subtotal,
          shipping_cost: totals.shipping,
          total: totals.total,
          sa_cost_total: totals.saCost,
          reseller_profit: totals.profit,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = lines.map((line) => {
        const l = listings.find((x) => x.id === line.listing_id)!;
        const p = l.products!;
        const saPrice = Number(p.reseller_price) + Number(p.packaging_cost);
        return {
          order_id: order.id,
          listing_id: l.id,
          product_id: p.id,
          product_name: p.name,
          product_image: p.og_image_url,
          quantity: line.qty,
          sa_price: saPrice,
          reseller_price: l.selling_price,
          line_total: Number(l.selling_price) * line.qty,
          profit: (Number(l.selling_price) - saPrice) * line.qty,
        };
      });
      const { error: ie } = await supabase.from("order_items").insert(items);
      if (ie) throw ie;

      toast.success("Order created");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New order</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Customer name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Phone">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Delivery area" className="md:col-span-2">
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as any)}
              className="input"
            >
              <option value="inside_dhaka">Inside Dhaka</option>
              <option value="sub_dhaka">Sub Dhaka</option>
              <option value="outside_dhaka">Outside Dhaka</option>
            </select>
          </Field>
          <Field label="Full address" className="md:col-span-2">
            <textarea
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="input"
            />
          </Field>
          <Field label="Payment method">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="input"
            >
              <option value="cod">Cash on Delivery</option>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
              <option value="rocket">Rocket</option>
              <option value="sslcommerz">SSLCommerz</option>
            </select>
          </Field>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input" />
          </Field>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Products</div>
            <button
              type="button"
              onClick={addLine}
              className="text-xs text-primary hover:underline"
            >
              + Add product
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={line.listing_id}
                  onChange={(e) => updateLine(i, { listing_id: e.target.value })}
                  className="input flex-1"
                >
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.products?.name} — ৳{l.selling_price}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 1 })}
                  className="input w-20"
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {lines.length === 0 && (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No products added yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-1 rounded-lg bg-muted/40 p-4 text-sm">
          <Row label="Subtotal" value={`৳${totals.subtotal.toFixed(0)}`} />
          <Row label="Shipping" value={`৳${totals.shipping.toFixed(0)}`} />
          <Row label="Total" value={`৳${totals.total.toFixed(0)}`} bold />
          <Row label="Your profit" value={`৳${totals.profit.toFixed(0)}`} muted />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create order
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-success" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
