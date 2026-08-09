import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pagination, usePaginated, type FilterOption } from "@/components/data-list";
import {
  OrderFilterBar,
  applyOrderFilters,
  DEFAULT_ORDER_FILTERS,
  type OrderFilterState,
} from "@/components/order-filters";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { Loader2, Truck, X, Download, Zap, RotateCcw, RefreshCw, Lock, PackageCheck, Repeat, Ban, Search, ListChecks, SlidersHorizontal, ChevronDown, Plus, MoreVertical, Eye, FileText, Trash2, Phone, CheckCircle2, AlertCircle, ShoppingCart, Printer, AlertTriangle, Settings2, Copy } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewOrderModal } from "@/components/NewOrderModal";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  bookSteadfast,
  bookPathao,
  syncPathaoStatus,
  syncSteadfastStatus,
  steadfastCreateReturn,
  bookCarrybee,
  syncCarrybeeStatus,
  carrybeeReversePickup,
  carrybeeExchange,
  cancelCarrybee,
  receiveReturn,
} from "@/lib/couriers.functions";


import { CourierTimeline, type CourierEvent } from "@/components/CourierTimeline";
import { OrderTabs } from "@/components/OrderTabs";
import { PickListModal } from "@/components/pick-list-modal";
import { OrderSearch, type OrderSearchMode } from "@/components/order-search";
import { printShippingLabels } from "@/lib/labels";


import {
  ORDER_TABS,
  ORDER_STATUS_OPTIONS,
  courierStatusLabel,
  orderStatusTone,
  orderStatusLabel,
  type OrderTabKey,
} from "@/lib/courier-status";

type OrderRow = {
  id: string;
  reseller_id: string;
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
  resellers: { business_name: string; code: string } | null;
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
  consignment_id: string | null;
  status: string;
  courier_status: string | null;
  cod_amount: number | null;
  delivery_charge: number | null;
  last_event_at: string | null;
  cost: number;
  booked_at: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrdersPage,
});

