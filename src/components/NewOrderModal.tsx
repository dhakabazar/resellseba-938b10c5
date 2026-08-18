import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productDeliveryCharge, deliveryLabel, deliveryMode } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { Loader2, Plus, Minus, X, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { ProductCodeChip } from "@/components/product-code";

type Line = { listing_id?: string; product_id?: string; qty: number; name?: string; price?: number; cost?: number; image?: string; delivery?: any };

/** Minimum allowed selling price = SA base cost (product cost + packaging). */
function minSellPrice(p: any) {
  return Number(p?.reseller_price ?? 0) + Number(p?.packaging_cost ?? 0);
}

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

    const hit = (p: any) =>
      String(p?.name ?? "").toLowerCase().includes(q) ||
      String(p?.product_code ?? "").toLowerCase().includes(q);

    const listingMatches = listings
      .filter(l => l.products && hit(l.products))
      .map(l => ({ type: 'listing' as const, data: l }));

    const productMatches = allProducts
      .filter(p => hit(p) && !listings.some(l => l.products?.id === p.id))
      .map(p => ({ type: 'product' as const, data: p }));

    return [...listingMatches, ...productMatches].slice(0, 15);
  }, [listings, allProducts, query]);

  const picked = useMemo(() => {
    return lines.map((line, index) => {
      if (line.listing_id) {
        const l = listings.find(x => x.id === line.listing_id);
        if (l?.products) {
          const min = minSellPrice(l.products);
          return { line, index, p: l.products, sellPrice: Number(line.price ?? l.selling_price), minPrice: min, listingId: l.id };
        }
      }
      if (line.product_id) {
        const p = allProducts.find(x => x.id === line.product_id);
        if (p) {
          const min = minSellPrice(p);
          return {
            line,
            index,
            p,
            sellPrice: Number(line.price ?? p.suggested_price ?? min),
            minPrice: min,
            listingId: null,
          };
        }
      }
      return null;
    }).filter(Boolean) as { line: Line; index: number; p: any; sellPrice: number; minPrice: number; listingId: string | null }[];
  }, [lines, listings, allProducts]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let saCost = 0;
    let shipping = 0;
    let shipFrom: string | null = null;
    let isUniversalFree = true;
    let isUniversalFlat = true;

    for (const { line, p, sellPrice } of picked) {
      subtotal += Number(sellPrice) * line.qty;
      saCost += (Number(p.reseller_price) + Number(p.packaging_cost)) * line.qty;
      
      const mode = deliveryMode(p);
      if (mode !== "free") isUniversalFree = false;
      if (mode !== "flat") isUniversalFlat = false;

      const dc = productDeliveryCharge(p, area);
      if (dc > shipping) {
        shipping = dc;
        shipFrom = p.name;
      }
    }
    
    // Determine if we should show area selection
    // If all items are "free", or all items are "flat" with the same charge, we don't need area picker
    const showAreaPicker = picked.length > 0 && !isUniversalFree && !isUniversalFlat;

    return { subtotal, shipping, total: subtotal + shipping, saCost, profit: subtotal - saCost, shipFrom, showAreaPicker };
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
    const low = picked.find((x) => x.sellPrice < x.minPrice);
    if (low)
      return toast.error(`${low.p.name}: সর্বনিম্ন বিক্রয় মূল্য ৳${low.minPrice} — এর নিচে অর্ডার করা যাবে না`);
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
          status: "pending",
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
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6 bg-muted/30">
          <div>
            <h2 className="text-sm font-bold sm:text-lg">
              {isAdmin ? "Create New Order (Admin)" : "Add New Order"}
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
              {isAdmin ? "Super Admin Portal" : "Reseller Order Placement"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col">
            {/* Left Column: Selection & Details */}
            <div className="space-y-6 p-4 sm:p-6 border-b">
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
                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
                        rows={1}
                        placeholder="Complete address (Road, Area, City...)"
                        className="w-full rounded-lg border px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20 min-h-[38px]"
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Order Items</label>
                    {picked.length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary animate-in zoom-in">
                        {picked.length} {picked.length === 1 ? 'Item' : 'Items'} Selected
                      </span>
                    )}
                  </div>

                  <div className="rounded-2xl border bg-background shadow-sm overflow-hidden flex flex-col">
                    {/* Search Bar */}
                    <div className="p-3 border-b bg-muted/5">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={isAdmin ? "Search product by name or ID..." : "Search catalog by name or ID..."}
                          className="w-full rounded-xl border bg-background px-9 py-2 text-xs focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>

                    {/* Search Results (Visible only when searching) */}
                    {query && (
                      <div className="max-h-60 border-b divide-y overflow-y-auto bg-muted/10 animate-in slide-in-from-top-2">
                        {results.length > 0 ? (
                          results.map((item) => {
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
                                className="flex w-full items-center gap-3 p-3 text-left hover:bg-primary/5 transition-colors"
                              >
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-sm">
                                  {p.og_image_url ? (
                                    <img src={p.og_image_url} alt="" className="h-full w-full object-cover" />
                                  ) : <Search className="m-auto h-full w-1/2 text-muted-foreground/30" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate text-xs font-bold">{p.name}</span>
                                    {item.type === 'listing' && (
                                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-black text-primary uppercase tracking-tighter">Listing</span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <ProductCodeChip code={p.product_code} />
                                    <span className="text-[10px] text-muted-foreground">
                                      ৳{Number(price).toFixed(0)} · Delivery: ৳{dc.toFixed(0)}
                                    </span>
                                  </div>
                                </div>
                                <div className={`shrink-0 rounded-full p-1.5 transition-all ${inCart ? 'bg-primary text-primary-foreground scale-110' : 'bg-accent hover:bg-primary/20 hover:text-primary'}`}>
                                  <Plus className="h-3.5 w-3.5" />
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-muted-foreground">
                            <p className="text-xs">No products found for "{query}"</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cart List (Visible when items picked) */}
                    <div className="flex-1 max-h-[300px] overflow-y-auto divide-y bg-background">
                      {picked.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/5">
                          <div className="rounded-full bg-muted p-4 mb-3">
                            <Plus className="h-6 w-6 opacity-20" />
                          </div>
                          <p className="text-xs font-medium">Search and select products to add</p>
                          <p className="text-[10px] opacity-60 mt-1 uppercase tracking-widest">Cart is empty</p>
                        </div>
                      ) : (
                        picked.map(({ line, p, sellPrice, minPrice, listingId }, i) => (
                          <div key={listingId || p.id} className="group relative flex flex-wrap items-center gap-4 p-4 hover:bg-muted/5 transition-colors">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border bg-muted shadow-sm">
                              {p.og_image_url && <img src={p.og_image_url} alt="" className="h-full w-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-black text-foreground">{p.name}</div>
                              <div className="mt-1"><ProductCodeChip code={p.product_code} /></div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase text-muted-foreground">Sell ৳</span>
                                <input
                                  value={sellPrice}
                                  inputMode="numeric"
                                  onChange={(e) => {
                                    const v = Number(e.target.value) || 0;
                                    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, price: v } : l)));
                                  }}
                                  onBlur={() => {
                                    if (sellPrice < minPrice) {
                                      setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, price: minPrice } : l)));
                                      toast.error(`সর্বনিম্ন বিক্রয় মূল্য ৳${minPrice} — এর নিচে দেওয়া যাবে না`);
                                    }
                                  }}
                                  className={`w-20 rounded-lg border bg-background px-2 py-1 text-[11px] font-bold tabular-nums focus:ring-2 focus:ring-primary/20 ${
                                    sellPrice < minPrice ? "border-destructive text-destructive" : ""
                                  }`}
                                />
                                <span className="text-[9px] text-muted-foreground/70">min ৳{minPrice}</span>
                                <span className="text-[10px] text-muted-foreground/60">× {line.qty}</span>
                              </div>
                            </div>
                            
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center rounded-xl border bg-muted/30 p-1">
                                <button 
                                  type="button" 
                                  onClick={() => setLines(prev => prev.flatMap((l, idx) => idx === i ? (l.qty <= 1 ? [] : [{...l, qty: l.qty - 1}]) : [l]))} 
                                  className="h-7 w-7 flex items-center justify-center hover:bg-background rounded-lg transition-all active:scale-90"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center text-[12px] font-black">{line.qty}</span>
                                <button 
                                  type="button" 
                                  onClick={() => setLines(prev => prev.map((l, idx) => idx === i ? {...l, qty: l.qty + 1} : l))} 
                                  className="h-7 w-7 flex items-center justify-center hover:bg-background rounded-lg transition-all active:scale-90"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                                className="h-8 w-8 flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                title="Remove item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Delivery Area Picker (Inside Cart Section) */}
                    {totals.showAreaPicker && (
                      <div className="p-4 border-t bg-muted/10 animate-in fade-in slide-in-from-bottom-2">
                        <label className="mb-2.5 block text-[10px] font-black text-muted-foreground/80 uppercase tracking-widest">Select Delivery Destination</label>
                        <div className="grid grid-cols-2 gap-3">
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
                              className={`flex items-center justify-between rounded-2xl border-2 py-3 px-4 transition-all duration-300 ${
                                area === v 
                                  ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                                  : "bg-background border-muted hover:border-primary/30 text-muted-foreground"
                              }`}
                            >
                              <span className="text-[11px] font-black uppercase tracking-tight">{label}</span>
                              <span className={`text-[10px] font-bold ${area === v ? 'text-primary-foreground/90' : 'text-primary'}`}>
                                ৳{Math.max(...picked.map(({ p }) => productDeliveryCharge(p, v)))}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <aside className="flex flex-col bg-muted/20 p-4 sm:p-6 h-full border-t">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">Order Summary</h3>
                </div>
              </div>


              {/* Summary Section (Now a Sticky Footer in the Right Column) */}
              <div className="mt-auto space-y-4 rounded-2xl border-2 border-primary/20 bg-background p-5 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="font-medium">Subtotal ({picked.length} {picked.length === 1 ? 'item' : 'items'})</span>
                    <span className="font-black text-foreground">৳{totals.subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">Shipping Charge</span>
                      {picked.length > 1 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase">Max Applied</span>}
                    </div>
                    <span className="font-black text-foreground">৳{totals.shipping.toFixed(0)}</span>
                  </div>
                  
                  <div className="my-3 border-t-2 border-dashed border-muted" />
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 block">Payable Total</span>
                      <span className="text-2xl font-black text-primary tracking-tight">৳{totals.total.toFixed(0)}</span>
                    </div>
                    {!isAdmin && totals.profit > 0 && (
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-success/60 block">Estimated Profit</span>
                        <span className="text-lg font-black text-success tracking-tight">৳{totals.profit.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || picked.length === 0}
                  className="w-full flex items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none group"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      <span>{isAdmin ? "Confirm and Place Order" : "Place Order & Send to Admin"}</span>
                      <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                    </>
                  )}
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
