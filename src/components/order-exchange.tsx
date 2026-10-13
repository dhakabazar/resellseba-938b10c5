import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Lock, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exchangeCalc, type CalcLine, type PackPayer, type Payer } from "@/lib/exchange";
import { orderStatusLabel } from "@/lib/courier-status";

export const EXCHANGE_REASONS = [
  "Size / color change",
  "Damaged product",
  "Defective product",
  "Missing item",
  "Wrong product sent",
  "Customer preference",
  "Other",
];

type ExOrder = {
  id: string;
  order_number?: string | null;
  is_exchange?: boolean | null;
  exchange_state?: string | null;
  parent_order_id?: string | null;
  parent_order_number?: string | null;
};

/** Small pill: "Exchange · of #1001" with the request state. */
export function ExchangeBadge({ order, className = "" }: { order: ExOrder; className?: string }) {
  if (!order?.is_exchange) return null;
  const parent =
    order.parent_order_number ?? (order.order_number?.includes("-EX") ? order.order_number.split("-EX")[0] : null);
  const state =
    order.exchange_state === "requested" ? "Request" : order.exchange_state === "rejected" ? "Rejected" : null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary ${className}`}
      title={parent ? `Exchange order of #${parent}` : "Exchange order"}
    >
      <Repeat className="h-3 w-3" /> Exchange{parent ? ` · #${parent}` : ""}
      {state && <span className="rounded bg-warning/20 px-1 text-warning-foreground">{state}</span>}
    </span>
  );
}

type Line = CalcLine & { product_id: string; name: string; image?: string | null; pack: number };
type BackItem = CalcLine & { product_id: string; name: string; image?: string | null; max: number };

const num = (v: unknown) => Number(v) || 0;
const tk = (v: number) => `৳${Math.round(v * 100) / 100}`;
const optNum = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));

/**
 * Create an exchange order (admin: approved at once, reseller: request for admin)
 * or, with `review`, approve / reject / edit the calculation of an existing one.
 * Both modes share one calculator, so the outcome for customer, reseller, admin
 * and stock is visible before anything is saved.
 */