function exportCsv(rows: OrderRow[]) {
  const head = ["Order", "Date", "Reseller", "Customer", "Phone", "Area", "Address", "Payment", "Status", "Total"];
  const csv = [head.join(",")]
    .concat(
      rows.map((o) =>
        [
          o.order_number,
          new Date(o.created_at).toISOString().slice(0, 10),
          o.resellers?.business_name ?? "",
          o.customer_name,
          o.customer_phone,
          o.area,
          `"${(o.address_line ?? "").replace(/"/g, '""')}"`,
          o.payment_method,
          o.status,
          Number(o.total).toFixed(0),
        ].join(","),
      ),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type OrderItemLite = { order_id: string; product_id: string | null; product_name: string; quantity: number };





function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLite[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  const bookAuto = useServerFn(bookSteadfast);

  const [tab, setTab] = useState<OrderTabKey>("confirmed");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [open, setOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [searchMode, setSearchMode] = useState<OrderSearchMode>("order");

  const [showFilters, setShowFilters] = useState(false);
    const [pickOpen, setPickOpen] = useState(false);
    const [marked, setMarked] = useState<string[]>([]);
    const [pickScope, setPickScope] = useState<"filtered" | "marked">("filtered");

    const [page, setPage] = useState(1);
    const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; currentStatus: string; isBulk?: boolean } | null>(null);
    const [resellerOptions, setResellerOptions] = useState<FilterOption[]>([]);

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
    setLoading(true);
    const statuses = ORDER_TABS.find((t) => t.key === tab)?.statuses ?? [];
    let q = supabase
      .from("orders")
      .select(
        "id,reseller_id,order_number,customer_name,customer_phone,address_line,area,total,status,payment_status,payment_method,forwarded_to_admin,created_at,reseller_note,admin_note,resellers(business_name,code)",
      )
      .order("created_at", { ascending: false });
    if (statuses.length > 0) q = q.in("status", statuses);
    const [{ data }, { data: all }, { data: rs }, { data: p }] = await Promise.all([
      q,
      supabase.from("orders").select("status"),
      supabase.from("resellers").select("id,business_name,code,phone").order("business_name"),
      supabase.from("products").select("id,name,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url,suggested_price").eq("is_active", true).order("created_at", { ascending: false }),
    ]);
    const rows = (data ?? []) as OrderRow[];
    setOrders(rows);
    if (rows.length > 0) {
      const [{ data: its }, { data: s }, { data: ev }] = await Promise.all([
        supabase
          .from("order_items")
          .select("order_id,product_id,product_name,quantity")
          .in("order_id", rows.map((r) => r.id)),
        supabase
          .from("shipments")
          .select("order_id,provider,consignment_id")
          .in("order_id", rows.map(r => r.id)),
        supabase
          .from("courier_events")
          .select("order_id")
          .in("order_id", rows.map(r => r.id))
      ]);
      setOrderItems((its ?? []) as OrderItemLite[]);
      setShipments(s ?? []);
      setEvents(ev ?? []);
    } else {
      setOrderItems([]);
      setShipments([]);
      setEvents([]);
    }

    setResellerOptions(
      (rs ?? []).map((r: any) => ({ value: r.id, label: `${r.business_name} (/${r.code})` })),
    );
    setResellers(rs ?? []);
    const byStatus: Record<string, number> = {};
    for (const row of all ?? []) byStatus[(row as any).status] = (byStatus[(row as any).status] ?? 0) + 1;
    const tabCounts: Record<string, number> = { all: (all ?? []).length };
    for (const t of ORDER_TABS) {
      if (t.key === "all") continue;
      tabCounts[t.key] = t.statuses.reduce((s, st) => s + (byStatus[st] ?? 0), 0);
    }
    setCounts(tabCounts);
    setAllProducts((p ?? []) as any[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [tab]);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemLite[]>();
    for (const it of orderItems) {
      const arr = m.get(it.order_id);
      if (arr) arr.push(it);
      else m.set(it.order_id, [it]);
    }
    return m;
  }, [orderItems]);

  /** One search box, mode decides target: order fields or product name. */
  const filtered = useMemo(() => {
    const base = applyOrderFilters(orders, { ...filters, q: "" });
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
  }, [orders, filters, itemsByOrder, searchMode]);



  const markedOrders = useMemo(
    () => filtered.filter((o) => marked.includes(o.id)),
    [filtered, marked],
  );

  const buildPickList = (rows: OrderRow[]) => {
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
  };

  const pickList = useMemo(
    () => buildPickList(pickScope === "marked" ? markedOrders : filtered),
    [pickScope, markedOrders, filtered, itemsByOrder],
  );

  useEffect(() => {
    setPage(1);
  }, [filters, tab]);
  const bulkUpdateStatus = async (newStatus: string) => {
    if (marked.length === 0) return;
    
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
    
    // Check for sensitive statuses/bookings
    const sensitiveOrders = orders.filter(o => {
      if (!marked.includes(o.id)) return false;
      const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
      const hasWebhooks = events.some((e: any) => e.order_id === o.id);
      const isAdvanced = ["to_courier", "delivered", "pending_return", "returned"].includes(o.status);
      return isBooked || hasWebhooks || isAdvanced;
    });

    const isSensitive = sensitiveOrders.length > 0;
    
    setConfirmModal({
      open: true,
      title: isSensitive ? "Hard Warning: Delete Orders" : "Delete Orders",
      description: isSensitive 
        ? `⚠️ WARNING: ${sensitiveOrders.length} of the selected orders have active courier bookings or advanced statuses. Deleting them might cause record mismatches. Are you sure you want to PERMANENTLY delete these ${marked.length} orders?`
        : `Are you sure you want to delete ${marked.length} orders? This action cannot be undone.`,
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
          toast.success(`${marked.length} orders deleted successfully`);
          setMarked([]);
          await load();
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setLoading(false);
      }
    });
  };


  const removeOrder = async (order: OrderRow) => {
    const isBooked = shipments.some(s => s.order_id === order.id && (s.consignment_id || s.tracking_id));
    const hasWebhooks = events.some((e: any) => e.order_id === order.id);
    const isAdvanced = ["to_courier", "delivered", "pending_return", "returned"].includes(order.status);

    const isSensitive = isBooked || hasWebhooks || isAdvanced;

    setConfirmModal({
      open: true,
      title: isSensitive ? "Hard Warning: Delete Order" : "Delete Order",
      description: isSensitive
        ? `⚠️ HARD WARNING: This order has active courier data or advanced status (${order.status}). Deleting it may break tracking records. Delete anyway?`
        : "Are you sure you want to delete this order?",
      variant: "danger",
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.from("orders").delete().eq("id", order.id);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Order deleted");
          await load();
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setLoading(false);
      }
    });
  };


  const paged = usePaginated(filtered, page, filters.perPage);




  return (
    <div>
      <PageHeader
        title="Orders"
        description=""
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={() => exportCsv(filtered)}
              disabled={filtered.length === 0}
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
        <OrderSearch
          mode={searchMode}
          onMode={setSearchMode}
          value={filters.q}
          onChange={(v) => setFilters({ ...filters, q: v })}
        />

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

        {marked.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
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
              onClick={() => printShippingLabels(marked)}
            >
              <Printer className="h-3.5 w-3.5" /> Print Labels
            </button>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
              onClick={() => exportCsv(markedOrders)}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20"
              onClick={() => {
                toast.info("Bulk courier booking coming soon");
              }}
            >
              <Truck className="h-3.5 w-3.5" /> Send to Courier
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


        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {orders.length}
        </span>
      </div>

      {showFilters && (
        <OrderFilterBar
          value={filters}
          onChange={setFilters}
          resellerOptions={resellerOptions}
          total={orders.length}
          shown={filtered.length}
        />
      )}


      {pickOpen && (
        <PickListModal
          rows={pickList}
          scopeLabel={
            pickScope === "marked"
              ? `${markedOrders.length} marked order`
              : `${ORDER_TABS.find((t) => t.key === tab)?.label ?? "All"} — ${filtered.length} order`
          }
          onPick={(name) => {
            setSearchMode("product");
            setFilters((f) => ({ ...f, q: name }));
            setPickOpen(false);
          }}
          onClose={() => setPickOpen(false)}
        />
      )}


      <OrderTabs tab={tab} onChange={setTab} count={(k) => counts[k] ?? 0} />


      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : paged.length === 0 ? (
        <EmptyState title="No orders" description="No orders match this filter." />
      ) : (
        <>
        <div className="surface-card overflow-hidden">
          <div className="hidden grid-cols-[40px_1fr_1fr_1.2fr_1fr_1fr_1fr_80px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
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
            <div>Reseller</div>
            <div>Courier</div>
            <div>Total</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>
          {paged.map((o) => {
            const items = itemsByOrder.get(o.id) ?? [];
            const itemText = items.length
              ? `${items[0].product_name}${items.length > 1 ? ` +${items.length - 1} more` : ""}`
              : "—";
            const qty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            
            return (
              <div
                key={o.id}
                className={`border-b last:border-b-0 ${
                  marked.includes(o.id) ? "bg-primary/5" : ""
                }`}
              >
                {/* Mobile card view */}
                <div className="p-3 md:hidden">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      checked={marked.includes(o.id)}
                      onChange={(e) =>
                        setMarked((prev) =>
                          e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                        )
                      }
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
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize ${orderStatusTone(o.status)}`}>
                          {orderStatusLabel(o.status)}
                        </span>
                      </div>

                      <div className="mt-2 space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{o.customer_name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <a href={`tel:${o.customer_phone}`} className="text-primary hover:text-primary/80 transition-colors">
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
                                <Truck className="h-2.5 w-2.5" />
                                <span className="capitalize">{s.provider}</span>
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

                        <div className="truncate text-muted-foreground">{o.area || "—"}</div>
                        <div className="truncate text-[11px] text-muted-foreground italic">
                          Reseller: {o.resellers?.business_name || "Direct"}
                          <div className="flex items-center gap-1 mt-0.5">
                             {resellers.find(r => r.id === o.reseller_id)?.phone ? (
                               <>
                                 <span className="tabular-nums">{resellers.find(r => r.id === o.reseller_id).phone}</span>
                                 <a href={`tel:${resellers.find(r => r.id === o.reseller_id).phone}`} className="text-primary hover:text-primary/80 transition-colors">
                                   <Phone className="h-2.5 w-2.5" />
                                 </a>
                                 <button 
                                   onClick={() => {
                                     navigator.clipboard.writeText(resellers.find(r => r.id === o.reseller_id).phone);
                                     toast.success("Reseller phone copied");
                                   }}
                                   className="text-muted-foreground hover:text-foreground transition-colors"
                                 >
                                   <Copy className="h-2.5 w-2.5" />
                                 </button>
                               </>
                             ) : (
                               <span className="opacity-50">No phone</span>
                             )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 truncate text-xs text-muted-foreground">
                        {itemText} {qty > 0 && <span className="ml-1 text-[10px] opacity-70">({qty} pcs)</span>}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t pt-2">
                        <div className="font-semibold text-primary">৳{Number(o.total).toFixed(0)}</div>
                        <div className="flex gap-2">
                           <button
                             onClick={() => setSelected(o)}
                             className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                           >
                             View Details
                           </button>
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-md border p-1 hover:bg-accent">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => setSelected(o)}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}>
                                <Settings2 className="mr-2 h-4 w-4" /> Change Status
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => printShippingLabels([o.id], "3x3")}>
                                <Printer className="mr-2 h-4 w-4" /> Print Label (3x3)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop table row */}
                <div className="hidden grid-cols-[40px_1fr_1fr_1.2fr_1fr_1fr_1fr_80px] items-center gap-4 px-4 py-3 text-sm md:grid">
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={marked.includes(o.id)}
                      onChange={(e) =>
                        setMarked((prev) =>
                          e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                        )
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{o.customer_name}</div>
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
                    <div className="font-medium truncate">{o.resellers?.business_name || "Direct"}</div>
                    {o.resellers && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        {resellers.find(r => r.id === o.reseller_id)?.phone ? (
                          <>
                            <span className="tabular-nums">{resellers.find(r => r.id === o.reseller_id).phone}</span>
                            <a href={`tel:${resellers.find(r => r.id === o.reseller_id).phone}`} className="text-primary hover:text-primary/80 transition-colors">
                              <Phone className="h-2.5 w-2.5" />
                            </a>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(resellers.find(r => r.id === o.reseller_id).phone);
                                toast.success("Reseller phone copied");
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          </>
                        ) : (
                          <span className="opacity-50">No phone</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="min-w-0">
                    {shipments.some(s => s.order_id === o.id) ? (
                      <div className="flex flex-col gap-0.5">
                        {shipments.filter(s => s.order_id === o.id).map(s => (
                          <div key={s.id} className="flex flex-col">
                            <div className="text-[10px] font-bold text-primary uppercase leading-tight">
                              {s.provider}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums font-medium">
                              #{s.consignment_id || "N/A"}
                              {s.consignment_id && (
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(s.consignment_id || "");
                                    toast.success("Booking ID copied");
                                  }}
                                  className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                                >
                                  <Copy className="h-2.5 w-2.5 inline-block -mt-0.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[9px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-dashed">
                        Not Booked
                      </span>
                    )}
                  </div>

                  <div className="font-semibold whitespace-nowrap">৳{Number(o.total).toFixed(0)}</div>
                  <div className="min-w-0">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] capitalize inline-block whitespace-nowrap ${orderStatusTone(o.status)}`}>
                      {orderStatusLabel(o.status)}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1 hover:bg-accent">
                          <MoreVertical className="h-5 w-5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setSelected(o)}>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}>
                          <Settings2 className="mr-2 h-4 w-4" /> Change Status
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => {
                          const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                          if (isBooked) {
                            toast.error("Already booked in courier");
                            return;
                          }
                          // Default to Steadfast for quick booking from menu
                          setBusy(true);
                          try {
                            const r = await bookAuto({ data: { orderId: o.id, deliveryType: 0 } });
                            toast.success(`Booked Steadfast · ${r.trackingId}`);
                            load();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Booking failed");
                          } finally {
                            setBusy(false);
                          }
                        }}>
                          <Truck className="mr-2 h-4 w-4" /> Send to Steadfast
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => printShippingLabels([o.id], "3x3")}>
                          <Printer className="mr-2 h-4 w-4" /> Print Label (3x3)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printShippingLabels([o.id], "3x4")}>
                          <Printer className="mr-2 h-4 w-4" /> Print Label (3x4)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => removeOrder(o)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Order
                        </DropdownMenuItem>
                      </DropdownMenuContent>

                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Pagination page={page} perPage={filters.perPage} total={filtered.length} onPage={setPage} />
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
      {open && (
        <NewOrderModal
          listings={[]}
          allProducts={allProducts}
          resellers={resellers}
          isAdmin={true}
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
            
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-1.5">
                {ORDER_STATUS_OPTIONS.filter(s => s !== 'forwarded').map((s) => (
                  <button
                    key={s}
                    disabled={loading}
                    onClick={async () => {
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
  const [events, setEvents] = useState<CourierEvent[]>([]);
  const [status, setStatus] = useState(order.status);
  const [adminNote, setAdminNote] = useState(order.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  
  // Courier configs
  const [activeCouriers, setActiveCouriers] = useState<{provider: string, config: any}[]>([]);
  
  const bookAuto = useServerFn(bookSteadfast);
  const bookPathaoFn = useServerFn(bookPathao);
  const syncPathaoFn = useServerFn(syncPathaoStatus);
  const syncStatus = useServerFn(syncSteadfastStatus);

  const createReturn = useServerFn(steadfastCreateReturn);
  const bookCarrybeeFn = useServerFn(bookCarrybee);
  const syncCarrybeeFn = useServerFn(syncCarrybeeStatus);
  const carrybeeReturnFn = useServerFn(carrybeeReversePickup);
  const carrybeeExchangeFn = useServerFn(carrybeeExchange);
  const carrybeeCancelFn = useServerFn(cancelCarrybee);
  const receiveReturnFn = useServerFn(receiveReturn);
  const courierLocked = shipments.some((s) => s.consignment_id || s.tracking_id);


  // shipment form
  const [provider, setProvider] = useState<string>("");
  const [tracking, setTracking] = useState("");
  const [cost, setCost] = useState<number>(0);
  const [deliveryType, setDeliveryType] = useState<0 | 1>(0);
  const [cbDeliveryType, setCbDeliveryType] = useState<1 | 2>(1);
  const [cbWeight, setCbWeight] = useState<number>(0);
  const [pxDeliveryType, setPxDeliveryType] = useState<48 | 12>(48);
  const [pxWeight, setPxWeight] = useState<number>(0.5);



  async function loadDetails() {
    const [{ data: i }, { data: s }, { data: ev }, { data: configs }] = await Promise.all([
      supabase
        .from("order_items")
        .select("id,product_name,quantity,reseller_price,sa_price,line_total")
        .eq("order_id", order.id),
      supabase
        .from("shipments")
        .select(
          "id,provider,tracking_id,consignment_id,status,courier_status,cod_amount,delivery_charge,last_event_at,cost,booked_at",
        )
        .eq("order_id", order.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("courier_events")
        .select(
          "id,provider,source,notification_type,courier_status,tracking_code,cod_amount,delivery_charge,note,event_at",
        )
        .eq("order_id", order.id)
        .order("event_at", { ascending: false }),
      supabase
        .from("courier_configs")
        .select("provider, config, is_active")
        .eq("is_active", true)
    ]);
    
    setItems((i ?? []) as Item[]);
    setShipments((s ?? []) as Shipment[]);
    setEvents((ev ?? []) as CourierEvent[]);
    
    const active = (configs ?? []).map(c => ({ provider: c.provider, config: c.config }));
    setActiveCouriers(active);
    if (active.length > 0) {
      setProvider(active[0].provider);
    }
  }
  useEffect(() => {
    loadDetails();
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
      await supabase.from("orders").update({ status: "shipped" }).eq("id", order.id);
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
            <h2 className="text-lg font-semibold">Order #{order.order_number}</h2>
            <p className="text-xs text-muted-foreground">
              {order.resellers?.business_name}
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
          {events.length > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Warning: This order has courier webhook updates. Manual status changes may conflict with real-time tracking.
              </span>
            </div>
          )}
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)} 
            className="input capitalize border-primary/50 focus:border-primary shadow-sm"
          >
            {ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
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
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={saveStatus}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save status
            </button>
            {order.status === "pending_return" && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const note = prompt("Return receive note (optional)") ?? undefined;
                  setBusy(true);
                  try {
                    await receiveReturnFn({ data: { orderId: order.id, note } });
                    toast.success("Return received — order returned");
                    await loadDetails();
                    onChanged();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Return receive failed");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-4 py-2 text-sm font-medium text-success"
              >
                <PackageCheck className="h-4 w-4" /> Receive return
              </button>
            )}
          </div>
        </div>


        <div className="surface-card mb-4 overflow-hidden border-primary/20 bg-primary/5">
          <div className="border-b border-primary/10 bg-primary/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-sm font-bold text-primary">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" /> Courier Booking & Shipments
              </div>
              {shipments.some(s => s.consignment_id) && (
                <button 
                  onClick={() => loadDetails()}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Recall / Sync API
                </button>
              )}
            </div>
          </div>
          <div className="p-4">
          {shipments.length > 0 ? (
            <div className="mb-4 divide-y">
              {shipments.map((s) => (
                <div key={s.id} className="space-y-2 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium capitalize">
                        {s.provider}
                        {s.consignment_id && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            CID: {s.consignment_id}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tracking: {s.tracking_id ?? "—"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 capitalize text-primary">
                          {s.status.replace(/_/g, " ")}
                        </span>
                        {s.courier_status && (
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            Courier: {courierStatusLabel(s.courier_status, s.provider)}
                          </span>
                        )}

                        {s.cod_amount != null && (
                          <span className="rounded-full bg-muted px-2 py-0.5">COD ৳{Number(s.cod_amount).toFixed(0)}</span>
                        )}
                        {s.delivery_charge != null && (
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            Charge ৳{Number(s.delivery_charge).toFixed(0)}
                          </span>
                        )}
                      </div>
                      {s.last_event_at && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Last update: {new Date(s.last_event_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm">৳{Number(s.cost).toFixed(0)}</div>
                  </div>
                  {s.provider === "steadfast" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await syncStatus({ data: { shipmentId: s.id } });
                            toast.success(`Courier status: ${courierStatusLabel(r.courierStatus)}`);
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Sync failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Sync status
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const reason = prompt("Return reason (optional)") ?? undefined;
                          setBusy(true);
                          try {
                            const r = await createReturn({ data: { shipmentId: s.id, reason } });
                            toast.success(`Return request: ${r.status}`);
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Return request failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Request return
                      </button>
                    </div>
                  )}
                  {s.provider === "pathao" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await syncPathaoFn({ data: { shipmentId: s.id } });
                            toast.success(`Courier status: ${courierStatusLabel(r.courierStatus, "pathao")}`);
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Sync failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Sync status
                      </button>
                    </div>
                  )}
                  {s.provider === "carrybee" && (

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await syncCarrybeeFn({ data: { shipmentId: s.id } });
                            toast.success(`Courier status: ${courierStatusLabel(r.courierStatus, "carrybee")}`);
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Sync failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Sync status
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const reason = prompt("Reverse pickup reason (optional)") ?? undefined;
                          setBusy(true);
                          try {
                            await carrybeeReturnFn({ data: { shipmentId: s.id, reason } });
                            toast.success("Reverse pickup requested");
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Reverse pickup failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reverse pickup
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const note = prompt("Exchange note (optional)") ?? undefined;
                          setBusy(true);
                          try {
                            await carrybeeExchangeFn({ data: { shipmentId: s.id, note } });
                            toast.success("Exchange requested");
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Exchange failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Repeat className="h-3.5 w-3.5" /> Exchange
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const reason = prompt("Cancel reason (required)");
                          if (!reason || reason.trim().length < 2) return;
                          setBusy(true);
                          try {
                            await carrybeeCancelFn({ data: { shipmentId: s.id, reason: reason.trim() } });
                            toast.success("Shipment cancelled");
                            await loadDetails();
                            onChanged();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Cancel failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Ban className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  )}

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
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create Manual Shipment
            </button>
            {provider === "steadfast" && (
              <>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(Number(e.target.value) as 0 | 1)}
                  className="input col-span-2"
                >
                  <option value={0}>Home delivery</option>
                  <option value={1}>Point delivery / hub pickup</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await bookAuto({ data: { orderId: order.id, deliveryType } });
                      toast.success(`Booked · ${r.trackingId}`);
                      await loadDetails();
                      onChanged();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Booking failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
                >
                  <Zap className="h-4 w-4" /> Send to Steadfast
                </button>
              </>
            )}
            {provider === "pathao" && (
              <>
                <select
                  value={pxDeliveryType}
                  onChange={(e) => setPxDeliveryType(Number(e.target.value) as 48 | 12)}
                  className="input col-span-2"
                >
                  <option value={48}>Normal delivery (48h)</option>
                  <option value={12}>On demand delivery (12h)</option>
                </select>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  placeholder="Item weight (kg)"
                  value={pxWeight || ""}
                  onChange={(e) => setPxWeight(Number(e.target.value))}
                  className="input col-span-2"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await bookPathaoFn({
                        data: {
                          orderId: order.id,
                          deliveryType: pxDeliveryType,
                          itemWeight: pxWeight >= 0.5 ? pxWeight : undefined,
                        },
                      });
                      toast.success(`Booked · ${r.trackingId}`);
                      await loadDetails();
                      onChanged();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Booking failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
                >
                  <Zap className="h-4 w-4" /> Send to Pathao
                </button>
              </>
            )}

            {provider === "carrybee" && (
              <>
                <select
                  value={cbDeliveryType}
                  onChange={(e) => setCbDeliveryType(Number(e.target.value) as 1 | 2)}
                  className="input col-span-2"
                >
                  <option value={1}>Regular delivery</option>
                  <option value={2}>Express delivery</option>
                </select>
                <input
                  type="number"
                  placeholder="Item weight (gram)"
                  value={cbWeight || ""}
                  onChange={(e) => setCbWeight(Number(e.target.value))}
                  className="input col-span-2"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await bookCarrybeeFn({
                        data: {
                          orderId: order.id,
                          deliveryType: cbDeliveryType,
                          itemWeight: cbWeight > 0 ? cbWeight : undefined,
                        },
                      });
                      toast.success(`Booked · ${r.trackingId}`);
                      await loadDetails();
                      onChanged();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Booking failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
                >
                  <Zap className="h-4 w-4" /> Send to Carrybee
                </button>
              </>
            )}

          </form>
        </div>
      </div>

        <CourierTimeline events={events} />
      </div>
    </div>
  );
}
