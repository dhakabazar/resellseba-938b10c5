import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Truck, X } from "lucide-react";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  area: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  forwarded_to_admin: boolean;
  created_at: string;
  reseller_note: string | null;
  admin_note: string | null;
  resellers: { business_name: string; store_code: string } | null;
};

type Item = {
  id: string;
  product_name: string;
  quantity: number;
  reseller_price: number;
  sa_price: number;
  line_total: number;
};

type Shipment = {
  id: string;
  provider: string;
  tracking_id: string | null;
  status: string;
  cost: number;
  booked_at: string | null;
};

const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "forwarded",
  "processing",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "forwarded" | "processing">("forwarded");
  const [selected, setSelected] = useState<OrderRow | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("orders")
      .select(
        "id,order_number,customer_name,customer_phone,address_line,area,total,status,payment_status,payment_method,forwarded_to_admin,created_at,reseller_note,admin_note,resellers(business_name,store_code)",
      )
      .order("created_at", { ascending: false });
    if (filter === "forwarded") q = q.eq("forwarded_to_admin", true);
    if (filter === "processing")
      q = q.in("status", ["forwarded", "processing", "shipped"]);
    const { data } = await q;
    setOrders((data ?? []) as OrderRow[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Reseller forward kora order gulo ekhane process korun."
      />

      <div className="mb-4 flex gap-2 text-sm">
        {(["forwarded", "processing", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-md border px-3 py-1.5 capitalize ${
              filter === k ? "border-primary bg-primary/10 text-primary" : ""
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders" description="Kono forwarded order pai nai." />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_1.2fr_1fr_1fr_auto] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div>Order</div>
            <div>Reseller</div>
            <div>Customer</div>
            <div>Total</div>
            <div>Status</div>
            <div></div>
          </div>
          {orders.map((o) => (
            <div
              key={o.id}
              className="grid grid-cols-1 items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_1fr_1.2fr_1fr_1fr_auto]"
            >
              <div>
                <div className="font-medium">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="truncate text-xs">
                <div className="font-medium">{o.resellers?.business_name}</div>
                <div className="text-muted-foreground">/{o.resellers?.store_code}</div>
              </div>
              <div>
                <div className="truncate">{o.customer_name}</div>
                <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
              </div>
              <div className="font-semibold">৳{Number(o.total).toFixed(0)}</div>
              <div>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                  {o.status}
                </span>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setSelected(o)}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function OrderDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: OrderRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [status, setStatus] = useState(order.status);
  const [adminNote, setAdminNote] = useState(order.admin_note ?? "");
  const [busy, setBusy] = useState(false);

  // shipment form
  const [provider, setProvider] = useState("steadfast");
  const [tracking, setTracking] = useState("");
  const [cost, setCost] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const [{ data: i }, { data: s }] = await Promise.all([
        supabase
          .from("order_items")
          .select("id,product_name,quantity,reseller_price,sa_price,line_total")
          .eq("order_id", order.id),
        supabase
          .from("shipments")
          .select("id,provider,tracking_id,status,cost,booked_at")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
      ]);
      setItems((i ?? []) as Item[]);
      setShipments((s ?? []) as Shipment[]);
    })();
  }, [order.id]);

  async function saveStatus() {
    setBusy(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: status as any, admin_note: adminNote || null })
      .eq("id", order.id);
    if (!error) {
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: status as any,
        note: adminNote || null,
      });
      toast.success("Order updated");
      onChanged();
    } else toast.error(error.message);
    setBusy(false);
  }

  async function bookShipment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("shipments").insert({
      order_id: order.id,
      provider: provider as any,
      tracking_id: tracking || null,
      cost,
      status: "booked",
      booked_at: new Date().toISOString(),
    });
    if (!error) {
      await supabase
        .from("orders")
        .update({ status: "shipped" })
        .eq("id", order.id);
      toast.success("Shipment booked");
      onChanged();
    } else toast.error(error.message);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{order.order_number}</h2>
            <p className="text-xs text-muted-foreground">
              {order.resellers?.business_name} — /{order.resellers?.store_code}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="surface-card mb-4 space-y-1 p-4 text-sm">
          <div className="font-medium">{order.customer_name}</div>
          <div className="text-muted-foreground">{order.customer_phone}</div>
          <div className="text-muted-foreground">{order.address_line}</div>
          <div className="text-xs text-muted-foreground">
            {order.area.replace("_", " ")} · {order.payment_method}
          </div>
          {order.reseller_note && (
            <div className="mt-2 rounded-md bg-muted p-2 text-xs">
              <span className="font-medium">Reseller note:</span> {order.reseller_note}
            </div>
          )}
        </div>

        <div className="surface-card mb-4 divide-y">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{it.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  ৳{it.reseller_price} × {it.quantity}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">৳{Number(it.line_total).toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">SA ৳{it.sa_price}</div>
              </div>
            </div>
          ))}
          <div className="flex justify-between p-3 text-sm font-semibold">
            <span>Total</span>
            <span>৳{Number(order.total).toFixed(0)}</span>
          </div>
        </div>

        <div className="surface-card mb-4 space-y-3 p-4">
          <div className="text-sm font-medium">Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Admin note (optional)"
            rows={2}
            className="input"
          />
          <button
            disabled={busy}
            onClick={saveStatus}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save status
          </button>
        </div>

        <div className="surface-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Truck className="h-4 w-4" /> Shipments
          </div>
          {shipments.length > 0 ? (
            <div className="mb-4 divide-y">
              {shipments.map((s) => (
                <div key={s.id} className="flex justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium capitalize">{s.provider}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.tracking_id ?? "—"} · {s.status}
                    </div>
                  </div>
                  <div className="text-right text-sm">৳{Number(s.cost).toFixed(0)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">No shipment yet.</p>
          )}

          <form onSubmit={bookShipment} className="grid grid-cols-2 gap-2">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="input col-span-2"
            >
              <option value="steadfast">Steadfast</option>
              <option value="pathao">Pathao</option>
              <option value="carrybee">Carrybee</option>
              <option value="redx">RedX</option>
              <option value="paperfly">Paperfly</option>
              <option value="manual">Manual</option>
            </select>
            <input
              placeholder="Tracking / consignment ID"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="input"
            />
            <input
              type="number"
              placeholder="Cost"
              value={cost || ""}
              onChange={(e) => setCost(Number(e.target.value))}
              className="input"
            />
            <button
              disabled={busy}
              className="btn-brand col-span-2 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Book shipment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
