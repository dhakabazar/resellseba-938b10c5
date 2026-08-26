import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResellerTotalCell } from "@/components/order-total-cell";
import { getMyReseller } from "@/lib/app-data";
import { productDeliveryCharge, deliveryLabel } from "@/lib/delivery";
import { addressError, nameError, normalizePhone, phoneError, sanitizeName } from "@/lib/checkout-validate";
import { OrderNotes } from "@/components/order-notes";
import { LastUpdateCell, OrderNotePreview, OrderNotesModal, useOrderMeta } from "@/components/order-last-update";
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
  RefreshCw,
  TrendingUp,
  DollarSign,
  Wallet,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NewOrderModal } from "@/components/NewOrderModal";
import { OrderEditModal } from "@/components/OrderEditModal";
import { type StripItem, ImageLightbox, OrderItemsList, OrderProductCell } from "@/components/order-items-strip";
import { Pencil, ExternalLink } from "lucide-react";
import { courierTrackingUrl } from "@/lib/courier-tracking";
import { toast } from "sonner";
import { useDepositStatus } from "@/lib/deposit";
import { DEFAULT_DEPOSIT_TEXTS, fillText, useDepositSettings } from "@/lib/deposit-settings";
import { bdt, orderProfit, orderReceived, orderShortfall } from "@/lib/finance-report";
import { OrderMoneyPanel, AdvanceChip } from "@/components/order-money";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getOrderDetails, recheckCourierStatus } from "@/lib/order-details.functions";
import { syncSteadfastStatus, syncPathaoStatus } from "@/lib/couriers.functions";

import { CourierTimeline, type CourierEvent } from "@/components/CourierTimeline";
import { OrderTabs } from "@/components/OrderTabs";
import { PickListModal } from "@/components/pick-list-modal";
import { OrderSearch, type OrderSearchMode } from "@/components/order-search";
import { Pagination, usePaginated } from "@/components/data-list";
import {
  OrderFilterBar,
  applyOrderFilters,
  filterByCourier,
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
  nextStatuses,
  resellerCanAct,
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
  sa_cost_total: number;
  payment_method: string;
  status: string;
  payment_status: string;
  forwarded_to_admin: boolean;
  notes: string | null;
  reseller_note: string | null;
  created_at: string;
  received_amount?: number | null;
  packaging_total?: number | null;
  delivery_cost?: number | null;
  advance_amount?: number | null;
  advance_by?: string | null;
};

type Line = { listing_id?: string; product_id?: string; qty: number; name?: string; price?: number; cost?: number; image?: string; delivery?: any };

