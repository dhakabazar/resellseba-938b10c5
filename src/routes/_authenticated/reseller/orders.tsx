import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productDeliveryCharge, deliveryLabel } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import {

  Loader2,
  Trash2,
  FileText,
  Download,
  Plus,
  X,
  MoreVertical,
  Eye,
  Phone,
  CheckCircle2,
  Settings2,
  Truck,
  Copy,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";



import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewOrderModal } from "@/components/NewOrderModal";
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
import { Check, Ban, Search, ListChecks, SlidersHorizontal, ChevronDown, Printer } from "lucide-react";
import { CourierLogo, courierLabel } from "@/components/courier-brand";
import { printShippingLabels } from "@/lib/labels";


import {
  ORDER_TABS,
  courierStatusLabel,
  orderStatusLabel,
  orderStatusTone,
  ORDER_STATUS_OPTIONS,
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

type Line = { listing_id?: string; product_id?: string; qty: number; name?: string; price?: number; cost?: number; image?: string; delivery?: any };

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
  const [shipments, setShipments] = useState<any[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
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
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; currentStatus: string; isBulk?: boolean } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
    variant?: "danger" | "warning";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: async () => {},
  });


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
    const [{ data: o }, { data: l }, { data: p }] = await Promise.all([
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
      supabase
        .from("products")
        .select("id,name,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url,suggested_price")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);
    const rows = (o ?? []) as OrderRow[];
    setOrders(rows);
    setListings((l ?? []) as Listing[]);
    setAllProducts((p ?? []) as any[]);
    
    if (rows.length > 0) {
      const [{ data: its }, { data: s }, { data: ev }] = await Promise.all([
        supabase
          .from("order_items")
          .select("order_id,product_id,product_name,quantity")
          .in("order_id", rows.map((x) => x.id)),
        supabase
          .from("shipments")
          .select("order_id,provider,consignment_id,status,courier_status,last_event_at")
          .in("order_id", rows.map(x => x.id)),
        supabase
          .from("courier_events")
          .select("order_id,provider,courier_status,note,event_at")
          .in("order_id", rows.map(x => x.id))
      ]);
      setOrderItems((its ?? []) as OrderItemLite[]);
      setShipments(s ?? []);
      setEvents(ev ?? []);
    } else {
      setOrderItems([]);
      setShipments([]);
      setEvents([]);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user, tab]);

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
  
  // Re-read file to find where to add the chevron toggle and grid columns
  // (The previous AI message mentioned reconstructing the grid)
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

  const bulkUpdateStatus = async (newStatus: string) => {
    if (marked.length === 0) return;
    
    // Check if any order is already booked
    const bookedIds = shipments.map(s => s.order_id);
    const lockedCount = marked.filter(id => bookedIds.includes(id)).length;
    
    if (lockedCount > 0) {
      toast.error(`${lockedCount} orders are already booked in courier and cannot be changed.`);
      return;
    }

    setConfirmModal({
      open: true,
      title: "Bulk Status Update",
      description: `Are you sure you want to update ${marked.length} orders to ${newStatus}?`,
      variant: "warning",
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase
          .from("orders")
          .update({ status: newStatus as any })
          .in("id", marked);
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`${marked.length} orders updated successfully`);
          setMarked([]);
          await load();
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setLoading(false);
      }
    });
  };


  const bulkDeleteOrders = async () => {
    if (marked.length === 0) return;
    
    // Check if any order is NOT pending/confirmed or is booked
    const bookedIds = shipments.filter(s => s.consignment_id || s.tracking_id).map(s => s.order_id);
    const restricted = visible.filter(o => marked.includes(o.id) && (!["pending", "confirmed"].includes(o.status) || bookedIds.includes(o.id)));
    
    if (restricted.length > 0) {
      toast.error(`${restricted.length} orders cannot be deleted (must be Pending/Confirmed and NOT booked).`);
      return;
    }

    setConfirmModal({
      open: true,
      title: "Delete Orders",
      description: `Delete ${marked.length} selected orders? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase
          .from("orders")
          .delete()
          .in("id", marked);
        
        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`${marked.length} orders deleted`);
          setMarked([]);
          await load();
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setLoading(false);
      }
    });
  };


  const tabCount = (key: OrderTabKey) => {

    const sts = ORDER_TABS.find((t) => t.key === key)?.statuses ?? [];
    return sts.length === 0 ? orders.length : orders.filter((o) => (sts as string[]).includes(o.status)).length;
  };



  async function remove(id: string) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const isBooked = shipments.some(s => s.order_id === id && (s.consignment_id || s.tracking_id));
    if (!["pending", "confirmed"].includes(order.status) || isBooked) {
      toast.error("You can only delete Pending or Confirmed orders that are not booked.");
      return;
    }

    setConfirmModal({
      open: true,
      title: "Delete Order",
      description: "Are you sure you want to delete this order? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.from("orders").delete().eq("id", id);
        if (error) toast.error(error.message);
        else {
          toast.success("Order deleted");
          load();
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setLoading(false);
      }
    });
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

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Per page:</span>
          <select 
            value={filters.perPage}
            onChange={(e) => setFilters({ ...filters, perPage: Number(e.target.value) })}
            className="h-9 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value={-1}>All</option>
          </select>
        </div>
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
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <span className="mr-2 text-sm font-medium">{marked.length} marked</span>
          
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            onClick={() => setStatusModal({ open: true, orderId: marked[0], currentStatus: orders.find(o => o.id === marked[0])?.status || "pending", isBulk: true })}
          >
            <Settings2 className="h-3.5 w-3.5" /> Change Status
          </button>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            onClick={() => {
              setPickScope("marked");
              setPickOpen(true);
            }}
          >
            <ListChecks className="h-3.5 w-3.5" /> Pick list
          </button>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            onClick={() => exportCsv(markedOrders)}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20"
            onClick={bulkDeleteOrders}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>

          <button
            type="button"
            onClick={() => setMarked([])}
            className="ml-auto text-xs text-muted-foreground hover:underline"
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

      <OrderTabs 
        tab={tab} 
        onChange={setTab} 
        count={(key) => {
          const sts = ORDER_TABS.find((t) => t.key === key)?.statuses ?? [];
          return sts.length === 0 ? orders.length : orders.filter((o) => (sts as string[]).includes(o.status)).length;
        }} 
      />

      {/* Removed stats cards per user request to match dashboard style (or just remove if duplicate) */}


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
          <div className="hidden grid-cols-[30px_minmax(60px,0.7fr)_minmax(100px,1fr)_minmax(100px,1.2fr)_60px_80px_100px_60px] gap-2 border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
            <div className="flex items-center justify-center">
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
            </div>
            <div>Order</div>
            <div>Customer</div>
            <div>Courier</div>
            <div>Total</div>
            <div>Profit</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelected(o)}
                      className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                    >
                      Details
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md border p-1 hover:bg-accent">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setSelected(o)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>

                        {(() => {
                          const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                          if (!isBooked) {
                            return (
                              <DropdownMenuItem onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}>
                                <Settings2 className="mr-2 h-4 w-4" /> Change Status
                              </DropdownMenuItem>
                            );
                          }
                          return null;
                        })()}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            to="/reseller/orders/$id/invoice"
                            params={{ id: o.id }}
                            target="_blank"
                            className="flex w-full items-center"
                          >
                            <FileText className="mr-2 h-4 w-4" /> View Invoice
                          </Link>
                        </DropdownMenuItem>
                        {!o.forwarded_to_admin && (o.status === "pending" || o.status === "confirmed") && !shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id)) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => remove(o.id)}
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Order
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>

                    </DropdownMenu>
                  </div>
                );

            const orderShipment = shipments.find((s) => s.order_id === o.id);

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
                          <div className="text-[10px] font-medium text-primary uppercase">
                            {shipments.find((s: any) => s.order_id === o.id)?.provider || "Manual"} 
                            {shipments.find((s: any) => s.order_id === o.id)?.consignment_id && ` #${shipments.find((s: any) => s.order_id === o.id)?.consignment_id}`}
                          </div>

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
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{o.customer_name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <a 
                              href={`tel:${o.customer_phone}`}
                              className="text-primary hover:text-primary/80 transition-colors"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(o.customer_phone);
                                toast.success("Phone number copied");
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {shipments.some(s => s.order_id === o.id) && (
                          <div className="flex flex-wrap gap-1">
                            {shipments.filter(s => s.order_id === o.id).map(s => (
                              <div key={s.id} className="inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/10">
                                <CourierLogo provider={s.provider} size={12} />
                                <span>{courierLabel(s.provider)}</span>
                                {s.consignment_id && (
                                  <>
                                    <span className="opacity-70">({s.consignment_id})</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(s.consignment_id || "");
                                        toast.success("Booking ID copied");
                                      }}
                                      className="ml-0.5 opacity-50 hover:opacity-100"
                                    >
                                      <Copy className="h-2 w-2" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

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
                          className={`rounded px-1.5 py-0.5 ${o.status === "confirmed" && o.forwarded_to_admin ? "bg-success/10 text-success" : "hidden"}`}
                        >
                          {o.forwarded_to_admin ? "Sent to admin" : ""}
                        </span>

                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
                    </div>
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden grid-cols-[30px_minmax(60px,0.7fr)_minmax(100px,1fr)_minmax(100px,1.2fr)_60px_80px_100px_60px] items-center gap-2 px-4 py-3 text-sm md:grid">
                  <div className="flex flex-col items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={isMarked}
                      onChange={(e) => mark(e.target.checked)}
                    />
                    <button
                      onClick={() => setExpandedOrders(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
                      className="rounded-full p-1 hover:bg-muted transition-colors shrink-0"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedOrders.includes(o.id) ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="min-w-0 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground truncate">{o.customer_name}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {o.customer_phone}
                      <a href={`tel:${o.customer_phone}`} className="text-primary hover:text-primary/80 transition-colors">
                        <Phone className="h-3 w-3" />
                      </a>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(o.customer_phone);
                          toast.success("Phone number copied");
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="min-w-0">
                    {orderShipment ? (
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-primary leading-tight">
                          <CourierLogo provider={orderShipment.provider} size={14} />
                          <span className="truncate">{courierLabel(orderShipment.provider)}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums font-medium flex items-center gap-1">
                          <span className="truncate">#{orderShipment.consignment_id || "N/A"}</span>
                          {orderShipment.consignment_id && (
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(orderShipment.consignment_id || "");
                                toast.success("Booking ID copied");
                              }}
                              className="opacity-50 hover:opacity-100 transition-opacity"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60 italic">No courier booking</span>
                    )}
                  </div>

                  <div className="min-w-0 font-semibold whitespace-nowrap">৳{Number(o.total).toFixed(0)}</div>
                  <div className="min-w-0 text-[11px] font-medium text-success whitespace-nowrap">
                    ৳{Number(o.reseller_profit).toFixed(0)}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] capitalize whitespace-nowrap ${orderStatusTone(o.status)}`}
                    >
                      {orderStatusLabel(o.status)}
                    </span>
                    {o.status === "confirmed" && o.forwarded_to_admin && (
                      <div className="mt-0.5 text-[9px] text-success font-medium">
                        Sent to admin
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">{actions}</div>
                </div>

                {/* Collapsible content section */}
                {expandedOrders.includes(o.id) && (
                  <div className="border-t bg-muted/20 px-4 py-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Products list */}
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                          <PackageCheck className="h-3.5 w-3.5" /> Ordered Products ({items.length})
                        </h4>
                        <div className="space-y-2">
                          {items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-lg border bg-background p-3 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                                  {allProducts.find(p => p.id === it.product_id)?.og_image_url ? (
                                    <img src={allProducts.find(p => p.id === it.product_id).og_image_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ShoppingCart className="h-5 w-5 text-muted-foreground/40" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">{it.product_name}</div>
                                  <div className="text-xs text-muted-foreground font-medium">Qty: {it.quantity}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order metadata & shipping details */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Shipping Address</h4>
                          <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
                            <div className="font-medium">{o.customer_name}</div>
                            <div className="text-muted-foreground mt-1">{o.address_line}</div>
                            <div className="text-muted-foreground">{o.area}, {o.city}</div>
                            <div className="mt-2 text-xs font-medium inline-block rounded bg-primary/10 px-2 py-1 text-primary uppercase">
                              Payment: {o.payment_method}
                            </div>
                          </div>
                        </div>
                        
                        {o.reseller_note && (
                          <div>
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Your Note</h4>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 shadow-sm italic">
                              {o.reseller_note}
                            </div>
                          </div>
                        )}

                        <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
                           <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Financial Summary</h4>
                           <div className="flex justify-between py-1 border-b border-dashed">
                             <span>Subtotal</span>
                             <span>৳{Number(o.subtotal).toFixed(0)}</span>
                           </div>
                           <div className="flex justify-between py-1 border-b border-dashed">
                             <span>Shipping</span>
                             <span>৳{Number(o.shipping_cost).toFixed(0)}</span>
                           </div>
                           <div className="flex justify-between py-1 border-b border-dashed">
                             <span>Discount</span>
                             <span>৳{Number(o.discount).toFixed(0)}</span>
                           </div>
                           <div className="flex justify-between py-1 font-bold text-primary mt-1">
                             <span>Grand Total</span>
                             <span>৳{Number(o.total).toFixed(0)}</span>
                           </div>
                           <div className="flex justify-between py-1 font-bold text-success mt-1 pt-1 border-t">
                             <span>Your Profit</span>
                             <span>৳{Number(o.reseller_profit).toFixed(0)}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


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
          allProducts={allProducts}
          resellerId={resellerId}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            load();
          }}
        />
      )}

      {statusModal && statusModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200 sm:max-w-md">
            <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/30">
              <h3 className="text-sm font-bold text-foreground">Change Status</h3>
              <button onClick={() => setStatusModal(null)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 gap-1.5">
                {['pending', 'confirmed', 'cancelled'].map((s) => (
                  <button
                    key={s}
                    disabled={loading}
                    onClick={async () => {
                      if (statusModal.isBulk) {
                        await bulkUpdateStatus(s);
                        setStatusModal(null);
                        return;
                      }
                      setLoading(true);
                      const { error } = await supabase
                        .from("orders")
                        .update({ status: s as any })
                        .eq("id", statusModal.orderId);
                      
                      if (error) {
                        toast.error(error.message);
                      } else {
                        toast.success(`Status updated to ${orderStatusLabel(s)}`);
                        setStatusModal(null);
                        await load();
                      }
                      setLoading(false);
                    }}
                    className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs transition-all hover:bg-accent disabled:opacity-50 ${
                      statusModal.currentStatus === s ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-transparent"
                    }`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-offset-2 ring-offset-background ${orderStatusTone(s).split(' ')[0]} ${statusModal.currentStatus === s ? "ring-primary/40" : "ring-transparent group-hover:ring-accent-foreground/10"}`} />
                    <span className={`flex-1 font-medium capitalize ${statusModal.currentStatus === s ? "text-primary" : "text-foreground/80"}`}>{orderStatusLabel(s)}</span>
                    {statusModal.currentStatus === s && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t bg-muted/10 px-5 py-3 flex justify-end">
              <button
                onClick={() => setStatusModal(null)}
                className="rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        variant={confirmModal.variant}
        isLoading={loading}
      />
    </div>

  );
}
// Removed internal NewOrderModal as it is now shared in src/components/NewOrderModal.tsx

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
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
            <h2 className="text-lg font-semibold">Order #{order.order_number}</h2>
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
                <div className="flex items-center gap-1.5 font-medium">
                  <CourierLogo provider={s.provider} size={18} />
                  {courierLabel(s.provider)}
                </div>
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
