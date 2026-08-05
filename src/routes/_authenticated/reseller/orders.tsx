import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productDeliveryCharge, deliveryLabel } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import {
  Loader2,
  Plus,
  Minus,
  X,
  Trash2,
  FileText,
  Check,
  Ban,
  Search,
  ListChecks,
  SlidersHorizontal,
  ChevronDown,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { CourierTimeline, type CourierEvent } from "@/components/CourierTimeline";
import { OrderTabs } from "@/components/OrderTabs";
import { PickListModal } from "@/components/pick-list-modal";
import { OrderSearch, type OrderSearchMode } from "@/components/order-search";
import { Pagination, usePaginated } from "@/components/data-list";
import {
  OrderFilterBar,
  applyOrderFilters,
  DEFAULT_ORDER_FILTERS,
  type OrderFilterState,
} from "@/components/order-filters";


import {
  ORDER_TABS,
  courierStatusLabel,
  orderStatusLabel,
  orderStatusTone,
  type OrderTabKey,
} from "@/lib/courier-status";

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
  address_line: string;
  city: string | null;
  area: string;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  total: number;
  reseller_profit: number;
  payment_method: string;
  status: string;
  payment_status: string;
  forwarded_to_admin: boolean;
  notes: string | null;
  reseller_note: string | null;
  created_at: string;
};

type Line = { listing_id: string; qty: number };

export const Route = createFileRoute("/_authenticated/reseller/orders")({
  component: OrdersPage,
});

const ORDER_COLUMNS =
  "id,order_number,customer_name,customer_phone,address_line,city,area,subtotal,shipping_cost,discount,total,reseller_profit,payment_method,status,payment_status,forwarded_to_admin,notes,reseller_note,created_at";

type OrderItemLite = { order_id: string; product_id: string | null; product_name: string; quantity: number };

