import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exchangeSplit } from "@/lib/exchange";
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

type Line = { product_id: string; name: string; qty: number; price: number; cost: number };

/**
 * Create an exchange order (admin: approved at once, reseller: request for admin)
 * or, with `review`, approve / reject / adjust the money split of an existing one.
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
  const [parentItems, setParentItems] = useState<any[]>([]);
  const [returned, setReturned] = useState<Record<string, number>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [customerPays, setCustomerPays] = useState("0");
  const [delivery, setDelivery] = useState("0");
  const [adminShare, setAdminShare] = useState("0");
  const [reason, setReason] = useState(EXCHANGE_REASONS[0]);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState<any>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [orderQ, setOrderQ] = useState("");
  const [orderHits, setOrderHits] = useState<any[]>([]);
  const pid = parentId ?? picked;

  useEffect(() => {
    if (!open) return;
    setLines([]); setReturned({}); setQ(""); setNote(""); setRev(null);
    (async () => {
      if (!review && !pid) { setParent(null); setParentItems([]); return; }
      if (review) {
        const { data: o } = await supabase.from("orders").select("*").eq("id", review.id).maybeSingle();
        const { data: its } = await supabase.from("order_items").select("product_id,product_name,quantity,sa_price,reseller_price").eq("order_id", review.id);
        setRev({ ...o, items: its ?? [] });
        setCustomerPays(String(o?.total ?? 0));
        setDelivery(String(o?.delivery_cost ?? 0));
        setAdminShare(String((o as any)?.exchange_admin_share ?? 0));
        return;
      }
      const { data: o } = await supabase.from("orders").select("id,order_number,reseller_id,customer_name,delivery_cost,shipping_cost,status").eq("id", pid!).maybeSingle();
      const { data: its } = await supabase.from("order_items").select("product_id,product_name,quantity").eq("order_id", pid!);
      setParent(o);
      setParentItems(its ?? []);
      setDelivery(String(o?.delivery_cost || o?.shipping_cost || 0));
      setCustomerPays("0");
      setAdminShare("0");
    })();
  }, [open, pid, review?.id]);

  useEffect(() => { if (!open) { setPicked(null); setOrderQ(""); setOrderHits([]); } }, [open]);

  useEffect(() => {
    const term = orderQ.trim().replace(/[#%,]/g, "");
    if (!term) return setOrderHits([]);
    const t = setTimeout(async () => {
      const { data } = await supabase.from("orders").select("id,order_number,customer_name,customer_phone,status")
        .eq("is_exchange", false).eq("status", "delivered")
        .or(`order_number.ilike.%${term}%,customer_phone.ilike.%${term}%`).order("created_at", { ascending: false }).limit(8);
      setOrderHits(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [orderQ]);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setResults([]);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,product_code,reseller_price,packaging_cost,suggested_price,stock")
        .or(`name.ilike.%${term.replace(/[%,]/g, "")}%,product_code.ilike.%${term.replace(/[%,]/g, "")}%`)
        .eq("is_active", true)
        .limit(8);
      setResults(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const cost = review
    ? Number(rev?.sa_cost_total ?? 0)
    : lines.reduce((s, l) => s + l.cost * l.qty, 0);
  const split = useMemo(
    () => exchangeSplit({ productCost: cost, delivery: Number(delivery) || 0, customerPays: Number(customerPays) || 0, adminShare: Number(adminShare) || 0 }),
    [cost, delivery, customerPays, adminShare],
  );

  function add(p: any) {
    setLines((prev) =>
      prev.some((l) => l.product_id === p.id)
        ? prev.map((l) => (l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { product_id: p.id, name: p.name, qty: 1, price: 0, cost: Number(p.reseller_price) + Number(p.packaging_cost || 0) }],
    );
    setQ("");
  }

  async function submit() {
    if (lines.length === 0) return toast.error("Select the product to send");
    setBusy(true);
    const returnedItems = parentItems
      .filter((it) => (returned[it.product_id] ?? 0) > 0)
      .map((it) => ({ product_id: it.product_id, name: it.product_name, qty: returned[it.product_id] }));
    const { error } = await supabase.rpc("create_exchange_order" as any, {
      _parent: pid,
      _items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, price: l.price })),
      _returned: returnedItems,
      _total: Number(customerPays) || 0,
      _delivery_cost: Number(delivery) || 0,
      _admin_share: isAdmin ? Number(adminShare) || 0 : 0,
      _reason: reason,
      _note: note || null,
      _restock: restock,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isAdmin ? "Exchange order created" : "Exchange request sent to admin");
    onDone();
    onClose();
  }

  async function decide(approve: boolean | "save") {
    if (!review) return;
    setBusy(true);
    const { error } =
      approve === "save"
        ? await supabase.rpc("update_exchange_split" as any, { _id: review.id, _total: Number(customerPays) || 0, _delivery_cost: Number(delivery) || 0, _admin_share: Number(adminShare) || 0 })
        : await supabase.rpc("review_exchange_order" as any, {
            _id: review.id, _approve: approve,
            _total: Number(customerPays) || 0, _delivery_cost: Number(delivery) || 0, _admin_share: Number(adminShare) || 0,
            _note: note || null,
          });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(approve === "save" ? "Exchange split saved" : approve ? "Exchange approved" : "Exchange rejected");
    onDone();
    onClose();
  }

  const money = (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-semibold">Who pays what</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-[11px]">Customer pays (COD)</Label>
          <Input type="number" min={0} value={customerPays} onChange={(e) => setCustomerPays(e.target.value)} disabled={!isAdmin && !!review} />
        </div>
        <div>
          <Label className="text-[11px]">Delivery cost</Label>
          <Input type="number" min={0} value={delivery} onChange={(e) => setDelivery(e.target.value)} disabled={!isAdmin && !!review} />
        </div>
        {isAdmin && (
          <div>
            <Label className="text-[11px]">Admin bears</Label>
            <Input type="number" min={0} value={adminShare} onChange={(e) => setAdminShare(e.target.value)} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
        <div>Product cost: <b>৳{split.productCost}</b></div>
        <div>Total cost: <b>৳{split.totalCost}</b></div>
        <div>Admin: <b>৳{split.adminShare}</b></div>
        <div className={split.resellerShare < 0 ? "text-success" : "text-destructive"}>
          Reseller {split.resellerShare < 0 ? "earns" : "bears"}: <b>৳{Math.abs(split.resellerShare)}</b>
        </div>
      </div>
      {!isAdmin && <p className="text-[11px] text-muted-foreground">Admin will set the final split when approving.</p>}
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
            </div>
            <div className="rounded-lg border p-2 text-xs">
              <div className="font-semibold">Sending</div>
              {(rev?.items ?? []).map((i: any) => <div key={i.product_id}>{i.product_name} × {i.quantity}</div>)}
              {(rev?.exchange_returned_items ?? []).length > 0 && (
                <>
                  <div className="mt-1 font-semibold">Coming back</div>
                  {rev.exchange_returned_items.map((i: any, k: number) => <div key={k}>{i.name} × {i.qty}</div>)}
                </>
              )}
              {(rev?.reseller_note || rev?.admin_note) && <div className="mt-1 text-muted-foreground">Note: {rev.reseller_note || rev.admin_note}</div>}
            </div>
            {money}
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
                    <Button disabled={busy} onClick={() => decide("save")}>Save split</Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : !pid ? (
          <div className="space-y-2 text-sm">
            <Label className="text-xs">Original order number or customer phone</Label>
            <Input autoFocus placeholder="e.g. 751032 or 017..." value={orderQ} onChange={(e) => setOrderQ(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Only delivered orders can be exchanged.</p>
            {orderHits.map((h) => (
              <button key={h.id} type="button" onClick={() => setPicked(h.id)} className="flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs hover:bg-muted">
                <span>#{h.order_number} · {h.customer_name} · {h.customer_phone}</span>
                <span className="text-muted-foreground">{orderStatusLabel(h.status)}</span>
              </button>
            ))}
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

            {parentItems.length > 0 && (
              <div className="rounded-lg border p-2">
                <div className="mb-1 text-xs font-semibold">Product coming back from customer</div>
                {parentItems.map((it) => (
                  <div key={it.product_id} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                    <span className="truncate">{it.product_name}</span>
                    <Input
                      type="number" min={0} max={it.quantity} className="h-7 w-16"
                      value={returned[it.product_id] ?? 0}
                      onChange={(e) => setReturned((r) => ({ ...r, [it.product_id]: Math.min(Number(e.target.value) || 0, it.quantity) }))}
                    />
                  </div>
                ))}
                {isAdmin && (
                  <label className="mt-1 flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
                    Add returned product back to stock when exchange completes
                  </label>
                )}
              </div>
            )}

            <div className="rounded-lg border p-2">
              <div className="mb-1 text-xs font-semibold">Product to send</div>
              <Input placeholder="Search product name or code" value={q} onChange={(e) => setQ(e.target.value)} />
              {results.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded border">
                  {results.map((p) => (
                    <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full justify-between px-2 py-1 text-left text-xs hover:bg-muted">
                      <span className="truncate">{p.name} <span className="text-muted-foreground">#{p.product_code}</span></span>
                      <span className="text-muted-foreground">Stock {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {lines.map((l) => (
                <div key={l.product_id} className="mt-1 flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{l.name}</span>
                  <Input type="number" min={1} className="h-7 w-14" value={l.qty} onChange={(e) => setLines((p) => p.map((x) => x.product_id === l.product_id ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                  <button type="button" className="text-destructive" onClick={() => setLines((p) => p.filter((x) => x.product_id !== l.product_id))}>✕</button>
                </div>
              ))}
            </div>

            {money}
            <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={busy} onClick={submit}>{isAdmin ? "Create exchange order" : "Send request"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
