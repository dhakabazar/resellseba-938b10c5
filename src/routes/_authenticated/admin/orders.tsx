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
import { Loader2, X, Download, PackageCheck, ChevronDown, Plus, MoreVertical, Eye, Phone, CheckCircle2, Settings2, Trash2, Copy, ShoppingCart, Printer } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewOrderModal } from "@/components/NewOrderModal";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { bookSteadfast } from "@/lib/couriers.functions";
import { OrderTabs } from "@/components/OrderTabs";
import { PickListModal } from "@/components/pick-list-modal";
import { OrderSearch, type OrderSearchMode } from "@/components/order-search";
import { printShippingLabels } from "@/lib/labels";
import {
  ORDER_TABS,
  ORDER_STATUS_OPTIONS,
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
  resellers: { business_name: string; code: string; contact_phone: string | null } | null;
};

type OrderItemLite = { order_id: string; product_id: string | null; product_name: string; quantity: number };

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLite[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  const [tab, setTab] = useState<OrderTabKey>("confirmed");
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [open, setOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [searchMode, setSearchMode] = useState<OrderSearchMode>("order");
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; currentStatus: string } | null>(null);
  const [resellerOptions, setResellerOptions] = useState<FilterOption[]>([]);

  async function load() {
    setLoading(true);
    const statuses = ORDER_TABS.find((t) => t.key === tab)?.statuses ?? [];
    let q = supabase
      .from("orders")
      .select("id,reseller_id,order_number,customer_name,customer_phone,address_line,area,total,status,payment_status,payment_method,forwarded_to_admin,created_at,reseller_note,admin_note,resellers(business_name,code,contact_phone)")
      .order("created_at", { ascending: false });
    if (statuses.length > 0) q = q.in("status", statuses);
    const [{ data }, { data: all }, { data: rs }, { data: p }] = await Promise.all([
      q,
      supabase.from("orders").select("status"),
      supabase.from("resellers").select("id,business_name,code,contact_phone").order("business_name"),
      supabase.from("products").select("id,name,og_image_url").eq("is_active", true),
    ]);
    const rows = (data ?? []) as OrderRow[];
    setOrders(rows);
    if (rows.length > 0) {
      const [{ data: its }, { data: s }] = await Promise.all([
        supabase.from("order_items").select("order_id,product_id,product_name,quantity").in("order_id", rows.map((r) => r.id)),
        supabase.from("shipments").select("order_id,provider,consignment_id").in("order_id", rows.map(r => r.id)),
      ]);
      setOrderItems((its ?? []) as OrderItemLite[]);
      setShipments(s ?? []);
    }
    setResellerOptions((rs ?? []).map((r: any) => ({ value: r.id, label: `${r.business_name} (/${r.code})` })));
    setResellers(rs ?? []);
    setAllProducts((p ?? []) as any[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [tab]);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItemLite[]>();
    for (const it of orderItems) {
      const arr = m.get(it.order_id);
      if (arr) arr.push(it); else m.set(it.order_id, [it]);
    }
    return m;
  }, [orderItems]);

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
        <PageHeader title="Orders" actions={
            <button onClick={() => setOpen(true)} className="btn-brand inline-flex items-center gap-2 px-4 py-2 text-sm">
                <Plus className="h-4 w-4" /> New Order
            </button>
        }/>
        <div className="mb-4 flex flex-wrap items-center gap-2">
            <OrderSearch mode={searchMode} onMode={setSearchMode} value={filters.q} onChange={(v) => setFilters({ ...filters, q: v })} />
        </div>
        <OrderTabs tab={tab} onChange={setTab} count={() => orders.length} />
        
        {loading ? <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : (
          <div className="surface-card overflow-hidden">
            <div className="hidden grid-cols-[40px_minmax(120px,1.2fr)_minmax(180px,1.5fr)_minmax(180px,1.5fr)_minmax(150px,1.2fr)_100px_120px_60px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
               <div /> <div>Order</div> <div>Customer</div> <div>Reseller</div> <div>Courier</div> <div>Total</div> <div>Status</div> <div>Actions</div>
            </div>
            {paged.map((o) => (
              <div key={o.id} className="border-b">
                <div className="hidden grid-cols-[40px_minmax(120px,1.2fr)_minmax(180px,1.5fr)_minmax(180px,1.5fr)_minmax(150px,1.2fr)_100px_120px_60px] items-center gap-4 px-4 py-3 text-sm md:grid">
                  <div className="flex justify-center">
                    <button onClick={() => setExpandedOrders(prev => prev.includes(o.id) ? prev.filter(id => id !== o.id) : [...prev, o.id])}>
                       <ChevronDown className={`h-4 w-4 transition-transform ${expandedOrders.includes(o.id) ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  <div>
                    <div className="font-medium">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div>
                     <div className="font-medium">{o.customer_name}</div>
                     <div className="text-[11px] text-muted-foreground">{o.customer_phone}</div>
                  </div>
                  <div>
                    <div className="font-medium">{o.resellers?.business_name || "Direct"}</div>
                    <div className="text-[11px] text-muted-foreground">{o.resellers?.contact_phone || ""}</div>
                  </div>
                  <div className="text-[11px]">
                     {shipments.filter(s => s.order_id === o.id).map(s => <div key={s.id}>{s.provider} (#{s.consignment_id})</div>)}
                  </div>
                  <div className="font-semibold">৳{Number(o.total).toFixed(0)}</div>
                  <div><span className={`px-2 py-0.5 rounded-full text-[11px] ${orderStatusTone(o.status)}`}>{orderStatusLabel(o.status)}</span></div>
                  <div className="flex justify-end">
                     <DropdownMenu>
                       <DropdownMenuTrigger><MoreVertical className="h-4 w-4" /></DropdownMenuTrigger>
                       <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setSelected(o)}><Eye className="mr-2 h-4 w-4"/>Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}><Settings2 className="mr-2 h-4 w-4"/>Status</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
                </div>
                {expandedOrders.includes(o.id) && <div className="p-4 bg-muted/20 border-t">Details: {o.admin_note || "No notes"}</div>}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