function exportCsv(rows: OrderRow[]) {
  const head = ["Order", "Date", "Customer", "Phone", "Area", "Address", "Status", "Total", "Profit"];
  const csv = [head.join(",")]
    .concat(
      rows.map((o) =>
        [
          o.order_number,
          new Date(o.created_at).toISOString().slice(0, 10),
          o.customer_name,
          o.customer_phone,
          o.area,
          `"${(o.address_line ?? "").replace(/"/g, '""')}"`,
          o.status,
          Number(o.total).toFixed(0),
          Number(o.reseller_profit).toFixed(0),
        ].join(","),
      ),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function OrdersPage() {
  const { user } = useAuth();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLite[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<OrderTabKey>("new");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [searchMode, setSearchMode] = useState<OrderSearchMode>("order");
  const [showFilters, setShowFilters] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickScope, setPickScope] = useState<"filtered" | "marked">("filtered");
  const [marked, setMarked] = useState<string[]>([]);
  const [page, setPage] = useState(1);

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
        .select(ORDER_COLUMNS)
        .eq("reseller_id", r.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("reseller_listings")
        .select("id,selling_price,products(id,name,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url)")
        .eq("reseller_id", r.id)
        .eq("is_active", true),
    ]);
    const rows = (o ?? []) as OrderRow[];
    setOrders(rows);
    setListings((l ?? []) as Listing[]);
    if (rows.length > 0) {
      const { data: its } = await supabase
        .from("order_items")
        .select("order_id,product_id,product_name,quantity")
        .in(
          "order_id",
          rows.map((x) => x.id),
        );
      setOrderItems((its ?? []) as OrderItemLite[]);
    } else {
      setOrderItems([]);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user]);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemLite[]>();
    for (const it of orderItems) {
      const arr = m.get(it.order_id);
      if (arr) arr.push(it);
      else m.set(it.order_id, [it]);
    }
    return m;
  }, [orderItems]);

  const tabStatuses = ORDER_TABS.find((t) => t.key === tab)?.statuses ?? [];
  const inTab =
    tabStatuses.length === 0 ? orders : orders.filter((o) => (tabStatuses as string[]).includes(o.status));

  /** One search box, mode decides target: order fields or product name. */
  const visible = useMemo(() => {
    const base = applyOrderFilters(inTab, { ...filters, q: "" });
    const q = filters.q.trim().toLowerCase();
    if (!q) return base;
    return base.filter((o) => {
      if (searchMode === "product") {
        return (itemsByOrder.get(o.id) ?? []).some((it) =>
          it.product_name.toLowerCase().includes(q),
        );
      }
      const has = (v?: string | null) => (v ?? "").toLowerCase().includes(q);
      return has(o.order_number) || has(o.customer_name) || has(o.customer_phone);
    });
  }, [inTab, filters, searchMode, itemsByOrder]);

  const markedOrders = useMemo(
    () => visible.filter((o) => marked.includes(o.id)),
    [visible, marked],
  );

  const pickList = useMemo(() => {
    const rows = pickScope === "marked" ? markedOrders : visible;
    const m = new Map<string, { name: string; qty: number; orders: number }>();
    for (const o of rows) {
      for (const it of itemsByOrder.get(o.id) ?? []) {
        const key = it.product_id ?? it.product_name;
        const cur = m.get(key) ?? { name: it.product_name, qty: 0, orders: 0 };
        cur.qty += Number(it.quantity) || 0;
        cur.orders += 1;
        m.set(key, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [pickScope, markedOrders, visible, itemsByOrder]);

  useEffect(() => {
    setPage(1);
  }, [filters, tab, searchMode]);
  const paged = usePaginated(visible, page, filters.perPage);
  const stats = useMemo(
    () =>
      visible.reduce(
        (a, o) => ({
          count: a.count + 1,
          total: a.total + (Number(o.total) || 0),
          shipping: a.shipping + (Number(o.shipping_cost) || 0),
          profit: a.profit + (Number(o.reseller_profit) || 0),
        }),
        { count: 0, total: 0, shipping: 0, profit: 0 },
      ),
    [visible],
  );

  const tabCount = (key: OrderTabKey) => {
    const sts = ORDER_TABS.find((t) => t.key === key)?.statuses ?? [];
    return sts.length === 0 ? orders.length : orders.filter((o) => (sts as string[]).includes(o.status)).length;
  };



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
        description=""
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={() => exportCsv(visible)}
              disabled={visible.length === 0}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-50 sm:flex-none"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={() => setOpen(true)}
              className="btn-brand inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium sm:flex-none"
            >
              <Plus className="h-4 w-4" /> New order
            </button>
          </div>
        }
      />

      {/* Merged search: mode select inside the box */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto sm:min-w-[18rem] sm:flex-1">
          <OrderSearch
            mode={searchMode}
            onMode={setSearchMode}
            value={filters.q}
            onChange={(v) => setFilters({ ...filters, q: v })}
          />
        </div>




        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm hover:bg-accent"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            setPickScope("filtered");
            setPickOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm hover:bg-accent"
        >
          <ListChecks className="h-4 w-4" />
          Pick list
        </button>
        <span className="text-xs text-muted-foreground">
          {visible.length} of {orders.length}
        </span>
      </div>

      {showFilters && (
        <OrderFilterBar
          value={filters}
          onChange={setFilters}
          total={orders.length}
          shown={visible.length}
        />
      )}

      {marked.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{marked.length} order marked</span>
          <button
            type="button"
            onClick={() => {
              setPickScope("marked");
              setPickOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
          >
            <ListChecks className="h-3.5 w-3.5" /> Marked pick list
          </button>
          <button
            type="button"
            onClick={() => exportCsv(markedOrders)}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" /> Export marked
          </button>
          <button
            type="button"
            onClick={() => setMarked([])}
            className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        </div>
      )}

      {pickOpen && (
        <PickListModal
          rows={pickList}
          scopeLabel={
            pickScope === "marked"
              ? `${markedOrders.length} marked order`
              : `${ORDER_TABS.find((t) => t.key === tab)?.label ?? "All"} — ${visible.length} order`
          }
          onPick={(name) => {
            setSearchMode("product");
            setFilters((f) => ({ ...f, q: name }));
            setPickOpen(false);
          }}
          onClose={() => setPickOpen(false)}
        />
      )}

      <OrderTabs tab={tab} onChange={setTab} count={tabCount} />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Orders", value: String(stats.count) },
          { label: "Sales", value: `৳${stats.total.toFixed(0)}` },
          { label: "Delivery", value: `৳${stats.shipping.toFixed(0)}` },
          { label: "Profit", value: `৳${stats.profit.toFixed(0)}`, tone: "text-success" },
        ].map((s) => (
          <div key={s.label} className="surface-card px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={`text-base font-semibold ${s.tone ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>


      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : paged.length === 0 ? (
        <EmptyState
          title="No orders"
          description="No orders match this filter."
        />
      ) : (
        <>
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[auto_1.1fr_1.3fr_1.4fr_0.9fr_0.8fr_0.9fr_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              checked={paged.length > 0 && paged.every((o) => marked.includes(o.id))}
              onChange={(e) => {
                const ids = paged.map((o) => o.id);
                setMarked((prev) =>
                  e.target.checked
                    ? [...new Set([...prev, ...ids])]
                    : prev.filter((id) => !ids.includes(id)),
                );
              }}
              title="Mark all on this page"
            />
            <div>Order</div>
            <div>Customer</div>
            <div>Items</div>
            <div>Total</div>
            <div>Profit</div>
            <div>Status</div>
            <div></div>
          </div>
          {paged.map((o) => {
            const items = itemsByOrder.get(o.id) ?? [];
            const qty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            const itemText = items.length
              ? `${items[0].product_name}${items.length > 1 ? ` +${items.length - 1} more` : ""}`
              : "—";
            const isMarked = marked.includes(o.id);
            const mark = (checked: boolean) =>
              setMarked((prev) => (checked ? [...prev, o.id] : prev.filter((id) => id !== o.id)));
            const actions = (
              <>
                <button
                  onClick={() => setSelected(o)}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  Details
                </button>
                <Link
                  to="/reseller/orders/$id/invoice"
                  params={{ id: o.id }}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                  <FileText className="h-3.5 w-3.5" /> Invoice
                </Link>
                {!o.forwarded_to_admin && (o.status === "pending" || o.status === "draft") && (
                  <button
                    onClick={() => remove(o.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            );

            return (
              <div
                key={o.id}
                className={`border-b last:border-b-0 ${isMarked ? "bg-primary/5" : ""}`}
              >
                {/* Mobile card */}
                <div className="p-3 md:hidden">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      checked={isMarked}
                      onChange={(e) => mark(e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{o.order_number}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(o.created_at).toLocaleString([], {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize ${orderStatusTone(o.status)}`}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </div>

                      <div className="mt-2 space-y-0.5 text-xs">
                        <div className="truncate font-medium">{o.customer_name}</div>
                        <a
                          href={`tel:${o.customer_phone}`}
                          className="text-muted-foreground underline-offset-2 hover:underline"
                        >
                          {o.customer_phone}
                        </a>
                        <div className="truncate text-muted-foreground">
                          {[o.area, o.city].filter(Boolean).join(", ") || "—"}
                        </div>
                      </div>

                      <div className="mt-2 truncate text-xs text-muted-foreground">
                        {itemText}
                        {qty > 0 && <span className="ml-1">({qty} pcs)</span>}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-semibold">৳{Number(o.total).toFixed(0)}</span>
                        <span className="text-muted-foreground">
                          Delivery ৳{Number(o.shipping_cost).toFixed(0)}
                        </span>
                        <span className="font-medium text-success">
                          Profit ৳{Number(o.reseller_profit).toFixed(0)}
                        </span>
                        <span className="rounded border px-1.5 py-0.5 uppercase text-muted-foreground">
                          {o.payment_method}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 ${o.forwarded_to_admin ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                        >
                          {o.forwarded_to_admin ? "Sent to admin" : "Not sent"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
                    </div>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden grid-cols-[auto_1.1fr_1.3fr_1.4fr_0.9fr_0.8fr_0.9fr_auto] items-center gap-3 px-4 py-3 text-sm md:grid">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                    checked={isMarked}
                    onChange={(e) => mark(e.target.checked)}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate">{o.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[o.area, o.city].filter(Boolean).join(", ")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs">{itemText}</div>
                    <div className="text-xs text-muted-foreground">
                      {qty} pcs · <span className="uppercase">{o.payment_method}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">৳{Number(o.total).toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">
                      +৳{Number(o.shipping_cost).toFixed(0)} del.
                    </div>
                  </div>
                  <div className="text-xs font-medium text-success">
                    ৳{Number(o.reseller_profit).toFixed(0)}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs capitalize ${orderStatusTone(o.status)}`}
                    >
                      {orderStatusLabel(o.status)}
                    </span>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {o.forwarded_to_admin ? "Sent to admin" : "Not sent"}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">{actions}</div>
                </div>
              </div>
            );
          })}

        </div>

        <Pagination
          page={page}
          perPage={filters.perPage}
          total={visible.length}
          onPage={setPage}
        />
        </>
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
  const [query, setQuery] = useState("");

  /** Search first, then pick — same delivery rules as the storefront checkout. */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = listings.filter((l) => l.products);
    if (!q) return pool.slice(0, 8);
    return pool
      .filter((l) => (l.products?.name ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [listings, query]);

  const picked = useMemo(
    () =>
      lines
        .map((line) => ({ line, l: listings.find((x) => x.id === line.listing_id) }))
        .filter((x) => x.l?.products) as { line: Line; l: Listing }[],
    [lines, listings],
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let saCost = 0;
    let shipping = 0;
    let shipFrom: string | null = null;
    for (const { line, l } of picked) {
      const p = l.products!;
      subtotal += Number(l.selling_price) * line.qty;
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

  function pick(id: string) {
    setLines((prev) =>
      prev.some((l) => l.listing_id === id)
        ? prev.map((l) => (l.listing_id === id ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { listing_id: id, qty: 1 }],
    );
    setQuery("");
  }
  function setQty(i: number, qty: number) {
    setLines((prev) =>
      prev.flatMap((l, idx) => (idx === i ? (qty < 1 ? [] : [{ ...l, qty }]) : [l])),
    );
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return toast.error("Select at least one product.");
    const firstError = errors.name || errors.phone || errors.address;
    if (firstError) return toast.error(firstError);
    setBusy(true);
    try {
      // A reseller-created order is already confirmed, so it goes straight to the admin queue.
      // The "New Order" tab only shows orders placed via the customer website.
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          reseller_id: resellerId,
          customer_name: sanitizeName(name).trim(),
          customer_phone: normalizePhone(phone),
          address_line: address.trim(),
          area,
          payment_method: paymentMethod as any,
          reseller_note: note || null,
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

      const items = picked.map(({ line, l }) => {
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

      toast.success("Order created and sent to admin");
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
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-base font-semibold sm:text-lg">New order</h2>
            <p className="text-xs text-muted-foreground">
              Product search kore add korun — delivery charge product onujai apply hobe.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {/* Product picker */}
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">Products</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your listings by product name…"
                    className="input pl-9"
                  />
                </div>

                {results.length === 0 ? (
                  <div className="mt-2 rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    {listings.length === 0
                      ? "First add active listings from Catalog."
                      : "No product matched your search."}
                  </div>
                ) : (
                  <div className="mt-2 max-h-56 divide-y overflow-y-auto rounded-md border">
                    {results.map((l) => {
                      const p = l.products!;
                      const dc = productDeliveryCharge(p, area);
                      const inCart = lines.some((x) => x.listing_id === l.id);
                      return (
                        <button
                          type="button"
                          key={l.id}
                          onClick={() => pick(l.id)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50"
                        >
                          {p.og_image_url && (
                            <img src={p.og_image_url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{p.name}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              ৳{Number(l.selling_price).toFixed(0)} · {deliveryLabel(p)} · this area ৳{dc.toFixed(0)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-medium text-primary">
                            {inCart ? "+1" : "Add"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {picked.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      No products added yet.
                    </div>
                  )}
                  {picked.map(({ line, l }, i) => {
                    const p = l.products!;
                    const dc = productDeliveryCharge(p, area);
                    return (
                      <div key={l.id} className="flex items-center gap-3 rounded-md border p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            ৳{Number(l.selling_price).toFixed(0)} × {line.qty} · delivery ৳{dc.toFixed(0)}
                            {totals.shipping > dc && " (not applied — higher one wins)"}
                          </div>
                        </div>
                        <div className="inline-flex shrink-0 items-center rounded-md border">
                          <button type="button" onClick={() => setQty(i, line.qty - 1)} className="px-2 py-1.5">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[2.5ch] text-center text-xs font-semibold">{line.qty}</span>
                          <button type="button" onClick={() => setQty(i, line.qty + 1)} className="px-2 py-1.5">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

            <aside className="h-fit space-y-1 rounded-lg border bg-muted/40 p-4 text-sm lg:sticky lg:top-0">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Summary
              </div>
              <Row label="Subtotal" value={`৳${totals.subtotal.toFixed(0)}`} />
              <Row label="Delivery charge" value={totals.shipping ? `৳${totals.shipping.toFixed(0)}` : "Free"} />
              {picked.length > 1 && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {totals.shipping
                    ? `Highest single-product charge applied${totals.shipFrom ? ` (${totals.shipFrom})` : ""} — charges are not added up.`
                    : "Free delivery on this order."}
                </p>
              )}
              <Row label="Total" value={`৳${totals.total.toFixed(0)}`} bold />
              <Row label="Your profit" value={`৳${totals.profit.toFixed(0)}`} muted />
            </aside>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create order — ৳{totals.total.toFixed(0)}
          </button>
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

type Item = {
  id: string;
  product_name: string;
  quantity: number;
  reseller_price: number;
  line_total: number;
  profit: number;
};

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
  const [events, setEvents] = useState<CourierEvent[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // A reseller can only Confirm or Cancel a new order (draft/pending).
  // After that, admin logic takes over.
  const canAct = !order.forwarded_to_admin && (order.status === "pending" || order.status === "draft");

  useEffect(() => {
    (async () => {
      const [{ data: it }, { data: ev }, { data: sh }] = await Promise.all([
        supabase
          .from("order_items")
          .select("id,product_name,quantity,reseller_price,line_total,profit")
          .eq("order_id", order.id),
        supabase
          .from("courier_events")
          .select(
            "id,provider,source,notification_type,courier_status,tracking_code,cod_amount,delivery_charge,note,event_at",
          )
          .eq("order_id", order.id)
          .order("event_at", { ascending: false }),
        supabase
          .from("shipments")
          .select("id,provider,tracking_id,consignment_id,status,courier_status,cod_amount,delivery_charge,last_event_at")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
      ]);
      setItems((it ?? []) as Item[]);
      setEvents((ev ?? []) as CourierEvent[]);
      setShipments(sh ?? []);
      setLoading(false);
    })();
  }, [order.id]);

  async function setStatus(next: "confirmed" | "cancelled") {
    setBusy(true);
    const patch: Record<string, unknown> =
      next === "confirmed"
        ? { status: "confirmed", forwarded_to_admin: true, forwarded_at: new Date().toISOString() }
        : { status: "cancelled" };
    const { error } = await supabase.from("orders").update(patch as any).eq("id", order.id);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await supabase.from("order_status_history").insert({ order_id: order.id, status: next as any });
    toast.success(next === "confirmed" ? "Order confirmed and sent to admin" : "Order cancelled");
    setBusy(false);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-md space-y-4 overflow-y-auto bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{order.order_number}</h2>
            <p className="text-xs text-muted-foreground">
              {order.customer_name} · {order.customer_phone}
            </p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs capitalize ${orderStatusTone(order.status)}`}>
              {orderStatusLabel(order.status)}
            </span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {canAct ? (
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => setStatus("confirmed")}
              className="btn-brand inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Confirm
            </button>
            <button
              disabled={busy}
              onClick={() => setStatus("cancelled")}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" /> Cancel
            </button>
          </div>
        ) : (
          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            This order has been sent to admin — only admin/courier can update its status now.
          </p>
        )}

        <div className="surface-card p-4 text-sm">
          <div className="mb-2 font-medium">Delivery</div>
          <p className="text-xs text-muted-foreground">
            {order.address_line}
            {order.city ? `, ${order.city}` : ""} · {String(order.area).replace(/_/g, " ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Payment: {order.payment_method} ({order.payment_status})
          </p>
          {order.notes && <p className="mt-1 text-xs text-muted-foreground">Customer note: {order.notes}</p>}
          {order.reseller_note && (
            <p className="mt-1 text-xs text-muted-foreground">Your note: {order.reseller_note}</p>
          )}
        </div>

        <div className="surface-card p-4">
          <div className="mb-2 text-sm font-medium">Items</div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex items-center justify-between border-b py-2 text-sm last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.quantity} × ৳{Number(it.reseller_price).toFixed(0)} · profit ৳
                    {Number(it.profit).toFixed(0)}
                  </div>
                </div>
                <div className="font-medium">৳{Number(it.line_total).toFixed(0)}</div>
              </div>
            ))
          )}
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <Row label="Subtotal" value={`৳${Number(order.subtotal).toFixed(0)}`} />
            <Row label="Shipping" value={`৳${Number(order.shipping_cost).toFixed(0)}`} />
            {Number(order.discount) > 0 && (
              <Row label="Discount" value={`-৳${Number(order.discount).toFixed(0)}`} />
            )}
            <Row label="Total" value={`৳${Number(order.total).toFixed(0)}`} bold />
            <Row label="Your profit" value={`৳${Number(order.reseller_profit).toFixed(0)}`} muted />
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="mb-2 text-sm font-medium">Parcel info</div>
          {shipments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Admin has not booked a courier yet.</p>
          ) : (
            shipments.map((s) => (
              <div key={s.id} className="space-y-1 border-b py-2 text-sm last:border-b-0">
                <div className="font-medium capitalize">{s.provider}</div>
                <div className="text-xs text-muted-foreground">
                  Tracking: {s.tracking_id ?? "—"}
                  {s.consignment_id ? ` · CID ${s.consignment_id}` : ""}
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 capitalize text-primary">
                    {String(s.status).replace(/_/g, " ")}
                  </span>
                  {s.courier_status && (
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      Courier: {courierStatusLabel(s.courier_status, s.provider)}
                    </span>
                  )}
                  {s.cod_amount != null && (
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      COD ৳{Number(s.cod_amount).toFixed(0)}
                    </span>
                  )}
                </div>
                {s.last_event_at && (
                  <div className="text-[11px] text-muted-foreground">
                    Last update: {new Date(s.last_event_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <CourierTimeline events={events} title="Courier tracking history" />
      </div>
    </div>
  );
}