export function ExchangeModal({
  open,
  onClose,
  parentId,
  review,
  isAdmin,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  parentId?: string | null;
  review?: { id: string } | null;
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [parent, setParent] = useState<any>(null);
  const [back, setBack] = useState<BackItem[]>([]);
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [delivery, setDelivery] = useState("0");
  const [deliveryBy, setDeliveryBy] = useState<Payer>("customer");
  const [packaging, setPackaging] = useState<string | null>(null);
  const [packagingBy, setPackagingBy] = useState<PackPayer>("reseller");
  const [customerDiff, setCustomerDiff] = useState("");
  const [cOverride, setCOverride] = useState("");
  const [sOverride, setSOverride] = useState("");
  const [reason, setReason] = useState(EXCHANGE_REASONS[0]);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState<any>(null);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [orderQ, setOrderQ] = useState("");
  const [orderHits, setOrderHits] = useState<any[]>([]);
  const [hitLocks, setHitLocks] = useState<Record<string, string>>({});
  const pid = parentId ?? picked;
  const loadToken = useRef(0);
  const editable = !review || isAdmin;

  async function loadBack(parentOrderId: string, preset: any[] | undefined, token: number) {
    const cols = `product_id,product_name,product_image,quantity,sa_price,packaging_cost,reseller_price${isAdmin ? ",buying_price" : ""}`;
    const { data: its } = await supabase.from("order_items").select(cols).eq("order_id", parentOrderId);
    if (token !== loadToken.current) return [];
    const rows = ((its ?? []) as any[]).map((it) => ({
      product_id: it.product_id,
      name: it.product_name,
      image: it.product_image ?? null,
      max: num(it.quantity),
      qty: 0,
      resellerCost: num(it.sa_price) - num(it.packaging_cost),
      adminBuy: num(it.buying_price),
      sell: num(it.reseller_price),
    }));
    setBack(rows);
    return rows;
    const r: Record<string, number> = {};
    for (const p of preset ?? []) if (p?.product_id) r[p.product_id] = num(p.qty);
    setReturned(r);
  }

  useEffect(() => {
    if (!open) return;
    const token = ++loadToken.current;
    setLines([]); setReturned({}); setBack([]); setQ(""); setNote(""); setRev(null); setLockedBy(null);
    setCustomerDiff(""); setCOverride(""); setSOverride(""); setPackaging(null);
    setDeliveryBy("customer"); setPackagingBy("reseller"); setRestock(true);
    (async () => {
      if (!review && !pid) { setParent(null); return; }
      if (review) {
        const { data: o } = await supabase.from("orders").select("*").eq("id", review.id).maybeSingle();
        const ord: any = o;
        const cols = `product_id,product_name,product_image,quantity,sa_price,packaging_cost,reseller_price${isAdmin ? ",buying_price" : ""}`;
        const { data: its } = await supabase.from("order_items").select(cols).eq("order_id", review.id);
        if (token !== loadToken.current) return;
        setRev(ord);
        const input = ord?.exchange_calc?.input;
        setLines(
          ((its ?? []) as any[]).map((i) => {
            const saved = input?.send?.find((s: any) => s.product_id === i.product_id);
            return {
              product_id: i.product_id, name: i.product_name, image: i.product_image ?? null, qty: num(i.quantity),
              resellerCost: saved ? num(saved.resellerCost) : Math.max(0, num(i.sa_price) - num(i.packaging_cost)),
              adminBuy: saved ? num(saved.adminBuy) : num(i.buying_price),
              sell: saved ? num(saved.sell) : num(i.reseller_price),
              pack: num(i.packaging_cost),
            };
          }),
        );
        setRestock(ord?.exchange_restock ?? true);
        setReason(ord?.exchange_reason ?? EXCHANGE_REASONS[0]);
        setDelivery(String(ord?.delivery_cost ?? 0));
        if (input) {
          setDeliveryBy(input.deliveryBy ?? "customer");
          setPackagingBy(input.packagingBy ?? "reseller");
          setPackaging(String(input.packaging ?? 0));
          setCustomerDiff(input.customerDiff == null ? "" : String(input.customerDiff));
          setCOverride(input.customerPaysOverride == null ? "" : String(input.customerPaysOverride));
          setSOverride(input.adminShareOverride == null ? "" : String(input.adminShareOverride));
        } else {
          // Older exchange without a saved calculation: keep its saved amounts.
          setCOverride(String(ord?.total ?? 0));
          setSOverride(String(ord?.exchange_admin_share ?? 0));
        }
        if (ord?.parent_order_id) {
          const rows = await loadBack(ord.parent_order_id, ord.exchange_returned_items ?? [], token);
          // Older exchange: same product back means the rate matches the returned credit.
          if (!input) setLines((ls) => ls.map((l) => {
            const b = rows.find((r) => r.product_id === l.product_id);
            return b ? { ...l, resellerCost: b.resellerCost, adminBuy: isAdmin ? b.adminBuy : l.adminBuy } : l;
          }));
        }
        return;
      }
      const { data: o } = await supabase.from("orders").select("id,order_number,reseller_id,customer_name,delivery_cost,shipping_cost,status").eq("id", pid!).maybeSingle();
      setParent(o);
      setDelivery(String(o?.delivery_cost || o?.shipping_cost || 0));
      const { data: kids } = await supabase.from("orders").select("order_number,exchange_state,status")
        .eq("parent_order_id", pid!).eq("is_exchange", true);
      const active = (kids ?? []).find((k: any) => k.exchange_state !== "rejected" && k.status !== "cancelled");
      setLockedBy(active ? active.order_number : null);
      await loadBack(pid!, undefined, token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pid, review?.id]);

  useEffect(() => { if (!open) { setPicked(null); setOrderQ(""); setOrderHits([]); } }, [open]);

  useEffect(() => {
    const term = orderQ.trim().replace(/[#%,]/g, "");
    if (!term) return setOrderHits([]);
    const t = setTimeout(async () => {
      const { data } = await supabase.from("orders").select("id,order_number,customer_name,customer_phone,status")
        .eq("is_exchange", false).eq("status", "delivered")
        .or(`order_number.ilike.%${term}%,customer_phone.ilike.%${term}%`).order("created_at", { ascending: false }).limit(8);
      const hits = data ?? [];
      setOrderHits(hits);
      const locks: Record<string, string> = {};
      if (hits.length) {
        const { data: kids } = await supabase.from("orders").select("parent_order_id,order_number,exchange_state,status")
          .eq("is_exchange", true).in("parent_order_id", hits.map((h) => h.id));
        for (const k of (kids ?? []) as any[]) if (k.exchange_state !== "rejected" && k.status !== "cancelled") locks[k.parent_order_id] = k.order_number;
      }
      setHitLocks(locks);
    }, 250);
    return () => clearTimeout(t);
  }, [orderQ]);

  useEffect(() => {
    const term = q.trim().replace(/[%,]/g, "");
    if (!term) return setResults([]);
    const t = setTimeout(async () => {
      const cols = `id,name,product_code,reseller_price,packaging_cost,suggested_price,stock${isAdmin ? ",buying_price" : ""}`;
      const { data } = await supabase.from("products").select(cols)
        .or(`name.ilike.%${term}%,product_code.ilike.%${term}%`).eq("is_active", true).limit(8);
      const rows = ((data ?? []) as any[]);
      if (rows.length > 0) {
        const { data: imgs } = await supabase.from("product_images").select("product_id,url")
          .in("product_id", rows.map((r) => r.id)).order("is_primary", { ascending: false }).order("sort_order", { ascending: true });
        const first = new Map<string, string>();
        for (const im of imgs ?? []) if (!first.has(im.product_id)) first.set(im.product_id, im.url);
        for (const r of rows) r.image = first.get(r.id) ?? null;
      }
      setResults(rows);
    }, 250);
    return () => clearTimeout(t);
  }, [q, isAdmin]);

  async function add(p: any) {
    setQ("");
    if (lines.some((l) => l.product_id === p.id)) {
      return setLines((prev) => prev.map((l) => (l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l)));
    }
    let rate = num(p.reseller_price);
    let pack = num(p.packaging_cost);
    if (parent?.reseller_id) {
      const { data: rp } = await supabase.from("reseller_product_prices").select("reseller_price,packaging_cost")
        .eq("reseller_id", parent.reseller_id).eq("product_id", p.id).maybeSingle();
      if (rp) { rate = num(rp.reseller_price); if (rp.packaging_cost != null) pack = num(rp.packaging_cost); }
    }
    setLines((prev) => [...prev, {
      product_id: p.id, name: p.name, image: p.image ?? null, qty: 1,
      resellerCost: rate, adminBuy: num(p.buying_price), sell: num(p.suggested_price), pack,
    }]);
  }

  const backLines: BackItem[] = useMemo(
    () => back.map((b) => ({ ...b, qty: Math.min(returned[b.product_id] ?? 0, b.max) })).filter((b) => b.qty > 0),
    [back, returned],
  );
  const packAuto = lines.reduce((s, l) => s + l.pack * l.qty, 0);
  const input = {
    send: lines.map(({ product_id, qty, resellerCost, adminBuy, sell }) => ({ product_id, qty, resellerCost, adminBuy, sell })),
    back: backLines.map(({ product_id, qty, resellerCost, adminBuy, sell }) => ({ product_id, qty, resellerCost, adminBuy, sell })),
    restock,
    delivery: num(delivery),
    deliveryBy,
    packaging: packaging == null ? packAuto : num(packaging),
    packagingBy,
    customerDiff: optNum(customerDiff),
    customerPaysOverride: optNum(cOverride),
    adminShareOverride: isAdmin ? optNum(sOverride) : 0,
  };
  const calc = useMemo(() => exchangeCalc(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const calcPayload = () => ({
    customer_pays: calc.customerPays, delivery: calc.delivery, packaging: calc.packaging,
    admin_share: calc.adminShare, reseller_cost: calc.resellerCost, admin_buy: calc.adminBuy,
    reseller_result: calc.reseller, admin_result: calc.admin, input,
  });

  async function submit() {
    if (lines.length === 0) return toast.error("Select the product to send");
    if (lockedBy) return toast.error(`Already exchanged (#${lockedBy})`);
    setBusy(true);
    const returnedItems = backLines.map((b) => ({ product_id: b.product_id, name: b.name, image: b.image ?? null, qty: b.qty }));
    const { data: newId, error } = await supabase.rpc("create_exchange_order_v2" as any, {
      _parent: pid,
      _items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, price: l.sell })),
      _returned: returnedItems,
      _calc: calcPayload(),
      _reason: reason,
      _note: note || null,
      _restock: restock,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    let numTxt = "";
    if (newId) {
      const { data: o } = await supabase.from("orders").select("order_number").eq("id", newId as any).maybeSingle();
      numTxt = o?.order_number ? `#${o.order_number} ` : "";
    }
    toast.success(
      isAdmin ? `Exchange order ${numTxt}created` : `Exchange request ${numTxt}sent to admin`,
      { description: isAdmin ? `Find it in the "Confirmed" tab (search ${numTxt.trim() || "-EX"}).` : `Find it in the "Pending" tab until admin approves.`, duration: 10000 },
    );
    onDone();
    onClose();
  }

  async function decide(approve: boolean | "save") {
    if (!review) return;
    setBusy(true);
    let error: any = null;
    if (approve !== "save") {
      ({ error } = await supabase.rpc("review_exchange_order" as any, {
        _id: review.id, _approve: approve,
        _total: calc.customerPays, _delivery_cost: calc.delivery, _admin_share: calc.adminShare, _note: note || null,
      }));
    }
    if (!error && approve !== false) ({ error } = await supabase.rpc("save_exchange_calc" as any, { _id: review.id, _calc: calcPayload() }));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(approve === "save" ? "Exchange calculation saved" : approve ? "Exchange approved" : "Exchange rejected");
    onDone();
    onClose();
  }

  const sel = "h-8 w-full rounded-md border bg-background px-2 text-xs";
  const tone = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-foreground");
  const res = (v: number) => (v > 0 ? `লাভ ${tk(v)}` : v < 0 ? `লস ${tk(-v)}` : "লাভ-লস নেই (৳0)");

  const products = (
    <>
      {back.length > 0 && (
        <div className="rounded-lg border p-2">
          <div className="mb-1 text-xs font-semibold">Product coming back from customer</div>
          {back.map((it) => (
            <div key={it.product_id} className="flex items-center justify-between gap-2 py-0.5 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                {it.image && <img src={it.image} alt="" className="h-7 w-7 shrink-0 rounded border object-cover" loading="lazy" />}
                <span className="truncate">{it.name}</span>
              </span>
              <Input type="number" min={0} max={it.max} className="h-7 w-16" disabled={!!review}
                value={returned[it.product_id] ?? 0}
                onChange={(e) => setReturned((r) => ({ ...r, [it.product_id]: Math.min(Math.max(0, Number(e.target.value) || 0), it.max) }))} />
            </div>
          ))}
          {isAdmin && (
            <label className="mt-1 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={restock} disabled={!!review} onChange={(e) => setRestock(e.target.checked)} />
              Returned product is fine — add back to stock (untick if damaged)
            </label>
          )}
        </div>
      )}

      <div className="rounded-lg border p-2">
        <div className="mb-1 text-xs font-semibold">{review ? "Sending" : "Product to send"}</div>
        {!review && <Input placeholder="Search product name or code" value={q} onChange={(e) => setQ(e.target.value)} />}
        {results.length > 0 && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded border">
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted">
                {p.image ? (
                  <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded border object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted text-[9px] text-muted-foreground">No img</span>
                )}
                <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-muted-foreground">#{p.product_code}</span></span>
                <span className="shrink-0 text-muted-foreground">Stock {p.stock}</span>
              </button>
            ))}
          </div>
        )}
        {lines.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex-1">Product</span>
            <span className="w-12 text-center">Qty</span>
            <span className="w-16 text-center">Reseller rate</span>
            {isAdmin && <span className="w-16 text-center">Buying</span>}
            {!review && <span className="w-3" />}
          </div>
        )}
        {lines.map((l) => {
          const set = (patch: Partial<Line>) => setLines((p) => p.map((x) => (x.product_id === l.product_id ? { ...x, ...patch } : x)));
          return (
            <div key={l.product_id} className="mt-1 flex items-center gap-2 text-xs">
              {l.image && <img src={l.image} alt="" className="h-7 w-7 shrink-0 rounded border object-cover" loading="lazy" />}
              <span className="flex-1 truncate">{l.name}</span>
              <Input type="number" min={1} className="h-7 w-12" value={l.qty} disabled={!!review} onChange={(e) => set({ qty: Math.max(1, Number(e.target.value) || 1) })} />
              <Input type="number" min={0} className="h-7 w-16" value={l.resellerCost} disabled={!isAdmin} onChange={(e) => set({ resellerCost: Math.max(0, Number(e.target.value) || 0) })} />
              {isAdmin && <Input type="number" min={0} className="h-7 w-16" value={l.adminBuy} onChange={(e) => set({ adminBuy: Math.max(0, Number(e.target.value) || 0) })} />}
              {!review && <button type="button" className="text-destructive" onClick={() => setLines((p) => p.filter((x) => x.product_id !== l.product_id))}>✕</button>}
            </div>
          );
        })}
      </div>
    </>
  );

  const money = (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-semibold">Delivery & packaging</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">Delivery cost ৳</Label>
          <Input type="number" min={0} className="h-8" value={delivery} disabled={!editable} onChange={(e) => setDelivery(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Delivery paid by</Label>
          <select className={sel} value={deliveryBy} disabled={!editable} onChange={(e) => setDeliveryBy(e.target.value as Payer)}>
            <option value="customer">Customer</option>
            <option value="reseller">Reseller</option>
            {isAdmin && <option value="admin">Admin</option>}
          </select>
        </div>
        <div>
          <Label className="text-[11px]">Packaging cost ৳</Label>
          <Input type="number" min={0} className="h-8" value={packaging ?? String(packAuto)} disabled={!editable || packagingBy === "none"} onChange={(e) => setPackaging(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Packaging paid by</Label>
          <select className={sel} value={packagingBy} disabled={!editable} onChange={(e) => setPackagingBy(e.target.value as PackPayer)}>
            <option value="reseller">Reseller</option>
            <option value="customer">Customer</option>
            {isAdmin && <option value="admin">Admin</option>}
            <option value="none">No new packaging (৳0)</option>
          </select>
        </div>
        <div>
          <Label className="text-[11px]">Customer pays price difference ৳</Label>
          <Input type="number" min={0} className="h-8" placeholder={`Auto ${calc.sellDiffAuto}`} value={customerDiff} disabled={!editable} onChange={(e) => setCustomerDiff(e.target.value)} />
        </div>
        <div>
          <Label className="text-[11px]">Customer pays (COD) ৳</Label>
          <Input type="number" min={0} className="h-8" placeholder={`Auto ${calc.customerPays}`} value={cOverride} disabled={!editable} onChange={(e) => setCOverride(e.target.value)} />
        </div>
        {isAdmin && (
          <div>
            <Label className="text-[11px]">Admin bears ৳ (optional extra)</Label>
            <Input type="number" min={0} className="h-8" placeholder={`Auto ${calc.adminShare}`} value={sOverride} onChange={(e) => setSOverride(e.target.value)} />
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Leave a box empty to use the automatic amount.</p>
    </div>
  );

  const story = (
    <div className="space-y-1.5 rounded-lg border-2 border-primary/30 bg-primary/5 p-3 text-xs">
      <div className="text-sm font-bold">যা ঘটবে (Summary)</div>
      <div>
        <b>কাস্টমার:</b> {backLines.length ? `${backLines.map((b) => `${b.name} ×${b.qty}`).join(", ")} ফেরত দেবে, ` : ""}
        {lines.length ? `${lines.map((l) => `${l.name} ×${l.qty}`).join(", ")} পাবে` : "পাঠানোর পণ্য বাছাই করুন"}; ডেলিভারিতে দেবে <b>{tk(calc.customerPays)}</b>
      </div>
      <div>
        <b>Reseller:</b> পণ্যের রেট {tk(calc.sendR)} − ফেরত পণ্যের ক্রেডিট {tk(calc.backR)} = <b>{tk(calc.resellerCost)}</b>
        {" · "}ডেলিভারি {tk(calc.delivery)} · প্যাকেজিং {tk(calc.packaging)}{calc.adminShare > 0 ? ` · Admin দেবে ${tk(calc.adminShare)}` : ""}
        {" → "}<b className={tone(calc.reseller)}>{res(calc.reseller)}</b>
      </div>
      {isAdmin && (
        <div>
          <b>Admin:</b> reseller-এর পণ্য খরচ {tk(calc.resellerCost)} − কেনা দাম ({tk(calc.sendB)} − ফেরত {restock ? tk(calc.backB) : "৳0 (damage)"}) = {tk(calc.resellerCost - calc.adminBuy)}
          {calc.adminShare > 0 ? ` − বহন ${tk(calc.adminShare)}` : ""}{" → "}<b className={tone(calc.admin)}>{res(calc.admin)}</b>
        </div>
      )}
      <div>
        <b>স্টক:</b> {lines.map((l) => `${l.name} −${l.qty}`).join(", ") || "—"}
        {backLines.length > 0 && (restock ? ` · exchange সম্পূর্ণ হলে ${backLines.map((b) => `${b.name} +${b.qty}`).join(", ")}` : " · ফেরত পণ্য damage, স্টকে যোগ হবে না")}
      </div>
      <div className="text-muted-foreground">
        মূল অর্ডারের হিসাব বদলাবে না। exchange অর্ডার Delivered হলে "Exchanged" হবে; return হলে reseller-এর ক্ষতি = ডেলিভারি + প্যাকেজিং − Admin-এর অংশ।
      </div>
      {!isAdmin && <div className="text-muted-foreground">Admin অনুমোদনের সময় চূড়ান্ত হিসাব ঠিক করবে।</div>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            {review ? `Exchange #${rev?.order_number ?? ""}` : (pid ? `Exchange for #${parent?.order_number ?? ""}` : "Create exchange")}
          </DialogTitle>
        </DialogHeader>

        {review ? (
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Reason: <b className="text-foreground">{rev?.exchange_reason ?? "—"}</b> · State: <b className="text-foreground">{rev?.exchange_state}</b>
              {rev?.status && <> · Status: <b className="text-foreground">{orderStatusLabel(rev.status)}</b></>}
            </div>
            {(rev?.reseller_note || rev?.admin_note) && <div className="text-xs text-muted-foreground">Note: {rev.reseller_note || rev.admin_note}</div>}
            {products}
            {money}
            {story}
            {isAdmin && (
              <>
                <Input placeholder="Admin note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex flex-wrap justify-end gap-2">
                  {rev?.exchange_state === "requested" ? (
                    <>
                      <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Reject</Button>
                      <Button disabled={busy} onClick={() => decide(true)}>Approve & create</Button>
                    </>
                  ) : (
                    <Button disabled={busy} onClick={() => decide("save")}>Save calculation</Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : !pid ? (
          <div className="space-y-2 text-sm">
            <Label className="text-xs">Original order number or customer phone</Label>
            <Input autoFocus placeholder="e.g. 751032 or 017..." value={orderQ} onChange={(e) => setOrderQ(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Only delivered orders can be exchanged, once per order.</p>
            {orderHits.map((h) => {
              const lock = hitLocks[h.id];
              return (
                <button key={h.id} type="button" disabled={!!lock} onClick={() => setPicked(h.id)}
                  className="flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
                  <span>#{h.order_number} · {h.customer_name} · {h.customer_phone}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {lock ? <><Lock className="h-3 w-3" /> Exchanged #{lock}</> : orderStatusLabel(h.status)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : lockedBy ? (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <Lock className="h-4 w-4" /> এই অর্ডারটি আগেই exchange করা হয়েছে (#{lockedBy})। একটি অর্ডারে একবারই exchange করা যায়।
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {parent?.status && <div className="text-xs text-muted-foreground">Original status: <b className="text-foreground">{orderStatusLabel(parent.status)}</b></div>}
            <div>
              <Label className="text-xs">Reason</Label>
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={reason} onChange={(e) => setReason(e.target.value)}>
                {EXCHANGE_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {products}
            {money}
            {story}
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={busy || lines.length === 0} onClick={submit}>{isAdmin ? "Create exchange order" : "Send request"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
