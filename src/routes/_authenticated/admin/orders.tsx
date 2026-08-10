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
import { Loader2, X, Download, PackageCheck, ChevronDown, Plus, MoreVertical, Eye, Phone, CheckCircle2, Settings2, Trash2, Copy, ShoppingCart, Printer, Truck } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewOrderModal } from "@/components/NewOrderModal";
import { ShipmentBookingModal } from "@/components/ShipmentBookingModal";
import { toast } from "sonner";
import { CourierTimeline, type CourierEvent } from "@/components/CourierTimeline";
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
  const [allOrders, setAllOrders] = useState<{ status: string }[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemLite[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
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
  const [statusModal, setStatusModal] = useState<{ open: boolean; orderId: string; currentStatus: string; isBulk?: boolean } | null>(null);
  const [bookingModal, setBookingModal] = useState<{ open: boolean; orderIds: string[] }>({ open: false, orderIds: [] });
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

  async function load() {
    setLoading(true);
    const statuses = ORDER_TABS.find((t) => t.key === tab)?.statuses ?? [];
    let q = supabase
      .from("orders")
      .select("id,reseller_id,order_number,customer_name,customer_phone,address_line,area,total,status,payment_status,payment_method,forwarded_to_admin,created_at,reseller_note,admin_note,resellers(business_name,code,contact_phone)")
      .order("created_at", { ascending: false });
    if (statuses.length > 0) q = q.in("status", statuses);
    const [{ data }, { data: allStats }, { data: rs }, { data: p }] = await Promise.all([
      q,
      supabase.from("orders").select("status"),
      supabase.from("resellers").select("id,business_name,code,contact_phone").order("business_name"),
      supabase.from("products").select("id,name,og_image_url").eq("is_active", true),
    ]);
    const rows = (data ?? []) as OrderRow[];
    setOrders(rows);
    setAllOrders(allStats ?? []);
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

  async function bulkUpdateStatus(newStatus: string) {
    if (marked.length === 0) return;
    setConfirmModal({
      open: true,
      title: "Bulk Status Update",
      description: `Update ${marked.length} orders to ${orderStatusLabel(newStatus)}?`,
      variant: "warning",
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase.from("orders").update({ status: newStatus as any }).in("id", marked);
        if (error) toast.error(error.message);
        else {
          toast.success(`${marked.length} orders updated`);
          setMarked([]);
          load();
        }
        setConfirmModal(prev => ({ ...prev, open: false }));
        setLoading(false);
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
        </div>

        {marked.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
            <span className="mr-2 text-sm font-medium">{marked.length} marked</span>
            <button
              onClick={() => setStatusModal({ open: true, orderId: marked[0], currentStatus: orders.find(x => x.id === marked[0])?.status || "confirmed" })}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            >
              <Settings2 className="h-3.5 w-3.5" /> Change Status
            </button>
            <button
              onClick={() => printShippingLabels(marked)}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            >
              <Printer className="h-3.5 w-3.5" /> Print Labels
            </button>
            <button
              onClick={() => setBookingModal({ open: true, orderIds: marked })}
              className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium hover:bg-accent"
            >
              <Truck className="h-3.5 w-3.5" /> Book Courier
            </button>
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
          <div className="surface-card overflow-hidden">
            <div className="hidden grid-cols-[40px_minmax(70px,0.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_70px_90px_60px] gap-1 border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
               <div className="flex justify-center">
                 <input
                   type="checkbox"
                   className="h-4 w-4 accent-[hsl(var(--primary))]"
                   checked={marked.length > 0 && marked.length === paged.length}
                   onChange={(e) => setMarked(e.target.checked ? paged.map(x => x.id) : [])}
                 />
               </div>
               <div>Order</div> <div>Customer</div> <div>Reseller</div> <div>Courier</div> <div>Total</div> <div>Status</div> <div className="text-right">Actions</div>
            </div>
            {paged.map((o) => (
              <div key={o.id} className="border-b">
                <div className="hidden grid-cols-[40px_minmax(70px,0.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_70px_90px_60px] items-center gap-1 px-4 py-3 text-sm md:grid">
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
                  </div>
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
                  <div className="text-[11px] text-muted-foreground">
                     {shipments.filter(s => s.order_id === o.id).length > 0 ? (
                       shipments.filter(s => s.order_id === o.id).map(s => (
                         <div key={s.id} className="flex min-w-0 items-center gap-1">
                           <CourierLogo provider={s.provider} size={16} />
                           <span className="truncate">
                             {courierLabel(s.provider)} {s.consignment_id ? `#${s.consignment_id}` : ""}
                           </span>
                           {s.consignment_id && (
                             <button onClick={() => { navigator.clipboard.writeText(s.consignment_id); toast.success("Booking ID copied"); }} className="hover:text-foreground">
                               <Copy className="h-2.5 w-2.5" />
                             </button>
                           )}
                         </div>
                       ))
                     ) : (
                       <span className="text-muted-foreground/60 italic">No courier booking</span>
                     )}
                  </div>
                  <div className="font-semibold">৳{Number(o.total).toFixed(0)}</div>
                  <div><span className={`px-2 py-0.5 rounded-full text-[11px] ${orderStatusTone(o.status)}`}>{orderStatusLabel(o.status)}</span></div>
                  <div className="flex justify-end">
                     <DropdownMenu>
                       <DropdownMenuTrigger><MoreVertical className="h-4 w-4" /></DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelected(o)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatusModal({ open: true, orderId: o.id, currentStatus: o.status })}>
                            <Settings2 className="mr-2 h-4 w-4" /> Change Status
                          </DropdownMenuItem>
                          {(() => {
                            const isBooked = shipments.some(s => s.order_id === o.id && (s.consignment_id || s.tracking_id));
                            if (!isBooked) {
                              return (
                                <DropdownMenuItem onClick={() => setBookingModal({ open: true, orderIds: [o.id] })}>
                                  <Truck className="mr-2 h-4 w-4" /> Book Courier
                                </DropdownMenuItem>
                              );
                            }
                            return null;
                          })()}
                          {(() => {
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
                  <div className="bg-muted/30 px-12 py-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                      <div>
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Order Items</h4>
                        <div className="space-y-3">
                          {itemsByOrder.get(o.id)?.map((it, idx) => {
                            const p = allProducts.find(x => x.id === it.product_id);
                            return (
                              <div key={idx} className="flex items-center gap-3 rounded-lg border bg-background p-2">
                                {p?.og_image_url && (
                                  <img src={p.og_image_url} className="h-10 w-10 rounded object-cover" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium">{it.product_name}</div>
                                  <div className="text-xs text-muted-foreground">Quantity: {it.quantity}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Shipping Details</h4>
                        <div className="rounded-lg border bg-background p-4 text-sm shadow-sm">
                          <div className="mb-1 font-semibold">{o.customer_name}</div>
                          <div className="mb-3 font-mono text-xs">{o.customer_phone}</div>
                          <div className="text-muted-foreground">{o.address_line}</div>
                          <div className="mt-1 font-medium text-primary uppercase text-[10px]">{o.area.replace("_", " ")}</div>
                        </div>
                      </div>
                      <div>
                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes & Financials</h4>
                        <div className="space-y-3">
                          {o.admin_note && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                              <span className="mb-1 block text-[10px] font-bold uppercase">Admin Note:</span>
                              {o.admin_note}
                            </div>
                          )}
                          {o.reseller_note && (
                            <div className="rounded-lg border bg-background p-3 text-sm italic text-muted-foreground">
                              <span className="mb-1 block text-[10px] font-bold uppercase not-italic">Reseller Note:</span>
                              "{o.reseller_note}"
                            </div>
                          )}
                          <div className="rounded-lg border bg-background p-3 text-sm">
                             <div className="flex justify-between font-bold">
                               <span>Total Bill</span>
                               <span className="text-primary">৳{Number(o.total).toFixed(0)}</span>
                             </div>
                             <div className="mt-1 flex justify-between text-xs text-muted-foreground uppercase">
                               <span>Payment Method</span>
                               <span>{o.payment_method}</span>
                             </div>
                          </div>
                        </div>
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
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200 sm:max-w-md">
              <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/30">
                <h3 className="text-sm font-bold text-foreground">Change Status</h3>
                <button onClick={() => setStatusModal(null)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 gap-1.5">
                  {ORDER_STATUS_OPTIONS.map((s) => (
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
        <ShipmentBookingModal
          isOpen={bookingModal.open}
          onClose={() => setBookingModal({ open: false, orderIds: [] })}
          orderIds={bookingModal.orderIds}
          onSuccess={() => {
            setMarked([]);
            load();
          }}
        />

        {selected && (
          <OrderDrawer
            order={selected}
            onClose={() => setSelected(null)}
            items={itemsByOrder.get(selected.id) || []}
            shipments={shipments.filter(s => s.order_id === selected.id)}
            events={[]} // We should fetch events if needed
            allProducts={allProducts}
          />
        )}
    </div>
  );
}

function OrderDrawer({ 
  order, 
  onClose, 
  items, 
  shipments,
  events,
  allProducts 
}: { 
  order: OrderRow; 
  onClose: () => void; 
  items: OrderItemLite[]; 
  shipments: any[];
  events: any[];
  allProducts: any[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-background p-6 shadow-2xl animate-in slide-in-from-right duration-300 sm:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{order.order_number}</h2>
            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="surface-card p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Customer Info</h3>
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-base">{order.customer_name}</p>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{order.customer_phone}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Truck className="h-4 w-4 text-primary mt-1" />
                  <p>{order.address_line}, {order.area}</p>
                </div>
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Reseller Info</h3>
              {order.resellers ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">{order.resellers.business_name}</p>
                  <p className="text-muted-foreground">Code: {order.resellers.code}</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{order.resellers.contact_phone || "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Direct Sale</p>
              )}
            </div>

            <div className="surface-card p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Internal Notes</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Reseller Note</p>
                  <p className="mt-1 italic">{order.reseller_note || "No note"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Admin Note</p>
                  <p className="mt-1">{order.admin_note || "No note"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Order Items</h3>
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const p = allProducts.find(x => x.id === it.product_id);
                  return (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border bg-background/50 p-2">
                      {p?.og_image_url && <img src={p.og_image_url} className="h-12 w-12 rounded object-cover shadow-sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{it.product_name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="surface-card p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Courier Info</h3>
              {shipments.length > 0 ? (
                <div className="space-y-4">
                  {shipments.map(s => (
                    <div key={s.id} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase text-primary">{s.provider}</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary capitalize">{s.status}</span>
                      </div>
                      <div className="text-sm font-mono tracking-wider">#{s.consignment_id || s.tracking_id}</div>
                      <div className="mt-2 text-[10px] text-muted-foreground">Courier Status: {s.courier_status || "—"}</div>
                    </div>
                  ))}
                  <CourierTimeline events={events} />
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground italic">
                  Not booked yet
                </div>
              )}
            </div>

            <div className="surface-card bg-primary/5 border-primary/20 p-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span className="text-primary">৳{Number(order.total).toFixed(0)}</span>
              </div>
              <p className="text-right text-xs text-muted-foreground mt-1 capitalize">{order.payment_method} · {order.payment_status}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
