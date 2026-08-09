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
  const [area, setArea] = useState<"inside_dhaka" | "outside_dhaka">("outside_dhaka");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [resellerSearch, setResellerSearch] = useState("");

  const trendingResellers = useMemo(() => {
    return resellers.slice(0, 5);
  }, [resellers]);

  const filteredResellers = useMemo(() => {
    const q = resellerSearch.trim().toLowerCase();
    if (!q) return [];
    return resellers.filter(r => 
      r.business_name.toLowerCase().includes(q) || 
      (r.code && r.code.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [resellers, resellerSearch]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const listingMatches = listings
      .filter(l => l.products && l.products.name.toLowerCase().includes(q))
      .map(l => ({ type: 'listing' as const, data: l }));
    
    const productMatches = allProducts
      .filter(p => p.name.toLowerCase().includes(q) && !listings.some(l => l.products?.id === p.id))
      .map(p => ({ type: 'product' as const, data: p }));

    return [...listingMatches, ...productMatches].slice(0, 15);
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
          reseller_id: resellerId as any,
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
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6 bg-muted/30">
          <div>
            <h2 className="text-sm font-bold sm:text-lg">Create New Order</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
              {isAdmin ? "Super Admin Portal" : "Standard Order Placement"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
            {/* Left Column: Selection & Details */}
            <div className="space-y-6 p-4 sm:p-6 border-r">
              {isAdmin && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Reseller Selection</label>
                  <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      <input
                        value={resellerSearch}
                        onChange={(e) => setResellerSearch(e.target.value)}
                        placeholder="Search reseller..."
                        className="w-full rounded-lg border bg-background px-9 py-1.5 text-xs focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-bold text-muted-foreground mr-1">Trending:</span>
                        <button
                          type="button"
                          onClick={() => setResellerId(null)}
                          className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all border ${!resellerId ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                        >
                          Direct
                        </button>
                        {trendingResellers.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setResellerId(r.id)}
                            className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all border ${resellerId === r.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                          >
                            {r.business_name}
                          </button>
                        ))}
                      </div>

                      {resellerSearch && filteredResellers.length > 0 && (
                        <div className="rounded-lg border bg-background shadow-sm divide-y overflow-hidden animate-in fade-in slide-in-from-top-1">
                          {filteredResellers.map(r => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setResellerId(r.id);
                                setResellerSearch("");
                              }}
                              className="flex w-full items-center justify-between p-2 text-left hover:bg-primary/5 transition-colors"
                            >
                              <span className="text-[10px] font-bold">{r.business_name}</span>
                              <span className="text-[9px] text-muted-foreground uppercase">{r.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Customer Information</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Customer Full Name">
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(sanitizeName(e.target.value))}
                        placeholder="Enter full name"
                        className="w-full rounded-lg border px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20"
                      />
                      {name && errors.name && <FieldError text={errors.name} />}
                    </Field>
                    <Field label="Mobile Number">
                      <input
                        required
                        value={phone}
                        onChange={(e) => setPhone(normalizePhone(e.target.value))}
                        inputMode="numeric"
                        placeholder="01XXXXXXXXX"
                        className="w-full rounded-lg border px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20"
                      />
                      {phone && errors.phone && <FieldError text={errors.phone} />}
                    </Field>
                    
                    <Field label="Shipping Address" className="sm:col-span-2">
                      <textarea
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                        placeholder="Complete address (Road, Area, City...)"
                        className="w-full rounded-lg border px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20"
                      />
                      {address && errors.address && <FieldError text={errors.address} />}
                    </Field>


                    <Field label="Payment Method">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="cod">Cash on Delivery</option>
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="rocket">Rocket</option>
                        <option value="sslcommerz">SSLCommerz</option>
                      </select>
                    </Field>

                    <Field label="Order Note (Optional)">
                      <input 
                        value={note} 
                        onChange={(e) => setNote(e.target.value)} 
                        placeholder="Special instructions..."
                        className="w-full rounded-lg border px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20" 
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Order Items</label>
                  <div className="rounded-xl border bg-background p-3 shadow-sm">
                    <div className="relative mb-3">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search product to add..."
                        className="w-full rounded-lg border bg-accent/5 px-9 py-2 text-xs focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    {query && results.length > 0 && (
                      <div className="max-h-48 divide-y overflow-y-auto rounded-lg border bg-muted/5">
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
                              className="flex w-full items-center gap-2 p-2 text-left hover:bg-primary/5 transition-colors"
                            >
                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded border bg-muted">
                                {p.og_image_url ? (
                                  <img src={p.og_image_url} alt="" className="h-full w-full object-cover" />
                                ) : <Search className="m-auto h-full w-1/2 text-muted-foreground/30" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-[11px] font-bold">{p.name}</span>
                                  {item.type === 'listing' && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary uppercase">Listing</span>}
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">
                                  ৳{Number(price).toFixed(0)} · Delivery: ৳{dc.toFixed(0)}
                                </div>
                              </div>
                              <div className={`shrink-0 rounded-full p-1.5 transition-colors ${inCart ? 'bg-primary text-primary-foreground' : 'bg-accent hover:bg-primary/20 hover:text-primary'}`}>
                                <Plus className="h-3 w-3" />
                    </div>

                    {lines.length > 0 && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                        <label className="mb-2 block text-[10px] font-bold text-muted-foreground/80 uppercase">Delivery Area</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              ["inside_dhaka", "Inside Dhaka"],
                              ["outside_dhaka", "Outside Dhaka"],
                            ] as const
                          ).map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setArea(v)}
                              className={`flex flex-col items-center justify-center rounded-xl border py-2.5 px-3 transition-all duration-200 ${
                                area === v 
                                  ? "bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]" 
                                  : "bg-background border-muted hover:border-primary/30 text-muted-foreground"
                              }`}
                            >
                              <span className="text-[10px] font-bold">{label}</span>
                              <span className="mt-0.5 text-[9px] opacity-80">
                                ৳{Math.max(...picked.map(({ p }) => productDeliveryCharge(p, v)))}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Summary & Cart */}
            <aside className="flex flex-col bg-muted/20 p-4 sm:p-6 h-full">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Selected Items</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {picked.length}
                  </span>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                  {picked.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center text-muted-foreground bg-background/50">
                      <Search className="mb-2 h-8 w-8 opacity-20" />
                      <p className="text-xs">No products added yet</p>
                    </div>
                  ) : (
                    picked.map(({ line, p, sellPrice, listingId }, i) => {
                      const dc = productDeliveryCharge(p, area);
                      return (
                        <div key={listingId || p.id} className="group relative flex items-center gap-3 rounded-xl border bg-background p-3 shadow-sm hover:shadow-md transition-shadow">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                            {p.og_image_url && <img src={p.og_image_url} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold">{p.name}</div>
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              ৳{Number(sellPrice).toFixed(0)} × {line.qty}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center rounded-lg border bg-accent/30 p-0.5">
                              <button 
                                type="button" 
                                onClick={() => setLines(prev => prev.flatMap((l, idx) => idx === i ? (l.qty <= 1 ? [] : [{...l, qty: l.qty - 1}]) : [l]))} 
                                className="px-1.5 py-1 hover:bg-background rounded-md transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[2ch] text-center text-[11px] font-bold">{line.qty}</span>
                              <button 
                                type="button" 
                                onClick={() => setLines(prev => prev.map((l, idx) => idx === i ? {...l, qty: l.qty + 1} : l))} 
                                className="px-1.5 py-1 hover:bg-background rounded-md transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-[10px] font-bold text-destructive hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Order Totals Section */}
              <div className="mt-6 space-y-3 rounded-xl border bg-background p-4 shadow-sm">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-bold text-foreground">৳{totals.subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>Shipping</span>
                    {picked.length > 1 && <span className="text-[10px] bg-accent px-1 rounded">High</span>}
                  </div>
                  <span className="font-bold text-foreground">৳{totals.shipping.toFixed(0)}</span>
                </div>
                {totals.shipFrom && picked.length > 1 && (
                  <div className="text-[9px] text-muted-foreground italic text-right -mt-2">
                    Applied from: {totals.shipFrom}
                  </div>
                )}
                
                <div className="my-2 border-t border-dashed" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Total Amount</span>
                  <span className="text-xl font-black text-primary">৳{totals.total.toFixed(0)}</span>
                </div>

                <button
                  type="submit"
                  disabled={busy || picked.length === 0}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Order"}
                </button>
              </div>
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
