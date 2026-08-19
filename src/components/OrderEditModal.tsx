import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productDeliveryCharge } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { Loader2, Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type EditItem = {
  id?: string;
  product_id: string | null;
  listing_id?: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  sa_price: number;
  reseller_price: number;
};

interface Props {
  orderId: string;
  allProducts: any[];
  onClose: () => void;
  onSaved: () => void;
  /** false = reseller view (only own pending orders reach here) */
  isAdmin?: boolean;
}

export function OrderEditModal({ orderId, allProducts, onClose, onSaved, isAdmin = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [landmark, setLandmark] = useState("");
  const [area, setArea] = useState<"inside_dhaka" | "outside_dhaka">("outside_dhaka");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [note, setNote] = useState("");
  const [shippingMode, setShippingMode] = useState<"auto" | "manual">("auto");
  const [shippingManual, setShippingManual] = useState(0);
  /** Order level adjustments — "" means keep the default value. */
  const [discount, setDiscount] = useState("");
  const [packagingInput, setPackagingInput] = useState("");
  const [deliveryCostInput, setDeliveryCostInput] = useState("");
  /** Money actually collected by the courier. Empty = full order total received. */
  const [received, setReceived] = useState<string>("");
  const [query, setQuery] = useState("");


  useEffect(() => {
    (async () => {
      const [{ data: o, error }, { data: its }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
      ]);
      if (error || !o) {
        toast.error(error?.message || "Order not found");
        onClose();
        return;
      }
      setOrder(o);
      setName(o.customer_name ?? "");
      setPhone(o.customer_phone ?? "");
      setAddress(o.address_line ?? "");
      setCity(o.city ?? "");
      setLandmark(o.landmark ?? "");
      setArea((o.area === "inside_dhaka" ? "inside_dhaka" : "outside_dhaka") as any);
      setPaymentMethod(o.payment_method ?? "cod");
      setPaymentStatus(o.payment_status ?? "unpaid");
      setNote((isAdmin ? o.admin_note : o.reseller_note) ?? "");
      setShippingManual(Number(o.shipping_cost ?? 0));
      setReceived(o.received_amount == null ? "" : String(Number(o.received_amount)));
      setDiscount(Number(o.discount ?? 0) ? String(Number(o.discount)) : "");
      setPackagingInput(o.packaging_total == null ? "" : String(Number(o.packaging_total)));
      setDeliveryCostInput(Number(o.delivery_cost ?? 0) ? String(Number(o.delivery_cost)) : "");
      setShippingMode("manual");

      setItems(
        (its ?? []).map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          listing_id: it.listing_id,
          product_name: it.product_name,
          product_image: it.product_image,
          quantity: Number(it.quantity ?? 1),
          sa_price: Number(it.sa_price ?? 0),
          reseller_price: Number(it.reseller_price ?? 0),
        })),
      );
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const autoShipping = useMemo(() => {
    let ship = 0;
    for (const it of items) {
      const p = allProducts.find((x) => x.id === it.product_id);
      if (!p) continue;
      const dc = productDeliveryCharge(p, area);
      if (dc > ship) ship = dc;
    }
    return ship;
  }, [items, allProducts, area]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.reseller_price * it.quantity, 0);
    /** Product cost = item base cost minus its packaging part; packaging is tracked order-level. */
    const packagingDefault = items.reduce((s, it) => {
      const p = allProducts.find((x) => x.id === it.product_id);
      return s + Number(p?.packaging_cost ?? 0) * it.quantity;
    }, 0);
    const itemCost = items.reduce((s, it) => s + it.sa_price * it.quantity, 0);
    const productCost = Math.max(itemCost - packagingDefault, 0);
    const packaging = packagingInput.trim() === "" ? packagingDefault : Math.max(Number(packagingInput) || 0, 0);
    const saCost = productCost + packaging;
    const shipping = shippingMode === "auto" ? autoShipping : Number(shippingManual || 0);
    const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal + shipping);
    const total = subtotal + shipping - disc;
    const recv = received.trim() === "" ? total : Number(received) || 0;
    const deliveryCost = deliveryCostInput.trim() === "" ? shipping : Math.max(Number(deliveryCostInput) || 0, 0);
    return {
      subtotal,
      saCost,
      productCost,
      packagingDefault,
      packaging,
      shipping,
      deliveryCost,
      discount: disc,
      total,
      received: recv,
      shortfall: Math.max(total - recv, 0),
      // Profit always follows the money really collected.
      profit: recv - deliveryCost - saCost,
    };
  }, [
    items,
    allProducts,
    shippingMode,
    shippingManual,
    autoShipping,
    received,
    discount,
    packagingInput,
    deliveryCostInput,
  ]);


  /** Minimum sell price per line = SA base cost of that item. */
  function minFor(it: EditItem) {
    const p = allProducts.find((x) => x.id === it.product_id);
    const fromProduct = p ? Number(p.reseller_price ?? 0) + Number(p.packaging_cost ?? 0) : 0;
    return Math.max(fromProduct, Number(it.sa_price ?? 0));
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allProducts
      .filter(
        (p) =>
          String(p.name).toLowerCase().includes(q) ||
          String(p.product_code ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [allProducts, query]);

  const errors = { name: nameError(name), phone: phoneError(phone), address: addressError(address) };

  function addProduct(p: any) {
    setItems((prev) => {
      const hit = prev.find((x) => x.product_id === p.id);
      if (hit) return prev.map((x) => (x === hit ? { ...x, quantity: x.quantity + 1 } : x));
      const sa = Number(p.reseller_price ?? 0) + Number(p.packaging_cost ?? 0);
      return [
        ...prev,
        {
          product_id: p.id,
          listing_id: null,
          product_name: p.name,
          product_image: p.og_image_url ?? null,
          quantity: 1,
          sa_price: sa,
          reseller_price: Number(p.suggested_price ?? sa),
        },
      ];
    });
    setQuery("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return toast.error("Order needs at least one product.");
    const first = errors.name || errors.phone || errors.address;
    if (first) return toast.error(first);
    const low = items.find((it) => it.reseller_price < minFor(it));
    if (low)
      return toast.error(`${low.product_name}: সর্বনিম্ন বিক্রয় মূল্য ৳${minFor(low)} — এর নিচে সেভ করা যাবে না`);
    setBusy(true);
    try {
      if (removed.length > 0) {
        const { error } = await supabase.from("order_items").delete().in("id", removed);
        if (error) throw error;
      }

      for (const it of items) {
        const payload = {
          order_id: orderId,
          listing_id: it.listing_id ?? null,
          product_id: it.product_id,
          product_name: it.product_name,
          product_image: it.product_image,
          quantity: it.quantity,
          sa_price: it.sa_price,
          reseller_price: it.reseller_price,
          line_total: it.reseller_price * it.quantity,
          profit: (it.reseller_price - it.sa_price) * it.quantity,
        };
        if (it.id) {
          const { error } = await supabase.from("order_items").update(payload).eq("id", it.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("order_items").insert(payload);
          if (error) throw error;
        }
      }

      // Item writes trigger a packaging recalc from product defaults, so order meta is saved last.
      const { error: oe } = await supabase
        .from("orders")
        .update({
          customer_name: sanitizeName(name).trim(),
          customer_phone: normalizePhone(phone),
          address_line: address.trim(),
          city: city.trim() || null,
          landmark: landmark.trim() || null,
          area: area as any,
          payment_method: paymentMethod as any,
          ...(isAdmin ? { payment_status: paymentStatus as any } : {}),
          ...(isAdmin ? { admin_note: note || null } : { reseller_note: note || null }),
          subtotal: totals.subtotal,
          shipping_cost: totals.shipping,
          discount: totals.discount,
          total: totals.total,
          sa_cost_total: totals.saCost,
          reseller_profit: totals.profit,
          ...(isAdmin
            ? {
                packaging_total: totals.packaging,
                delivery_cost: totals.deliveryCost,
                received_amount: received.trim() === "" ? null : Number(received) || 0,
              }
            : {}),
        })
        .eq("id", orderId);
      if (oe) throw oe;


      toast.success("Order updated — status unchanged");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setBusy(false);
    }
  }

  const inp = "w-full rounded-lg border bg-background px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary/20";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={save}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold sm:text-lg">
              Edit order {order?.order_number ? `#${order.order_number}` : ""}
            </h2>
            <p className="text-[10px] uppercase tracking-tight text-muted-foreground">
              Status stays as it is ({order?.status ?? "—"})
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
              {/* Customer */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Customer information
                </h3>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Name</span>
                    <input className={inp} value={name} onChange={(e) => setName(sanitizeName(e.target.value))} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Mobile</span>
                    <input className={inp} value={phone} onChange={(e) => setPhone(normalizePhone(e.target.value))} />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-semibold text-muted-foreground">Address</span>
                    <textarea rows={2} className={inp} value={address} onChange={(e) => setAddress(e.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">City</span>
                    <input className={inp} value={city} onChange={(e) => setCity(e.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Landmark</span>
                    <input className={inp} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Delivery area</span>
                    <select className={inp} value={area} onChange={(e) => setArea(e.target.value as any)}>
                      <option value="inside_dhaka">Inside Dhaka</option>
                      <option value="outside_dhaka">Outside Dhaka</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Payment method</span>
                    <select className={inp} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      <option value="cod">Cash on Delivery</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="sslcommerz">SSLCommerz</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  {isAdmin && (
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">Payment status</span>
                      <select className={inp} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Paid</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </label>
                  )}
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {isAdmin ? "Admin note" : "Your note"}
                    </span>
                    <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} />
                  </label>
                </div>
              </section>

              {/* Items */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Products & pricing
                </h3>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search product to add..."
                    className={`${inp} px-9`}
                  />
                  {results.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full divide-y overflow-hidden rounded-lg border bg-background shadow-lg">
                      {results.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          className="flex w-full items-center gap-2 p-2 text-left text-xs hover:bg-primary/5"
                        >
                          <span className="h-7 w-7 shrink-0 overflow-hidden rounded border bg-muted">
                            {p.og_image_url ? (
                              <img src={p.og_image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <ShoppingCart className="m-1.5 h-4 w-4 text-muted-foreground/40" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                          <span className="shrink-0 text-muted-foreground">৳{Number(p.suggested_price ?? 0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.id ?? `new-${idx}`} className="rounded-xl border bg-muted/10 p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-background">
                          {it.product_image ? (
                            <img src={it.product_image} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingCart className="m-2.5 h-5 w-5 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-xs font-semibold">{it.product_name}</div>
                        <button
                          type="button"
                          onClick={() => {
                            if (it.id) setRemoved((prev) => [...prev, it.id!]);
                            setItems((prev) => prev.filter((x) => x !== it));
                          }}
                          className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <label className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">Qty</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) =>
                                  prev.map((x) => (x === it ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)),
                                )
                              }
                              className="rounded border p-1 hover:bg-accent"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              className={`${inp} text-center`}
                              value={it.quantity}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x === it ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x,
                                  ),
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setItems((prev) => prev.map((x) => (x === it ? { ...x, quantity: x.quantity + 1 } : x)))
                              }
                              className="rounded border p-1 hover:bg-accent"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">
                            Sell price · min ৳{minFor(it)}
                          </span>
                          <input
                            className={`${inp} ${it.reseller_price < minFor(it) ? "border-destructive text-destructive" : ""}`}
                            value={it.reseller_price}
                            inputMode="numeric"
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) => (x === it ? { ...x, reseller_price: Number(e.target.value) || 0 } : x)),
                              )
                            }
                            onBlur={() => {
                              const min = minFor(it);
                              if (it.reseller_price < min) {
                                setItems((prev) => prev.map((x) => (x === it ? { ...x, reseller_price: min } : x)));
                                toast.error(`সর্বনিম্ন বিক্রয় মূল্য ৳${min} — এর নিচে দেওয়া যাবে না`);
                              }
                            }}
                          />
                        </label>
                        {isAdmin && (
                          <label className="space-y-1">
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">Base cost</span>
                            <input
                              className={inp}
                              value={it.sa_price}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) => (x === it ? { ...x, sa_price: Number(e.target.value) || 0 } : x)),
                                )
                              }
                            />
                          </label>
                        )}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">Line total</span>
                          <div className="px-1 py-1.5 text-xs font-bold tabular-nums">
                            ৳{(it.reseller_price * it.quantity).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Charges */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Charges & adjustments
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Delivery charge mode</span>
                    <select className={inp} value={shippingMode} onChange={(e) => setShippingMode(e.target.value as any)}>
                      <option value="auto">Auto (product rules)</option>
                      <option value="manual">Manual override</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Delivery charge</span>
                    <input
                      className={inp}
                      disabled={shippingMode === "auto"}
                      value={shippingMode === "auto" ? autoShipping : shippingManual}
                      onChange={(e) => setShippingManual(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">Discount (৳)</span>
                    <input
                      className={inp}
                      inputMode="numeric"
                      placeholder="0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Packaging cost{isAdmin ? "" : " (admin controlled)"}
                    </span>
                    <input
                      className={inp}
                      inputMode="numeric"
                      disabled={!isAdmin}
                      placeholder={`৳${totals.packagingDefault.toFixed(0)}`}
                      value={packagingInput}
                      onChange={(e) => setPackagingInput(e.target.value)}
                    />
                  </label>
                  {isAdmin && (
                    <label className="space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Courier cost (default ৳{totals.shipping.toFixed(0)})
                      </span>
                      <input
                        className={inp}
                        inputMode="numeric"
                        placeholder={`৳${totals.shipping.toFixed(0)}`}
                        value={deliveryCostInput}
                        onChange={(e) => setDeliveryCostInput(e.target.value)}
                      />
                    </label>
                  )}
                </div>


                {isAdmin && (
                  <label className="mt-3 block">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Received amount (partial delivery)
                    </span>
                    <input
                      type="number"
                      className={inp}
                      placeholder={`Empty = full ৳${totals.total.toFixed(0)} received`}
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                    />
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      Courier partial payment dile ekhane collected amount din — profit ei amount theke calculate hobe.
                    </span>
                  </label>
                )}

                <div className="rounded-xl border bg-muted/20 p-4 text-xs">
                  <Row label="Subtotal" value={totals.subtotal} />
                  <Row label="Delivery" value={totals.shipping} />
                  <Row label="Received" value={totals.received} />
                  <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold text-primary">
                    <span>Grand total</span>
                    <span>৳{totals.total.toFixed(0)}</span>
                  </div>
                  {totals.shortfall > 0 && (
                    <div className="mt-1 flex justify-between text-[11px] font-semibold text-destructive">
                      <span>Not received</span>
                      <span>−৳{totals.shortfall.toFixed(0)}</span>
                    </div>
                  )}
                  <div
                    className={
                      "mt-1 flex justify-between text-[11px] font-semibold " +
                      (totals.profit < 0 ? "text-destructive" : "text-success")
                    }
                  >
                    <span>
                      {totals.profit < 0 ? (isAdmin ? "Reseller loss" : "Your loss") : isAdmin ? "Reseller profit" : "Your profit"}
                    </span>
                    <span>৳{totals.profit.toFixed(0)}</span>
                  </div>
                  {isAdmin && (
                    <div className="mt-0.5 flex justify-between text-[11px] text-muted-foreground">
                      <span>Base cost (SA)</span>
                      <span>৳{totals.saCost.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-brand inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-dashed py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">৳{value.toFixed(0)}</span>
    </div>
  );
}