export const Route = createFileRoute("/_authenticated/reseller/orders")({
  validateSearch: (s: Record<string, unknown>): { tab?: OrderTabKey; q?: string } => ({
    tab: ORDER_TABS.some((t) => t.key === s.tab) ? (s.tab as OrderTabKey) : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),

  component: OrdersPage,
});

const ORDER_COLUMNS =
  "id,order_number,customer_name,customer_phone,address_line,city,area,subtotal,shipping_cost,discount,total,sa_cost_total,reseller_profit,received_amount,packaging_total,delivery_cost,advance_amount,advance_by,payment_method,status,payment_status,forwarded_to_admin,notes,reseller_note,created_at";

type OrderItemLite = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  reseller_price: number | null;
  line_total: number | null;
};

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
          orderProfit(o).toFixed(0),
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
  const { tab: tabParam, q: qParam } = Route.useSearch();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLite[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<OrderTabKey>(tabParam ?? (qParam ? "all" : "new"));
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [filters, setFilters] = useState<OrderFilterState>({ ...DEFAULT_ORDER_FILTERS, q: qParam ?? "" });

  const [searchMode, setSearchMode] = useState<OrderSearchMode>("order");
  const [showFilters, setShowFilters] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickScope, setPickScope] = useState<"filtered" | "marked">("filtered");
  const [marked, setMarked] = useState<string[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; currentStatus: string; isBulk?: boolean } | null>(null);
  const { status: deposit } = useDepositStatus(resellerId);
  const { texts: depositTexts } = useDepositSettings();
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


  async function load(opts?: { silent?: boolean }) {
    if (!user) return;
    if (!opts?.silent) setLoading(true);
    const r = await getMyReseller(user.id);
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
        .select("id,selling_price,products(id,brand_id,category_id,name,product_code,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url)")
        .eq("reseller_id", r.id)
        .eq("is_active", true),
      supabase
        .from("products")
        .select("id,brand_id,category_id,name,slug,product_code,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url,suggested_price")
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
          .select("order_id,product_id,product_name,product_image,quantity,reseller_price,line_total")
          .in("order_id", rows.map((x) => x.id)),
        supabase
          .from("shipments")
          .select("id,order_id,provider,tracking_id,consignment_id,status,courier_status,last_event_at")
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
    if (!opts?.silent) setLoading(false);
  }

  // Refresh only the touched rows so the current page/filters stay put.
  async function syncOrders(ids: string[]) {
    const list = ids.filter(Boolean);
    if (list.length === 0) return;
    const statuses = (ORDER_TABS.find((t) => t.key === tab)?.statuses ?? []) as string[];
    const inTab = (st: string) => statuses.length === 0 || statuses.includes(st);
    const [{ data: rows }, { data: its }, { data: sh }, { data: ev }] = await Promise.all([
      supabase.from("orders").select(ORDER_COLUMNS).in("id", list),
      supabase
        .from("order_items")
        .select("order_id,product_id,product_name,product_image,quantity,reseller_price,line_total")
        .in("order_id", list),
      supabase
        .from("shipments")
        .select("id,order_id,provider,tracking_id,consignment_id,status,courier_status,last_event_at")
        .in("order_id", list),
      supabase
        .from("courier_events")
        .select("order_id,provider,courier_status,note,event_at")
        .in("order_id", list),
    ]);
    const fetched = ((rows ?? []) as unknown) as OrderRow[];
    setOrders((prev) => {
      let next = prev
        .map((x) => fetched.find((f) => f.id === x.id) ?? x)
        .filter((x) => !list.includes(x.id) || inTab(x.status));
      for (const f of fetched) {
        if (!next.some((x) => x.id === f.id) && inTab(f.status)) next = [f, ...next];
      }
      return next;
    });
    setOrderItems((prev) => [...prev.filter((i) => !list.includes(i.order_id)), ...((its ?? []) as OrderItemLite[])]);
    setShipments((prev) => [...prev.filter((x: any) => !list.includes(x.order_id)), ...((sh ?? []) as any[])]);
    setEvents((prev) => [...prev.filter((x: any) => !list.includes(x.order_id)), ...((ev ?? []) as any[])]);
  }

  function dropOrders(ids: string[]) {
    setOrders((prev) => prev.filter((x) => !ids.includes(x.id)));
    setOrderItems((prev) => prev.filter((i) => !ids.includes(i.order_id)));
    setShipments((prev) => prev.filter((x: any) => !ids.includes(x.order_id)));
    setEvents((prev) => prev.filter((x: any) => !ids.includes(x.order_id)));
    setMarked((prev) => prev.filter((id) => !ids.includes(id)));
    setExpandedOrders((prev) => prev.filter((id) => !ids.includes(id)));
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
  const { meta: orderMeta, refresh: refreshMeta } = useOrderMeta(paged.map((o: any) => o.id));
  const [notesModal, setNotesModal] = useState<{ orderId: string; orderNumber?: string | null; canWrite: boolean } | null>(null);
  const stats = useMemo(
    () =>
      visible.reduce(
        (a, o) => ({
          count: a.count + 1,
          total: a.total + (Number(o.total) || 0),
          shipping: a.shipping + (Number(o.shipping_cost) || 0),
          profit: a.profit + orderProfit(o),
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

    const blocked = visible.filter(
      (o) => marked.includes(o.id) && !(nextStatuses(o.status, "reseller") as string[]).includes(newStatus),
    );
    if (blocked.length > 0) {
      toast.error(
        `${blocked.length} orders cannot move to this status — only New Order, Send To admin and Cancelled can be switched.`,
      );
      return;
    }

    setConfirmModal({
      open: true,
      title: "Bulk Status Update",
      description: `Are you sure you want to update ${marked.length} orders to ${newStatus}?`,
      variant: "warning",
      onConfirm: async () => {
        setBusy(true);
        const targetIds = [...marked];
        const { error } = await supabase
          .from("orders")
          .update({ status: newStatus as any })
          .in("id", targetIds);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`${targetIds.length} orders updated successfully`);
          setMarked([]);
          await syncOrders(targetIds);
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setBusy(false);
      }
    });
  };


  const bulkDeleteOrders = async () => {
    if (marked.length === 0) return;
    
    // Check if any order is NOT pending/confirmed or is booked
    const bookedIds = shipments.filter(s => s.consignment_id || s.tracking_id).map(s => s.order_id);
    const restricted = visible.filter(o => marked.includes(o.id) && (!resellerCanAct(o.status) || bookedIds.includes(o.id)));
    
    if (restricted.length > 0) {
      toast.error(`${restricted.length} orders cannot be deleted (only Pending orders that are not booked).`);
      return;
    }

    setConfirmModal({
      open: true,
      title: "Delete Orders",
      description: `Delete ${marked.length} selected orders? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setBusy(true);
        const { data: gone, error } = await supabase
          .from("orders")
          .delete()
          .in("id", marked)
          .select("id");

        if (error) {
          toast.error(error.message);
        } else if (!gone || gone.length === 0) {
          toast.error("Delete failed: you do not have permission to delete these orders.");
        } else {
          if (gone.length < marked.length) {
            toast.warning(`${gone.length} of ${marked.length} orders deleted, the rest were not permitted.`);
          } else {
            toast.success(`${gone.length} orders deleted`);
          }
          dropOrders(gone.map((g: any) => g.id));
        }

        setConfirmModal(prev => ({ ...prev, open: false }));
        setBusy(false);
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
    if (!resellerCanAct(order.status) || isBooked) {
      toast.error("Only New Order, Send To admin or Cancelled orders can be deleted.");
      return;
    }

    setConfirmModal({
      open: true,
      title: "Delete Order",
      description: "Are you sure you want to delete this order? This action cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        setBusy(true);
        const { data: gone, error } = await supabase
          .from("orders")
          .delete()
          .eq("id", id)
          .select("id");
        if (error) toast.error(error.message);
        else if (!gone || gone.length === 0) {
          toast.error("Delete failed: you do not have permission to delete this order.");
        } else {
          toast.success("Order deleted");
          dropOrders([id]);
        }

        setConfirmModal(prev => ({ ...prev, open: false }));
        setBusy(false);
      }
    });
  }



  return (
    <div>
      <PageHeader
        title="Orders"
        className="flex-row items-center justify-between"
        description=""
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv(visible)}
              disabled={visible.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-2 text-xs disabled:opacity-50 sm:px-3 sm:text-sm"
            >
              <Download className="h-4 w-4" /> <span className="hidden xs:inline">Export</span>
            </button>
            <button
              onClick={() => setOpen(true)}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap"
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
        <div className="space-y-3">
          <div className="hidden grid-cols-[38px_minmax(60px,0.7fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(100px,1.2fr)_124px_minmax(112px,0.9fr)] items-start gap-2 rounded-lg border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
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
            <div className="text-center">Order</div>
            <div className="text-center">Products</div>
            <div className="text-center">Customer</div>
            <div className="text-center">Reseller total</div>
            <div className="text-center">Status</div>
            <div className="text-center">Last update</div>
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

                        {resellerCanAct(o.status) && (
                          <DropdownMenuItem onClick={() => setEditId(o.id)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Order
                          </DropdownMenuItem>
                        )}
                        {(() => {
                          const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                          if (!isBooked && resellerCanAct(o.status) && nextStatuses(o.status, "reseller").length > 0) {
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
                        {resellerCanAct(o.status) && !shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id)) && (
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
                className={`overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md ${isMarked ? "border-primary ring-1 ring-primary/30" : ""}`}
              >
                {/* Mobile card */}


                <div className="space-y-2.5 p-3 md:hidden">
                  {/* Header: checkbox + order + status + actions + chevron */}
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                      checked={isMarked}
                      onChange={(e) => mark(e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold tracking-tight">#{o.order_number}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground tabular-nums">
                        {new Date(o.created_at).toLocaleString([], {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {(() => {
                      const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                      const canChange = !isBooked && resellerCanAct(o.status) && nextStatuses(o.status, "reseller").length > 0;
                      const cls = `shrink-0 rounded-full px-2 py-0.5 text-[11px] capitalize ${orderStatusTone(o.status)}`;
                      return canChange ? (
                        <button
                          type="button"
                          title="Change status"
                          onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}
                          className={`${cls} transition-shadow hover:ring-2 hover:ring-primary/30`}
                        >
                          {orderStatusLabel(o.status)}
                        </button>
                      ) : (
                        <span className={cls}>{orderStatusLabel(o.status)}</span>
                      );
                    })()}
                    <div className="shrink-0">{actions}</div>
                    <button
                      onClick={() => setExpandedOrders(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
                      className="shrink-0 rounded-full p-1 transition-colors hover:bg-muted"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedOrders.includes(o.id) ? "rotate-180" : ""}`} />
                    </button>
                  </div>

                  {/* Customer + Payment — always 2 columns */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Customer</div>
                      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                        <span className="truncate">{o.customer_name}</span>
                        <a href={`tel:${o.customer_phone}`} className="shrink-0 text-primary transition-colors hover:text-primary/80">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(o.customer_phone); toast.success("Phone number copied"); }}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{o.customer_phone}</div>
                      <div className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                        {o.address_line}
                        {o.area ? `, ${o.area.replace("_", " ")}` : ""}
                        {o.city ? `, ${o.city}` : ""}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1 border-l pl-2">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Payment</div>
                      <div className="flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="rounded border px-1.5 py-0.5 uppercase text-muted-foreground">{o.payment_method}</span>
                        {o.status === "forwarded" && o.forwarded_to_admin && (
                          <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">Sent to admin</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Products — with images + more option (same as desktop) */}
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Products</div>
                    <OrderProductCell
                      items={stripItems(o.id)}
                      expanded={expandedOrders.includes(o.id)}
                      onZoom={setZoomImage}
                      onToggle={() => setExpandedOrders(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
                    />
                  </div>

                  {/* Courier + Last update — 2 columns */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Courier</div>
                      {shipments.some(s => s.order_id === o.id) ? (
                        <div className="flex flex-wrap gap-1">
                          {shipments.filter(s => s.order_id === o.id).map(s => (
                            <div key={s.id} className="inline-flex max-w-full items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-muted-foreground/10">
                              <CourierLogo provider={s.provider} size={12} />
                              {(() => {
                                const u = courierTrackingUrl(s.provider, s, (o as any).customer_phone);
                                return u ? (
                                  <a href={u} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Track on courier website" className="inline-flex items-center gap-0.5 font-bold text-primary hover:underline">
                                    {courierLabel(s.provider)}
                                    <ExternalLink className="h-2 w-2" />
                                  </a>
                                ) : (
                                  <span>{courierLabel(s.provider)}</span>
                                );
                              })()}
                              {s.consignment_id && (
                                <>
                                  <span className="truncate opacity-70">#{s.consignment_id}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(s.consignment_id || ""); toast.success("Booking ID copied"); }}
                                    className="ml-0.5 shrink-0 opacity-50 hover:opacity-100"
                                  >
                                    <Copy className="h-2.5 w-2.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] italic text-muted-foreground/60">Not booked yet</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5 border-l pl-2">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Last update</div>
                      <LastUpdateCell
                        meta={orderMeta[o.id]}
                        fallbackAt={o.created_at}
                        hideNote
                        onOpenNotes={() =>
                          setNotesModal({ orderId: o.id, orderNumber: o.order_number, canWrite: resellerCanAct(o.status) })
                        }
                      />
                    </div>
                  </div>

                  {/* Money */}
                  <ResellerTotalCell order={o as any} />

                  {/* Note — full width */}
                  <div className="space-y-0.5 border-t pt-2">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Note</div>
                    <OrderNotePreview
                      meta={orderMeta[o.id]}
                      align="left"
                      onOpenNotes={() =>
                        setNotesModal({ orderId: o.id, orderNumber: o.order_number, canWrite: resellerCanAct(o.status) })
                      }
                    />
                  </div>
                </div>


                {/* Desktop row */}
                <div className="hidden grid-cols-[38px_minmax(60px,0.7fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(100px,1.2fr)_124px_minmax(112px,0.9fr)] items-start gap-2 border-b bg-muted/30 px-4 py-3 text-sm md:grid">
                  <div className="flex flex-col items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={isMarked}
                      onChange={(e) => mark(e.target.checked)}
                    />
                    {actions}
                    <button
                      onClick={() => setExpandedOrders(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}
                      className="rounded-full p-1 hover:bg-muted transition-colors shrink-0"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedOrders.includes(o.id) ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  <div className="min-w-0 text-center">
                    <div className="font-medium truncate">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 tabular-nums">
                      {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <OrderProductCell
                      items={stripItems(o.id)}
                      expanded={expandedOrders.includes(o.id)}
                      onZoom={(src) => setZoomImage(src)}
                      onToggle={() =>
                        setExpandedOrders((prev) =>
                          prev.includes(o.id) ? prev.filter((id) => id !== o.id) : [...prev, o.id],
                        )
                      }
                    />

                  </div>

                  <div className="min-w-0 text-center text-xs text-muted-foreground">
                    <div className="font-medium text-foreground truncate">{o.customer_name}</div>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
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
                    <div className="mt-0.5 text-center text-[11px] leading-snug text-muted-foreground">
                      <span className="line-clamp-2">
                        {o.address_line}
                        {o.area ? `, ${o.area.replace("_", " ")}` : ""}
                        {o.city ? `, ${o.city}` : ""}
                      </span>
                    </div>
                  </div>
                   
                    <div className="flex justify-center"><ResellerTotalCell order={o as any} /></div>
                    <div className="min-w-0 text-center">
                      {(() => {
                        const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                        const canChange = !isBooked && resellerCanAct(o.status) && nextStatuses(o.status, "reseller").length > 0;
                        const cls = `inline-block rounded-full px-2 py-0.5 text-[11px] capitalize whitespace-nowrap ${orderStatusTone(o.status)}`;
                        return canChange ? (
                          <button
                            type="button"
                            title="Change status"
                            onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}
                            className={`${cls} transition-shadow hover:ring-2 hover:ring-primary/30`}
                          >
                            {orderStatusLabel(o.status)}
                          </button>
                        ) : (
                          <span className={cls}>{orderStatusLabel(o.status)}</span>
                        );
                      })()}
                      {o.status === "forwarded" && o.forwarded_to_admin && (
                        <div className="mt-0.5 text-[9px] text-success font-medium">
                          Sent to admin
                        </div>
                      )}
                      {orderShipment ? (
                        <div className="mt-1 flex flex-col items-center gap-0.5 min-w-0">
                          {(() => {
                            const u = courierTrackingUrl(orderShipment.provider, orderShipment, (o as any).customer_phone);
                            const inner = (
                              <>
                                <CourierLogo provider={orderShipment.provider} size={12} />
                                <span className="truncate">{courierLabel(orderShipment.provider)}</span>
                                {u && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />}
                              </>
                            );
                            return u ? (
                              <a href={u} target="_blank" rel="noopener noreferrer" title="Track on courier website" className="flex items-center justify-center gap-1 text-[10px] font-bold text-primary leading-tight hover:underline">{inner}</a>
                            ) : (
                              <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-primary leading-tight">{inner}</div>
                            );
                          })()}
                          <div className="text-[10px] text-muted-foreground tabular-nums font-medium flex items-center justify-center gap-1">
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
                        <span className="mt-1 inline-block text-[10px] italic text-muted-foreground/60">Not booked yet</span>
                      )}
                    </div>
                   <LastUpdateCell
                     meta={orderMeta[o.id]}
                     fallbackAt={o.created_at}
                     onOpenNotes={() =>
                       setNotesModal({ orderId: o.id, orderNumber: o.order_number, canWrite: resellerCanAct(o.status) })
                     }
                   />
                   
                </div>

                {/* Collapsible content section */}
                {expandedOrders.includes(o.id) && (
                  <div className="border-t bg-muted/20 px-4 py-4 animate-in slide-in-from-top-2 duration-200">
                    <OrderItemsList items={stripItems(o.id)} onZoom={setZoomImage} className="mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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

                        <OrderMoneyPanel order={o} role="reseller" />
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
          orderId={selected.id}
          onClose={() => setSelected(null)}
          onChanged={() => {
            const id = selected.id;
            setSelected(null);
            void syncOrders([id]);
          }}
          allProducts={allProducts}
          depositBlocked={deposit.blocked}
          depositDue={deposit.due}
          depositBlockText={depositTexts.orderBlockToast}
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
            void load({ silent: true });
          }}
        />
      )}

      {editId && (
        <OrderEditModal
          orderId={editId}
          allProducts={allProducts}
          onClose={() => setEditId(null)}
          onSaved={() => {
            const id = editId;
            setEditId(null);
            if (id) void syncOrders([id]);
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
                {(nextStatuses(statusModal.currentStatus, "reseller") as string[]).map((s) => (
                  <button
                    key={s}
                    disabled={loading || busy}
                    onClick={async () => {
                      if (s === "forwarded" && deposit.blocked) {
                        toast.error(fillText(depositTexts.orderBlockToast, { due: deposit.due, required: deposit.requiredAmount, balance: deposit.balance, frozen: deposit.frozenAmount }));
                        return;
                      }
                      if (statusModal.isBulk) {
                        await bulkUpdateStatus(s);
                        setStatusModal(null);
                        return;
                      }
                      setBusy(true);
                      const targetId = statusModal.orderId;
                      const { error } = await supabase
                        .from("orders")
                        .update({ status: s as any })
                        .eq("id", targetId);

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
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        variant={confirmModal.variant}
        isLoading={loading}
      />

      {zoomImage && <ImageLightbox src={zoomImage} onClose={() => setZoomImage(null)} />}

      {notesModal && (
        <OrderNotesModal
          orderId={notesModal.orderId}
          orderNumber={notesModal.orderNumber}
          authorRole="reseller"
          canWrite={notesModal.canWrite}
          lockedHint="Notes can only be added or edited while the order is New Order, Send To admin or Cancelled."
          onClose={() => {
            const id = notesModal.orderId;
            setNotesModal(null);
            void refreshMeta([id]);
          }}
        />
      )}
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
  orderId, 
  onClose,
  onChanged,
  allProducts,
  depositBlocked,
  depositDue,
  depositBlockText,
}: { 
  orderId: string; 
  onClose: () => void; 
  onChanged: () => void;
  allProducts: any[];
  depositBlocked?: boolean;
  depositDue?: number;
  depositBlockText?: string;
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

  const [busy, setBusy] = useState(false);

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
      onChanged();
    },
    onError: (err: any) => toast.error(err.message || "Failed to recheck status"),
  });

  async function setStatus(next: "pending" | "forwarded" | "cancelled") {
    if (next === "forwarded" && depositBlocked) {
      toast.error(fillText(depositBlockText ?? DEFAULT_DEPOSIT_TEXTS.orderBlockToast, { due: depositDue ?? 0 }));
      return;
    }
    setBusy(true);
    const patch: Record<string, unknown> =
      next === "forwarded"
        ? { status: "forwarded", forwarded_to_admin: true, forwarded_at: new Date().toISOString() }
        : next === "pending"
          ? { status: "pending", forwarded_to_admin: false, forwarded_at: null }
          : { status: "cancelled" };
    const { error } = await supabase.from("orders").update(patch as any).eq("id", orderId);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await supabase.from("order_status_history").insert({ order_id: orderId, status: next as any });
    toast.success(
      next === "forwarded" ? "Order sent to admin" : next === "pending" ? "Order moved to New Order" : "Order cancelled",
    );
    setBusy(false);
    onChanged();
    refetch();
  }

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
  const profit = orderProfit(order);
  
  // Reseller may only move between New Order · Send To admin · Cancelled
  const allowedNext = nextStatuses(order.status, "reseller") as string[];
  const canAct = allowedNext.length > 0;

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
          {canAct && (
            <div className="flex gap-3 surface-card p-4 border-primary/20 bg-primary/5">
              {allowedNext.includes("pending") && (
                <button
                  disabled={busy}
                  onClick={() => setStatus("pending")}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-bold shadow-sm transition-all hover:bg-muted disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Move to New Order
                </button>
              )}
              {allowedNext.includes("forwarded") && (
                <button
                  disabled={busy}
                  onClick={() => setStatus("forwarded")}
                  className="btn-brand inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Send to admin
                </button>
              )}
              {allowedNext.includes("cancelled") && (
                <button
                  disabled={busy}
                  onClick={() => setStatus("cancelled")}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-background px-4 py-2.5 text-sm font-bold text-destructive shadow-sm hover:bg-destructive/5 transition-all disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" /> Cancel Order
                </button>
              )}
            </div>
          )}


          {/* Top Section: Customer */}
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
                  <p className="leading-relaxed">{order.address_line}, <span className="font-bold text-primary uppercase text-[10px]">{String(order.area || "").replace("_", " ")}</span></p>
                </div>
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Order Meta</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-muted-foreground">Payment Mode</span>
                   <span className="font-bold uppercase text-[10px] bg-muted px-2 py-0.5 rounded">{order.payment_method}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-muted-foreground">Payment Status</span>
                   <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{order.payment_status}</span>
                </div>
                {order.forwarded_at && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Sent to Admin</span>
                    <span className="text-[10px] font-medium">{new Date(order.forwarded_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reseller Calculation Section */}
          <div className="surface-card overflow-hidden border-amber-200 bg-amber-50/30">
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-700 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Earnings Summary
              </h3>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdvanceChip order={order} />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                  {order.payment_method} · {order.payment_status}
                </span>
              </div>
              <OrderMoneyPanel order={order} role="reseller" />
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
                      <p className="text-[10px] font-bold text-green-600">Profit: ৳{Number(it.profit || 0).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes Section */}
          {(order.reseller_note || order.notes) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {order.notes && (
                <div className="rounded-xl border bg-muted/10 p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Customer Note</span>
                  <p className="text-sm italic text-foreground/80">"{order.notes}"</p>
                </div>
              )}
              {order.reseller_note && (
                <div className="rounded-xl border border-primary/10 bg-primary/[0.01] p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-2">Your Internal Note</span>
                  <p className="text-sm text-foreground/80">{order.reseller_note}</p>
                </div>
              )}
            </div>
          )}

          <OrderNotes
            orderId={order.id}
            canWrite={resellerCanAct(order.status)}
            authorRole="reseller"
            lockedHint="Notes can only be added or edited while the order is New Order, Send To admin or Cancelled."
          />



          {/* Courier Section - Moved to Bottom */}
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Truck className="h-3.5 w-3.5" />
                Delivery Information
              </h3>
              {shipments.length > 0 && (
                <button 
                  onClick={() => recheckMutation.mutate()}
                  disabled={recheckMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-[10px] font-bold text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${recheckMutation.isPending ? "animate-spin" : ""}`} />
                  Check Updates
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
                          <p className="mt-1 text-[10px] text-muted-foreground">Courier: <span className="text-foreground font-medium">{courierStatusLabel(s.courier_status, s.provider)}</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="space-y-3 pt-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">Status History</h4>
                    <CourierTimeline events={events} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Truck className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground italic">Awaiting admin booking</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-wider">Tracking starts after courier pickup</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

