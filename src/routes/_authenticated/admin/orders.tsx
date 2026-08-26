import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination, usePaginated, type FilterOption } from "@/components/data-list";
import {
  applyOrderFilters,
  DEFAULT_ORDER_FILTERS,
  type OrderFilterState,
} from "@/components/order-filters";
import { SearchableSelect } from "@/components/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { BulkScanButton } from "@/components/BulkScanModal";
import { Loader2, X, Download, PackageCheck, ChevronDown, Plus, MoreVertical, Eye, Phone, CheckCircle2, Settings2, Trash2, Copy, ShoppingCart, Printer, Truck, RefreshCw, TrendingUp, DollarSign, Wallet, MapPin } from "lucide-react";
import { CourierLogo, courierLabel, COURIER_BRANDS } from "@/components/courier-brand";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveCouriers } from "@/lib/courier-config.functions";
import { getOrderDetails, recheckCourierStatus } from "@/lib/order-details.functions";
import { syncSteadfastStatus, syncPathaoStatus } from "@/lib/couriers.functions";
import {
  orderProfit,
  orderReceived,
  orderShortfall,
  orderPackaging,
  isFailedOrder,
} from "@/lib/finance-report";
import { OrderMoneyPanel, AdvanceChip } from "@/components/order-money";
import { ResellerTotalCell, AdminTotalCell } from "@/components/order-total-cell";
import { keptQty } from "@/lib/business-report";


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCan } from "@/lib/use-auth";
import { NewOrderModal } from "@/components/NewOrderModal";
import { OrderEditModal } from "@/components/OrderEditModal";
import { type StripItem, ImageLightbox, OrderItemsList, OrderProductCell } from "@/components/order-items-strip";

import { OrderSettleModal } from "@/components/OrderSettleModal";
import { ShipmentBookingModal } from "@/components/ShipmentBookingModal";
import { toast } from "sonner";
import { OrderNotes } from "@/components/order-notes";
import { CourierTimeline, type CourierEvent } from "@/components/CourierTimeline";
import { bookSteadfast } from "@/lib/couriers.functions";
import { OrderTabs } from "@/components/OrderTabs";
import { Pencil, ExternalLink } from "lucide-react";
import { courierTrackingUrl } from "@/lib/courier-tracking";
import { PickListModal } from "@/components/pick-list-modal";
import { OrderSearch, type OrderSearchMode } from "@/components/order-search";
import { printShippingLabels } from "@/lib/labels";
import {
  ORDER_TABS,
  ORDER_STATUS_OPTIONS,
  orderStatusTone,
  orderStatusLabel,
  type OrderTabKey,
  nextStatuses,
  SETTLEMENT_STATUSES,
  isPartialStatus,
} from "@/lib/courier-status";

type OrderRow = {
  id: string;
  reseller_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  area: string;
  city: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  sa_cost_total: number;
  packaging_total: number | null;
  delivery_cost: number | null;
  received_amount: number | null;
  advance_amount: number | null;
  advance_by: string | null;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  forwarded_to_admin: boolean;
  created_at: string;
  reseller_note: string | null;
  admin_note: string | null;
  resellers: { business_name: string; code: string; contact_phone: string | null } | null;
};

type OrderItemLite = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  returned_qty?: number | null;
  reseller_price: number | null;
  line_total: number | null;
};

