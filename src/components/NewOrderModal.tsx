import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productDeliveryCharge, deliveryLabel } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { Loader2, Plus, Minus, X, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

type Line = { listing_id?: string; product_id?: string; qty: number; name?: string; price?: number; cost?: number; image?: string; delivery?: any };

interface NewOrderModalProps {
  listings: any[];
  allProducts: any[];
  resellerId?: string | null;
  resellers?: any[];
  onClose: () => void;
  onCreated: () => void;
  isAdmin?: boolean;
}

export function NewOrderModal({
  listings,
  allProducts,
  resellerId: initialResellerId,
  resellers = [],
  onClose,
  onCreated,
  isAdmin = false,
}: NewOrderModalProps) {
  const [resellerId, setResellerId] = useState<string | null>(initialResellerId || null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState<"inside_dhaka" | "outside_dhaka" | "sub_dhaka">("outside_dhaka");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [resellerSearch, setResellerSearch] = useState("");

  const filteredResellers = useMemo(() => {
    const q = resellerSearch.trim().toLowerCase();
    if (!q) return resellers.slice(0, 10);
    return resellers.filter(r => 
      r.business_name.toLowerCase().includes(q) || 
      (r.code && r.code.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [resellers, resellerSearch]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return listings.length > 0 
        ? listings.filter(l => l.products).slice(0, 8).map(l => ({ type: 'listing' as const, data: l }))
        : allProducts.slice(0, 8).map(p => ({ type: 'product' as const, data: p }));
    }

    const listingMatches = listings
      .filter(l => l.products && l.products.name.toLowerCase().includes(q))
      .map(l => ({ type: 'listing' as const, data: l }));
    
    const productMatches = allProducts
      .filter(p => p.name.toLowerCase().includes(q) && !listings.some(l => l.products?.id === p.id))
      .map(p => ({ type: 'product' as const, data: p }));

    return [...listingMatches, ...productMatches].slice(0, 20);
  }, [listings, allProducts, query]);

  const picked = useMemo(() => {
    return lines.map(line => {
      if (line.listing_id) {
        const l = listings.find(x => x.id === line.listing_id);
        if (l?.products) return { line, p: l.products, sellPrice: l.selling_price, listingId: l.id };
      }
      if (line.product_id) {
        const p = allProducts.find(x => x.id === line.product_id);
        if (p) return { line, p, sellPrice: line.price || p.suggested_price || (p.reseller_price + p.packaging_cost), listingId: null };
      }
      return null;
    }).filter(Boolean) as { line: Line; p: any; sellPrice: number; listingId: string | null }[];
  }, [lines, listings, allProducts]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let saCost = 0;
    let shipping = 0;
    let shipFrom: string | null = null;
    for (const { line, p, sellPrice } of picked) {
      subtotal += Number(sellPrice) * line.qty;
      saCost += (Number(p.reseller_price) + Number(p.packaging_cost)) * line.qty;
      const dc = productDeliveryCharge(p, area);
      if (dc > shipping) {
        shipping = dc;
        shipFrom = p.name;
      }
    }
    return { subtotal, shipping, total: subtotal + shipping, saCost, profit: subtotal - saCost, shipFrom };
  }, [picked, area]);

  const errors = {
    name: nameError(name),
    phone: phoneError(phone),
    address: addressError(address),
  };

  function pick(item: { type: 'listing' | 'product', data: any }) {
    if (item.type === 'listing') {
      const l = item.data;
      setLines(prev =>
        prev.some(x => x.listing_id === l.id)
          ? prev.map(x => (x.listing_id === l.id ? { ...x, qty: x.qty + 1 } : x))
          : [...prev, { listing_id: l.id, qty: 1 }]
      );
    } else {
      const p = item.data;
      setLines(prev =>
        prev.some(x => x.product_id === p.id)
          ? prev.map(x => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x))
          : [...prev, { product_id: p.id, qty: 1, price: p.suggested_price || (p.reseller_price + p.packaging_cost) }]
      );
    }
    setQuery("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return toast.error("Select at least one product.");
    const firstError = errors.name || errors.phone || errors.address;
    if (firstError) return toast.error(firstError);
    setBusy(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          reseller_id: resellerId,
          customer_name: sanitizeName(name).trim(),
          customer_phone: normalizePhone(phone),
          address_line: address.trim(),
          area,
          payment_method: paymentMethod as any,
          reseller_note: !isAdmin ? note : null,
          admin_note: isAdmin ? note : null,
          subtotal: totals.subtotal,
          shipping_cost: totals.shipping,
          total: totals.total,
          sa_cost_total: totals.saCost,
          reseller_profit: totals.profit,
          status: "confirmed",
          forwarded_to_admin: true,
          forwarded_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = picked.map(({ line, p, sellPrice, listingId }) => {
        const saPrice = Number(p.reseller_price) + Number(p.packaging_cost);
        return {
          order_id: order.id,
          listing_id: listingId,
          product_id: p.id,
          product_name: p.name,
          product_image: p.og_image_url,
          quantity: line.qty,
          sa_price: saPrice,
          reseller_price: sellPrice,
          line_total: Number(sellPrice) * line.qty,
          profit: (Number(sellPrice) - saPrice) * line.qty,
        };
      });
      const { error: ie } = await supabase.from("order_items").insert(items);
      if (ie) throw ie;

      toast.success(isAdmin ? "Order created successfully" : "Order created and sent to admin");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={submit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-base font-semibold sm:text-lg">New order</h2>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Manual order create korun — reseller select kora optional." : "Product search kore add korun — delivery charge product onujai apply hobe."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {isAdmin && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <div className="mb-2 text-sm font-medium">Assign to Reseller (Optional)</div>
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={resellerSearch}
                      onChange={(e) => setResellerSearch(e.target.value)}
                      placeholder="Search reseller by name or code..."
                      className="input pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setResellerId(null)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${!resellerId ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                    >
                      None (Direct Order)
                    </button>
                    {filteredResellers.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setResellerId(r.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${resellerId === r.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
                      >
                        {r.business_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">Products</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search master catalog by name…"
                    className="input pl-9"
                  />
                </div>

                <div className="mt-2 max-h-56 divide-y overflow-y-auto rounded-md border">
                  {results.map((item) => {
                    const p = item.type === 'listing' ? item.data.products! : item.data;
                    const price = item.type === 'listing' ? item.data.selling_price : (p.suggested_price || p.reseller_price + p.packaging_cost);
                    const dc = productDeliveryCharge(p, area);
                    const inCart = item.type === 'listing' 
                      ? lines.some((x) => x.listing_id === item.data.id)
                      : lines.some((x) => x.product_id === p.id);
                    return (
                      <button
                        type="button"
                        key={item.type === 'listing' ? `l-${item.data.id}` : `p-${p.id}`}
                        onClick={() => pick(item)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50"
                      >
                        {p.og_image_url && (
                          <img src={p.og_image_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {p.name}
                            {item.type === 'listing' && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider">My Listing</span>}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            ৳{Number(price).toFixed(0)} · {deliveryLabel(p)} · this area ৳{dc.toFixed(0)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-primary">
                          {inCart ? "+1" : "Add"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 space-y-2">
                  {picked.map(({ line, p, sellPrice, listingId }, i) => {
                    const dc = productDeliveryCharge(p, area);
                    return (
                      <div key={listingId || p.id} className="flex items-center gap-3 rounded-md border p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            ৳{Number(sellPrice).toFixed(0)} × {line.qty} · delivery ৳{dc.toFixed(0)}
                            {totals.shipping > dc && " (not applied — higher one wins)"}
                          </div>
                        </div>
                        <div className="inline-flex shrink-0 items-center rounded-md border">
                          <button type="button" onClick={() => {
                            setLines(prev => prev.flatMap((l, idx) => idx === i ? (l.qty <= 1 ? [] : [{...l, qty: l.qty - 1}]) : [l]));
                          }} className="px-2 py-1.5">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[2.5ch] text-center text-xs font-semibold">{line.qty}</span>
                          <button type="button" onClick={() => {
                            setLines(prev => prev.map((l, idx) => idx === i ? {...l, qty: l.qty + 1} : l));
                          }} className="px-2 py-1.5">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Customer name">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(sanitizeName(e.target.value))}
                    placeholder="Full name"
                    className="input"
                  />
                  {name && errors.name && <FieldError text={errors.name} />}
                </Field>
                <Field label="Phone">
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(normalizePhone(e.target.value))}
                    inputMode="numeric"
                    placeholder="01XXXXXXXXX"
                    className="input"
                  />
                  {phone && errors.phone && <FieldError text={errors.phone} />}
                </Field>
                <Field label="Delivery area" className="md:col-span-2">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["inside_dhaka", "Inside Dhaka"],
                        ["sub_dhaka", "Sub Dhaka"],
                        ["outside_dhaka", "Outside Dhaka"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setArea(v)}
                        aria-pressed={area === v}
                        className={`rounded-md border px-2 py-2 text-xs font-medium ${
                          area === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Full address" className="md:col-span-2">
                  <textarea
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    placeholder="House / road, area, upazila, district"
                    className="input"
                  />
                  {address && errors.address && <FieldError text={errors.address} />}
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
            </div>

            <aside className="h-fit space-y-4 rounded-lg border bg-muted/40 p-4 text-sm lg:sticky lg:top-0">
              <div className="space-y-1">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary
                </div>
                <Row label="Subtotal" value={`৳${totals.subtotal.toFixed(0)}`} />
                <Row label="Delivery charge" value={totals.shipping ? `৳${totals.shipping.toFixed(0)}` : "Free"} />
                {picked.length > 1 && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Highest single-product charge applied — not added up.
                  </p>
                )}
                <Row label="Total" value={`৳${totals.total.toFixed(0)}`} bold />
                {resellerId && <Row label="Reseller profit" value={`৳${totals.profit.toFixed(0)}`} muted />}
              </div>
              
              <button
                type="submit"
                disabled={busy || picked.length === 0}
                className="btn-brand w-full flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold shadow-sm"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create order — ৳{totals.total.toFixed(0)}
              </button>
            </aside>
          </div>
        </div>
      </form>
    </div>
  );
}

function FieldError({ text }: { text: string }) {
  return <p className="mt-1 text-[11px] font-medium text-destructive">{text}</p>;
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

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-success" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