export const Route = createFileRoute("/_authenticated/admin/orders")({
  validateSearch: (s: Record<string, unknown>): { tab?: OrderTabKey; reseller?: string; q?: string } => ({
    tab: ORDER_TABS.some((t) => t.key === s.tab) ? (s.tab as OrderTabKey) : undefined,
    reseller: typeof s.reseller === "string" && s.reseller ? s.reseller : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const can = useCan();
  const canCreate = can("orders.create");
  const canEdit = can("orders.edit");
  const canDelete = can("orders.delete");
  const canStatus = can("orders.status", "orders.edit");
  const canShip = can("orders.ship", "couriers.manage");
  const { tab: tabParam, reseller: resellerParam, q: qParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [allOrders, setAllOrders] = useState<{ status: string }[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLite[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState<OrderTabKey>(tabParam ?? ((resellerParam || qParam) ? "all" : "forwarded"));

  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [open, setOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [filters, setFilters] = useState<OrderFilterState>({ ...DEFAULT_ORDER_FILTERS, reseller: resellerParam ?? "", q: qParam ?? "" });

  useEffect(() => {
    navigate({
      search: (prev) => {
        const next: any = { ...prev, tab, reseller: filters.reseller || undefined };
        if (tab === "forwarded") delete next.tab;
        if (!filters.reseller) delete next.reseller;
        return next;
      },
      replace: true,
    });
  }, [tab, filters.reseller]);

  const [searchMode, setSearchMode] = useState<OrderSearchMode>("order");
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; currentStatus: string; isBulk?: boolean } | null>(null);
  const [settleModal, setSettleModal] = useState<{ orderId: string; status: string; pickKind?: boolean } | null>(
    null,
  );
  const [bookingModal, setBookingModal] = useState<{ open: boolean; orderIds: string[] }>({ open: false, orderIds: [] });
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  
  const fetchActive = useServerFn(getActiveCouriers);
  const { data: activeProviders = [] } = useQuery({
    queryKey: ["active-couriers"],
    queryFn: () => fetchActive(),
  });

  const activeProviderLabel = useMemo(() => {
    if (activeProviders.length === 1) {
      return (COURIER_BRANDS as any)[activeProviders[0]]?.label || "Courier";
    }
    return null;
  }, [activeProviders]);
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
  const [resellerOptions, setResellerOptions] = useState<FilterOption[]>([]);

  const ORDER_SELECT =
    "id,reseller_id,order_number,customer_name,customer_phone,address_line,area,city,subtotal,discount,shipping_cost,sa_cost_total,packaging_total,delivery_cost,received_amount,advance_amount,advance_by,total,status,payment_status,payment_method,forwarded_to_admin,created_at,reseller_note,admin_note,resellers(business_name,code,contact_phone)";
  const ITEM_SELECT = "order_id,product_id,product_name,product_image,quantity,returned_qty,reseller_price,line_total";
  const SHIPMENT_SELECT = "id,order_id,provider,tracking_id,consignment_id";

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    const statuses = ORDER_TABS.find((t) => t.key === tab)?.statuses ?? [];
    let q = supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false });
    if (statuses.length > 0) q = q.in("status", statuses);
    const [{ data }, { data: allStats }, { data: rs }, { data: p }] = await Promise.all([
      q,
      supabase.from("orders").select("status"),
      supabase.from("resellers").select("id,business_name,code,contact_phone").order("business_name"),
      supabase.from("products").select("id,brand_id,category_id,name,slug,product_code,og_image_url,suggested_price,reseller_price,buying_price,packaging_cost,delivery_mode,delivery_flat,delivery_inside,delivery_outside").eq("is_active", true),
    ]);
    const rows = (data ?? []) as OrderRow[];
    setOrders(rows);
    setAllOrders(allStats ?? []);
    if (rows.length > 0) {
      const [{ data: its }, { data: s }] = await Promise.all([
        supabase.from("order_items").select(ITEM_SELECT).in("order_id", rows.map((r) => r.id)),
        supabase.from("shipments").select(SHIPMENT_SELECT).in("order_id", rows.map(r => r.id)),
      ]);
      setOrderItems((its ?? []) as OrderItemLite[]);
      setShipments(s ?? []);
    }
    setResellerOptions((rs ?? []).map((r: any) => ({ value: r.id, label: `${r.business_name} (/${r.code})` })));
    setResellers(rs ?? []);
    setAllProducts((p ?? []) as any[]);
    if (!opts?.silent) setLoading(false);
  }

  // Refresh only the touched order rows — keeps scroll position, page and filters intact.
  async function syncOrders(ids: string[]) {
    const list = ids.filter(Boolean);
    if (list.length === 0) return;
    const statuses = (ORDER_TABS.find((t) => t.key === tab)?.statuses ?? []) as string[];
    const inTab = (s: string) => statuses.length === 0 || statuses.includes(s);
    const [{ data: rows }, { data: its }, { data: sh }, { data: allStats }] = await Promise.all([
      supabase.from("orders").select(ORDER_SELECT).in("id", list),
      supabase.from("order_items").select(ITEM_SELECT).in("order_id", list),
      supabase.from("shipments").select(SHIPMENT_SELECT).in("order_id", list),
      supabase.from("orders").select("status"),
    ]);
    const fetched = ((rows ?? []) as unknown) as OrderRow[];
    setAllOrders(allStats ?? []);
    setOrders((prev) => {
      let next = prev
        .map((o) => fetched.find((f) => f.id === o.id) ?? o)
        .filter((o) => !list.includes(o.id) || inTab(o.status));
      for (const f of fetched) {
        if (!next.some((o) => o.id === f.id) && inTab(f.status)) next = [f, ...next];
      }
      return next;
    });
    setOrderItems((prev) => [...prev.filter((i) => !list.includes(i.order_id)), ...((its ?? []) as OrderItemLite[])]);
    setShipments((prev) => [...prev.filter((s) => !list.includes(s.order_id)), ...((sh ?? []) as any[])]);
  }

  async function dropOrders(ids: string[]) {
    setOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
    setOrderItems((prev) => prev.filter((i) => !ids.includes(i.order_id)));
    setShipments((prev) => prev.filter((s) => !ids.includes(s.order_id)));
    setMarked((prev) => prev.filter((id) => !ids.includes(id)));
    setExpandedOrders((prev) => prev.filter((id) => !ids.includes(id)));
    const { data: allStats } = await supabase.from("orders").select("status");
    setAllOrders(allStats ?? []);
  }


  async function removeOrder(id: string) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const isBooked = shipments.some(s => s.order_id === id && (s.consignment_id || s.tracking_id));
    
    setConfirmModal({
      open: true,
      title: "Delete Order",
      description: isBooked 
        ? "Warning: This order is already booked with a courier. Deleting it will NOT cancel the parcel in the courier system. Are you sure you want to proceed?"
        : "Are you sure you want to delete this order? This action cannot be undone.",
      variant: isBooked ? "warning" : "danger",
      onConfirm: async () => {
        setBusy(true);
        const { data: deleted, error } = await supabase.from("orders").delete().eq("id", id).select("id");
        if (error) toast.error(error.message);
        else if (!deleted || deleted.length === 0) toast.error("Delete failed: you do not have permission to delete this order.");
        else {
          toast.success("Order deleted");
          await dropOrders([id]);
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setBusy(false);
      }
    });
  }

  async function bulkUpdateStatus(newStatus: string) {
    if (marked.length === 0) return;
    if (isPartialStatus(newStatus)) {
      toast.error("Partial statuses can't be set in bulk — settle each order individually.");
      return;
    }
    const blocked = marked.filter((id) => isPartialStatus(orders.find((o) => o.id === id)?.status || ""));
    if (blocked.length > 0) {
      toast.error(`${blocked.length} selected order(s) are in a partial status — bulk status change is blocked.`);
      return;
    }
    setConfirmModal({
      open: true,
      title: "Bulk Status Update",
      description: `Update ${marked.length} orders to ${orderStatusLabel(newStatus)}?`,
      variant: "warning",
      onConfirm: async () => {
        setBusy(true);
        const targetIds = [...marked];
        let error: { message: string } | null = null;
        if (newStatus === "delivered") {
          // Full delivery = full order total collected.
          for (const id of marked) {
            const o = orders.find((x) => x.id === id);
            const res = await supabase
              .from("orders")
              .update({ status: newStatus as any, received_amount: Number(o?.total ?? 0) })
              .eq("id", id);
            if (res.error) {
              error = res.error;
              break;
            }
          }
        } else {
          const res = await supabase.from("orders").update({ status: newStatus as any }).in("id", marked);
          error = res.error;
        }
        if (error) toast.error(error.message);
        else {
          toast.success(`${targetIds.length} orders updated`);
          setMarked([]);
          await syncOrders(targetIds);
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setBusy(false);
      }
    });
  }

  async function bulkDeleteOrders() {
    if (marked.length === 0) return;
    const bookedIds = shipments.filter(s => s.consignment_id || s.tracking_id).map(s => s.order_id);
    const bookedCount = marked.filter(id => bookedIds.includes(id)).length;
    setConfirmModal({
      open: true,
      title: "Delete Orders",
      description: bookedCount > 0
        ? `Warning: ${bookedCount} of ${marked.length} selected orders are already booked with a courier. Deleting them will NOT cancel the parcels in the courier system. Proceed?`
        : `Delete ${marked.length} selected orders? This action cannot be undone.`,
      variant: bookedCount > 0 ? "warning" : "danger",
      onConfirm: async () => {
        setBusy(true);
        const { data: deleted, error } = await supabase.from("orders").delete().in("id", marked).select("id");
        if (error) toast.error(error.message);
        else if (!deleted || deleted.length === 0) toast.error("Delete failed: you do not have permission to delete these orders.");
        else {
          if (deleted.length < marked.length) toast.warning(`${deleted.length} of ${marked.length} orders deleted, the rest were not permitted.`);
          else toast.success(`${deleted.length} orders deleted`);
          await dropOrders(deleted.map((d: any) => d.id));
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setBusy(false);
      }
    });
  }
  useEffect(() => {
    load();
  }, [tab]);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemLite[]>();
    for (const it of orderItems) {
      const arr = m.get(it.order_id);
      if (arr) arr.push(it); else m.set(it.order_id, [it]);
    }
    return m;
  }, [orderItems]);

  const stripItems = useCallback(
    (orderId: string): StripItem[] =>
      (itemsByOrder.get(orderId) ?? []).map((it, idx) => {
        const p = allProducts.find((x) => x.id === it.product_id);
        return {
          id: `${orderId}-${idx}`,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.reseller_price,
          line_total: it.line_total,
          image: it.product_image ?? p?.og_image_url ?? null,
          slug: p?.slug ?? null,
        };
      }),
    [itemsByOrder, allProducts],
  );

  /** Admin buying cost of the items the customer actually kept. */
  const buyingCostFor = useCallback(
    (orderId: string, status: string) => {
      let cost = 0;
      for (const it of itemsByOrder.get(orderId) ?? []) {
        const p = allProducts.find((x) => x.id === it.product_id);
        cost += (Number(p?.buying_price) || 0) * keptQty({ ...it, returned_qty: it.returned_qty ?? 0 } as any, status);
      }
      return cost;
    },
    [itemsByOrder, allProducts],
  );

  const filtered = useMemo(() => {
    const base = applyOrderFilters(orders, { ...filters, q: "" });
    const q = filters.q.trim().toLowerCase();
    if (!q) return base;
    return base.filter((o) => {
        if (searchMode === "product") return (itemsByOrder.get(o.id) ?? []).some((it) => it.product_name.toLowerCase().includes(q));
        const has = (v?: string | null) => (v ?? "").toLowerCase().includes(q);
        return has(o.order_number) || has(o.customer_name) || has(o.customer_phone);
    });
  }, [orders, filters, itemsByOrder, searchMode]);

  const paged = usePaginated(filtered, page, filters.perPage);

  return (
    <div>
        <PageHeader 
            title="Orders" 
            className="flex-row items-center justify-between"
            actions={
                <div className="flex items-center gap-2">
                  {!isPartialStatus(tab) && canStatus && (
                    <BulkScanButton mode={tab === "pending_return" ? "return" : "handover"} onDone={() => void load({ silent: true })} />
                  )}
                  {canCreate && (
                  <button
                      onClick={() => setOpen(true)}
                      className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
                  >
                      <Plus className="h-4 w-4" /> New Order
                  </button>
                  )}
                </div>
            }
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
            <OrderSearch mode={searchMode} onMode={setSearchMode} value={filters.q} onChange={(v) => setFilters({ ...filters, q: v })} />
            <SearchableSelect
              options={resellerOptions.map((r) => ({ value: r.value, label: r.label }))}
              value={filters.reseller}
              onChange={(v) => {
                setFilters({ ...filters, reseller: v });
                if (v) setTab("all");
              }}
              placeholder="All resellers"
              searchPlaceholder="Search reseller…"
              className="min-w-[220px]"
            />
            <div className="ml-auto flex items-center gap-2">
              <select
                value={filters.perPage}
                onChange={(e) => setFilters({ ...filters, perPage: Number(e.target.value) })}
                className="h-10 rounded-md border bg-background px-2 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                title="Per page"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
                <option value={-1}>All</option>
              </select>
            </div>
        </div>

        {marked.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
            <span className="mr-2 text-sm font-medium">{marked.length} marked</span>
            {canStatus && (() => {
              const partialMarked = marked.some((id) => isPartialStatus(orders.find((o) => o.id === id)?.status || ""));
              return (
                <button
                  disabled={partialMarked}
                  title={partialMarked ? "Partial orders must be settled one by one" : undefined}
                  onClick={() => {
                    if (partialMarked) {
                      toast.error("Partial orders can't be changed in bulk — settle each order individually.");
                      return;
                    }
                    setStatusModal({
                      open: true,
                      orderId: marked[0],
                      currentStatus: orders.find((x) => x.id === marked[0])?.status || "confirmed",
                      isBulk: true,
                    });
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Change Status
                </button>
              );
            })()}
            <button
              onClick={() => printShippingLabels(marked)}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            >
              <Printer className="h-3.5 w-3.5" /> Print Labels
            </button>
            {canShip && (
            <button
              onClick={() => setBookingModal({ open: true, orderIds: marked })}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            >
              <Truck className="h-3.5 w-3.5" /> {activeProviderLabel ? `Book ${activeProviderLabel}` : "Book Courier"}
            </button>
            )}
            {canDelete && (
            <button
              onClick={bulkDeleteOrders}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/40 bg-background px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            )}
            <button
              onClick={() => setMarked([])}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        <OrderTabs 
          tab={tab} 
          onChange={setTab} 
          count={(key) => {
            const sts = ORDER_TABS.find((t) => t.key === key)?.statuses ?? [];
            return sts.length === 0 ? allOrders.length : allOrders.filter((o) => (sts as string[]).includes(o.status)).length;
          }} 
        />
        
        {loading ? <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : (
          <div className="space-y-3">
            <div className="hidden grid-cols-[36px_minmax(66px,0.6fr)_minmax(120px,0.9fr)_minmax(110px,0.9fr)_minmax(120px,1fr)_96px_104px_130px_50px] gap-1 rounded-lg border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
               <div className="flex justify-center">
                 <input
                   type="checkbox"
                   className="h-4 w-4 accent-[hsl(var(--primary))]"
                   checked={marked.length > 0 && marked.length === paged.length}
                   onChange={(e) => setMarked(e.target.checked ? paged.map(x => x.id) : [])}
                 />
               </div>
               <div>Order</div> <div>Reseller</div> <div>Products</div> <div>Customer</div> <div>Reseller total</div> <div>Admin total</div> <div>Status</div> <div className="text-right">Actions</div>
            </div>
            {paged.map((o) => (
              <div
                key={o.id}
                className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40 ${marked.includes(o.id) ? "border-primary ring-1 ring-primary/30" : ""}`}
              >
                <div className="hidden grid-cols-[36px_minmax(66px,0.6fr)_minmax(120px,0.9fr)_minmax(110px,0.9fr)_minmax(120px,1fr)_96px_104px_130px_50px] items-center gap-1 border-b bg-muted/30 px-4 py-3 text-sm md:grid">
                  <div className="flex flex-col items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={marked.includes(o.id)}
                      onChange={(e) => setMarked(prev => e.target.checked ? [...prev, o.id] : prev.filter(x => x !== o.id))}
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
                    <div className="text-[10px] text-muted-foreground/70 tabular-nums">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="min-w-0">
                     <div className="font-medium truncate">{o.resellers?.business_name || "Direct"}</div>
                     <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                       {o.resellers?.contact_phone || "—"}
                       {o.resellers?.contact_phone && (
                         <>
                           <a href={`tel:${o.resellers.contact_phone}`} className="text-primary hover:text-primary/80">
                             <Phone className="h-3 w-3" />
                           </a>
                           <button onClick={() => { navigator.clipboard.writeText(o.resellers?.contact_phone || ""); toast.success("Copied"); }} className="hover:text-foreground">
                             <Copy className="h-3 w-3" />
                           </button>
                         </>
                       )}
                     </div>
                  </div>
                  <OrderProductCell
                    items={stripItems(o.id)}
                    expanded={expandedOrders.includes(o.id)}
                    onZoom={setZoomImage}
                    onToggle={() => setExpandedOrders(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
                  />

                  <div className="min-w-0">
                     <div className="font-medium truncate">{o.customer_name}</div>
                     <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                       {o.customer_phone}
                       <a href={`tel:${o.customer_phone}`} className="text-primary hover:text-primary/80">
                         <Phone className="h-3 w-3" />
                       </a>
                       <button onClick={() => { navigator.clipboard.writeText(o.customer_phone); toast.success("Copied"); }} className="hover:text-foreground">
                         <Copy className="h-3 w-3" />
                       </button>
                     </div>
                     <div className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                       <MapPin className="mt-[1px] h-3 w-3 shrink-0 opacity-70" />
                       <span className="line-clamp-2">
                         {o.address_line}
                         {o.area ? `, ${o.area.replace("_", " ")}` : ""}
                         {o.city ? `, ${o.city}` : ""}
                       </span>
                     </div>
                  </div>
                   <ResellerTotalCell order={o as any} />
                   <AdminTotalCell order={o as any} buyingCost={buyingCostFor(o.id, o.status)} />
                   <div className="min-w-0">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${orderStatusTone(o.status)}`}>{orderStatusLabel(o.status)}</span>
                       {shipments.filter(s => s.order_id === o.id).length > 0 ? (
                         <div className="mt-1 space-y-0.5">
                           {shipments.filter(s => s.order_id === o.id).map(s => (
                             <div key={s.id} className="flex flex-col gap-0.5 min-w-0">
                               {(() => {
                                 const url = courierTrackingUrl(s.provider, s, (o as any).customer_phone);
                                 const inner = (
                                   <>
                                     <CourierLogo provider={s.provider} size={12} />
                                     <span className="truncate">{courierLabel(s.provider)}</span>
                                     {url && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                                   </>
                                 );
                                 return url ? (
                                   <a href={url} target="_blank" rel="noopener noreferrer" title="Track on courier website" className="flex items-center gap-1 text-[10px] font-bold text-primary leading-tight hover:underline">{inner}</a>
                                 ) : (
                                   <div className="flex items-center gap-1 text-[10px] font-bold text-primary leading-tight">{inner}</div>
                                 );
                               })()}
                               <div className="text-[10px] text-muted-foreground tabular-nums font-medium flex items-center gap-1">
                                 <span className="truncate">#{s.consignment_id || "N/A"}</span>
                                 {s.consignment_id && (
                                   <button onClick={() => { navigator.clipboard.writeText(s.consignment_id); toast.success("Booking ID copied"); }} className="opacity-50 hover:opacity-100 transition-opacity">
                                     <Copy className="h-2.5 w-2.5" />
                                   </button>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <span className="mt-1 inline-block text-[10px] italic text-muted-foreground/60">Not booked yet</span>
                       )}
                   </div>
                  <div className="flex justify-end">
                     <DropdownMenu>
                       <DropdownMenuTrigger><MoreVertical className="h-4 w-4" /></DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelected(o)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          {canEdit && (
                          <DropdownMenuItem onClick={() => setEditId(o.id)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Order
                          </DropdownMenuItem>
                          )}
                          {canStatus && (
                          <DropdownMenuItem
                            onClick={() =>
                              o.status === "pending_partial"
                                ? setSettleModal({ orderId: o.id, status: "partial_full", pickKind: true })
                                : setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })
                            }
                          >
                            <Settings2 className="mr-2 h-4 w-4" /> Change Status
                          </DropdownMenuItem>
                          )}
                          {canShip && (() => {
                            const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                            if (!isBooked) {
                              return (
                                <DropdownMenuItem onClick={() => setBookingModal({ open: true, orderIds: [o.id] })}>
                                  <Truck className="mr-2 h-4 w-4" /> {activeProviderLabel ? `Book ${activeProviderLabel}` : "Book Courier"}
                                </DropdownMenuItem>
                              );
                            }
                            return null;
                          })()}
                          {canDelete && (() => {
                            const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                            return (
                              <DropdownMenuItem
                                onClick={() => removeOrder(o.id)}
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Order
                              </DropdownMenuItem>
                            );
                          })()}
                       </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
                </div>
                {expandedOrders.includes(o.id) && (
                  <div className="bg-muted/30 px-4 py-5 md:px-8">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <OrderItemsList items={stripItems(o.id)} onZoom={setZoomImage} />

                      <div className="space-y-4">
                        <div>
                          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Shipping Address
                          </h4>
                          <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
                            <div className="font-medium">{o.customer_name}</div>
                            <div className="mt-0.5 font-mono text-xs text-muted-foreground">{o.customer_phone}</div>
                            <div className="mt-1 text-muted-foreground">{o.address_line}</div>
                            <div className="text-muted-foreground">
                              {o.area?.replace("_", " ")}
                              {o.city ? `, ${o.city}` : ""}
                            </div>
                            <div className="mt-2 inline-block rounded bg-primary/10 px-2 py-1 text-xs font-medium uppercase text-primary">
                              Payment: {o.payment_method}
                            </div>
                            {(() => {
                              const isBooked = shipments.some(
                                (s) => s.order_id === o.id && (s.consignment_id || s.tracking_id),
                              );
                              if (isBooked) return null;
                              return (
                                <div className="mt-3 border-t pt-3">
                                  <button
                                    onClick={() => setBookingModal({ open: true, orderIds: [o.id] })}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                                  >
                                    <Truck className="h-3 w-3" />{" "}
                                    {activeProviderLabel ? `Book ${activeProviderLabel}` : "Book Courier"}
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {o.admin_note && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            <span className="mb-1 block text-[10px] font-bold uppercase">Admin Note</span>
                            {o.admin_note}
                          </div>
                        )}
                        {o.reseller_note && (
                          <div className="rounded-lg border bg-background p-3 text-sm italic text-muted-foreground">
                            <span className="mb-1 block text-[10px] font-bold uppercase not-italic">Reseller Note</span>
                            "{o.reseller_note}"
                          </div>
                        )}

                        <OrderMoneyPanel order={o} role="admin" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
        {statusModal && statusModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/30">
                <h3 className="text-sm font-bold text-foreground">Change Status</h3>
                <button onClick={() => setStatusModal(null)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const recommended = statusModal.isBulk
                      ? []
                      : nextStatuses(statusModal.currentStatus, "admin");
                    const list = Array.from(
                      new Set([
                        ...recommended,
                        statusModal.currentStatus,
                        ...ORDER_STATUS_OPTIONS,
                      ]),
                    ) as typeof ORDER_STATUS_OPTIONS;
                    // Keep the order-list (tab) serial everywhere.
                    const rank = (s: string) => {
                      const i = (ORDER_STATUS_OPTIONS as string[]).indexOf(s);
                      return i === -1 ? 999 : i;
                    };
                    return list.slice().sort((a, b) => rank(a) - rank(b));
                  })().map((s) => (
                    <button
                      key={s}
                      disabled={loading || busy}
                      onClick={async () => {
                        if (statusModal.isBulk) {
                          await bulkUpdateStatus(s);
                          setStatusModal(null);
                          return;
                        }
                        if ((SETTLEMENT_STATUSES as string[]).includes(s)) {
                          setSettleModal({ orderId: statusModal.orderId, status: s });
                          setStatusModal(null);
                          return;
                        }
                        setBusy(true);
                        const targetId = statusModal.orderId;
                        const curr = orders.find((o) => o.id === targetId);
                        const patch: Record<string, unknown> = { status: s as any };
                        if (s === "delivered") patch.received_amount = Number(curr?.total ?? 0);
                        const { error } = await supabase
                          .from("orders")
                          .update(patch as any)
                          .eq("id", statusModal.orderId);

                        if (error) {
                          toast.error(error.message);
                        } else {
                          toast.success(`Status updated to ${orderStatusLabel(s)}`);
                          setStatusModal(null);
                          await syncOrders([targetId]);
                        }
                        setBusy(false);
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
        <OrderSettleModal
          open={!!settleModal}
          orderId={settleModal?.orderId ?? null}
          targetStatus={settleModal?.status ?? "delivered"}
          allowKindSwitch={!!settleModal?.pickKind}
          onClose={() => setSettleModal(null)}
          onSaved={() => {
            const id = settleModal?.orderId;
            if (id) void syncOrders([id]);
          }}
        />
        <ShipmentBookingModal
          isOpen={bookingModal.open}
          onClose={() => setBookingModal({ open: false, orderIds: [] })}
          orderIds={bookingModal.orderIds}
          onSuccess={() => {
            const ids = [...bookingModal.orderIds];
            setMarked([]);
            void syncOrders(ids);
          }}
        />

        {open && (
          <NewOrderModal
            listings={[]}
            allProducts={allProducts}
            resellers={resellers}
            isAdmin
            onClose={() => setOpen(false)}
            onCreated={() => {
              setOpen(false);
              void load({ silent: true });
            }}
          />
        )}

        {editId && (
          <OrderEditModal
            orderId={editId}
            allProducts={allProducts}
            isAdmin
            onClose={() => setEditId(null)}
            onSaved={() => {
              const id = editId;
              setEditId(null);
              if (id) void syncOrders([id]);
            }}
          />
        )}

        {selected && (
          <OrderDrawer
            orderId={selected.id}
            onClose={() => setSelected(null)}
            allProducts={allProducts}
          />
        )}

        {zoomImage && <ImageLightbox src={zoomImage} onClose={() => setZoomImage(null)} />}

    </div>
  );
}

function OrderDrawer({ 
  orderId, 
  onClose,
  allProducts 
}: { 
  orderId: string; 
  onClose: () => void; 
  allProducts: any[];
}) {
  const fetchDetails = useServerFn(getOrderDetails);
  const recheckStatus = useServerFn(recheckCourierStatus);
  const syncSteadfast = useServerFn(syncSteadfastStatus);
  const syncPathao = useServerFn(syncPathaoStatus);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order-details", orderId],
    queryFn: () => fetchDetails({ data: { orderId } }),
  });

  const recheckMutation = useMutation({
    mutationFn: async () => {
      const shipment = data?.shipments?.[0];
      if (!shipment) return;

      if (shipment.provider === "steadfast") {
        return syncSteadfast({ data: { shipmentId: shipment.id } });
      } else if (shipment.provider === "pathao") {
        return syncPathao({ data: { shipmentId: shipment.id } });
      }
      return recheckStatus({ data: { orderId } });
    },
    onSuccess: () => {
      toast.success("Courier status updated");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to recheck status"),
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="h-full w-full max-w-2xl bg-background p-8 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!data?.order) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="h-full w-full max-w-2xl bg-background p-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Order Not Found</h2>
            <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="surface-card p-8 text-center">
            <p className="text-muted-foreground">The requested order details could not be loaded. It might have been deleted or you may not have permission to view it.</p>
            <button onClick={onClose} className="mt-4 btn-brand px-6 py-2 rounded-lg font-bold">Close Drawer</button>
          </div>
        </div>
      </div>
    );
  }


  const { order, items, shipments, events } = data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-2xl animate-in slide-in-from-right duration-300 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold">{order.order_number}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${orderStatusTone(order.status)}`}>
                {orderStatusLabel(order.status)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-8">
          {/* Top Section: Customer & Reseller */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="surface-card p-4">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <p className="font-bold text-base text-foreground">{order.customer_name}</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="font-medium">{order.customer_phone}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Truck className="h-4 w-4 text-primary mt-1 shrink-0" />
                  <p className="leading-relaxed">{order.address_line}, <span className="font-bold text-primary uppercase text-[10px]">{order.area.replace("_", " ")}</span></p>
                </div>
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source / Reseller</h3>
              {order.resellers ? (
                <div className="space-y-2 text-sm">
                  <p className="font-bold text-foreground">{order.resellers.business_name}</p>
                  <p className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded inline-block">ID: {order.resellers.code}</p>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{order.resellers.contact_phone || "—"}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2 text-primary">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-bold">Direct Platform Sale</span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Calculation Section - More Informative */}
          <div className="surface-card overflow-hidden border-primary/20 bg-primary/[0.02]">
            <div className="border-b border-primary/10 bg-primary/5 px-4 py-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" />
                Financial Breakdown
              </h3>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdvanceChip order={order} />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                  {order.payment_method} · {order.payment_status}
                </span>
              </div>
              <OrderMoneyPanel order={order} role="admin" />
            </div>
          </div>

          {/* Items Section */}
          <div className="surface-card p-4">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ordered Products ({items.length})</h3>
            <div className="space-y-3">
              {items.map((it: any, idx: number) => {
                const p = allProducts.find(x => x.id === it.product_id);
                return (
                  <div key={idx} className="flex items-center gap-4 rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm">
                      {p?.og_image_url ? (
                        <img src={p.og_image_url} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{it.product_name}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold">Qty: {it.quantity}</span>
                        <span>৳{Number(it.reseller_price || 0).toLocaleString()} / unit</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">৳{Number(it.line_total || 0).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes Section */}
          {(order.reseller_note || order.admin_note) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {order.reseller_note && (
                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Reseller Note</span>
                  <p className="text-sm italic text-foreground/80">"{order.reseller_note}"</p>
                </div>
              )}
              {order.admin_note && (
                <div className="rounded-xl border border-primary/10 bg-primary/[0.01] p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-2">Admin Internal Note</span>
                  <p className="text-sm text-foreground/80">{order.admin_note}</p>
                </div>
              )}
            </div>
          )}

          <OrderNotes orderId={order.id} canWrite authorRole="admin" />



          {/* Courier Section - Moved to Bottom and Enhanced */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                Courier Logistics
              </h3>
              {shipments.length > 0 && (
                <button 
                  onClick={() => recheckMutation.mutate()}
                  disabled={recheckMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${recheckMutation.isPending ? "animate-spin" : ""}`} />
                  Recheck Status
                </button>
              )}
            </div>
            
            <div className="p-4">
              {shipments.length > 0 ? (
                <div className="space-y-6">
                  {shipments.map((s: any) => (
                    <div key={s.id} className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-background shadow-sm border">
                            <CourierLogo provider={s.provider} size={24} />
                          </div>
                          <div>
                            {(() => {
                              const trackUrl = courierTrackingUrl(s.provider, s, (order as any).customer_phone);
                              return trackUrl ? (
                                <a href={trackUrl} target="_blank" rel="noopener noreferrer" title="Track on courier website" className="text-sm font-bold flex items-center gap-1 text-primary hover:underline">
                                  {courierLabel(s.provider)}
                                  <ExternalLink className="h-3 w-3 opacity-70" />
                                </a>
                              ) : (
                                <span className="text-sm font-bold block">{courierLabel(s.provider)}</span>
                              );
                            })()}
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">#{s.consignment_id || s.tracking_id}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider border border-primary/20">{s.status}</span>
                          <p className="mt-1 text-[10px] text-muted-foreground">Courier: <span className="text-foreground font-medium">{s.courier_status || "Processing"}</span></p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="text-center p-2 rounded-lg bg-background/50 border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">COD Amount</span>
                          <span className="text-sm font-bold">৳{Number(s.cod_amount || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-background/50 border">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Shipping Charge</span>
                          <span className="text-sm font-bold">৳{Number(s.delivery_charge || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="space-y-3 pt-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">Status Timeline</h4>
                    <CourierTimeline events={events} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Truck className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground italic">Order not yet booked with any courier</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-wider">Booking required to start tracking</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

