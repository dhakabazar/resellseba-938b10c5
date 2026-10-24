import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  OrderFilterBar,
  filterByCourier,
  DEFAULT_ORDER_FILTERS,
  resolveDateRange,
  type OrderFilterState,
} from "@/components/order-filters";
import { ReportCard, ReportTabs, SortTh, toneOf } from "@/components/report-blocks";
import { Pagination, usePaginated } from "@/components/data-list";
import { ResellerAvatar } from "@/components/reseller-avatar";
import { bdt, toCsv, downloadCsv, orderMargin, orderProfit, orderReceived } from "@/lib/finance-report";
import { agentCommissionFor, commissionMode, isCommissionOrder, AGENT_COMMISSION_HINT } from "@/lib/agents";
import {
  ADMIN_PROFIT_HINT,
  buildCourierRows,
  buildPnL,
  buildProductRows,
  withKeptCost,
  buildResellerRows,
  orderBuyingCost,
  sortRows,
  type BizItem,
  type BizOrder,
  type BizProduct,
  type CourierRow,
  type Expense,
  type ProductRow,
  type ResellerRow,
  type SortDir,
} from "@/lib/business-report";
import { fetchAllSafe } from "@/lib/fetch-all";
import {
  Loader2,
  Download,
  Wallet,
  Boxes,
  TrendingUp,
  Receipt,
  Package,
  Users,
  Truck,
  Target,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/business-report")({
  component: BusinessReportPage,
  head: () => ({
    meta: [
      { title: "Business Report — Admin" },
      {
        name: "description",
        content: "Product sale report, reseller sales, courier performance, agent targets, and admin profit & loss.",
      },
      { property: "og:title", content: "Business Report — Admin" },
      {
        property: "og:description",
        content: "Comprehensive business reports: products, resellers, couriers, agents, profit & loss.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "products" | "resellers" | "couriers" | "agents" | "pnl";

const TABS: { key: Tab; label: string; hint?: string }[] = [
  { key: "products", label: "Most selling products" },
  { key: "resellers", label: "Reseller report" },
  { key: "couriers", label: "Courier report" },
  { key: "agents", label: "Agent report" },
  { key: "pnl", label: "Profit & loss" },
];

type Agent = {
  id: string;
  display_name: string;
  sale_target: number | string;
  commission_rate: number | string;
  commission_mode?: string | null;
  commission_per_unit?: number | string | null;
  is_active: boolean;
};

type ResellerLite = {
  id: string;
  business_name: string;
  code: string;
  agent_id: string | null;
  avatar_url?: string | null;
  status?: string | null;
};

type AgentRow = {
  key: string;
  name: string;
  resellers: number;
  orders: number;
  sales: number;
  target: number;
  achieved: number;
  rate: number;
  rateLabel: string;
  commission: number;
  adminProfit: number;
  netAdminProfit: number;
};

const DEFAULT_REPORT_FILTERS: OrderFilterState = {
  ...DEFAULT_ORDER_FILTERS,
  datePreset: "this_month",
};

const th = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function BusinessReportPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<BizOrder[]>([]);
  const [items, setItems] = useState<BizItem[]>([]);
  const [products, setProducts] = useState<BizProduct[]>([]);
  const [shipments, setShipments] = useState<{ order_id: string; provider: string; cost: number | null }[]>([]);
  const [resellers, setResellers] = useState<ResellerLite[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_REPORT_FILTERS);
  const [tab, setTab] = useState<Tab>("products");
  const [page, setPage] = useState(1);

  const [prodSort, setProdSort] = useState<{ key: keyof ProductRow; dir: SortDir }>({ key: "saleQty", dir: "desc" });
  const [resSort, setResSort] = useState<{ key: keyof ResellerRow; dir: SortDir }>({ key: "orders", dir: "desc" });
  const [couSort, setCouSort] = useState<{ key: keyof CourierRow; dir: SortDir }>({ key: "parcels", dir: "desc" });
  const [agtSort, setAgtSort] = useState<{ key: keyof AgentRow; dir: SortDir }>({ key: "sales", dir: "desc" });

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Embed order_items and shipments directly inside orders query and fetch
      // metadata (products, resellers, agents, expenses) in parallel.
      // This loads all data in 1-2 rapid network rounds without 1000-row limit.
      const [oData, pData, rData, aData, eData] = await Promise.all([
        fetchAllSafe<BizOrder>(() =>
          supabase
            .from("orders")
            .select(
              "id,order_number,reseller_id,status,created_at,customer_name,customer_phone,address_line,area,subtotal,shipping_cost,total,sa_cost_total,reseller_profit,received_amount,packaging_total,delivery_cost,advance_amount,advance_by,is_exchange,exchange_admin_share,exchange_admin_buy,rider_status,resellers(business_name,code),shipments(id,order_id,provider,cost,tracking_id,consignment_id,status),order_items(id,order_id,product_id,product_name,quantity,returned_qty,sa_price,line_total,profit,buying_price,packaging_cost)",
            )
            .order("created_at", { ascending: false })
            .order("id")
        ),
        fetchAllSafe<BizProduct>(() =>
          supabase.from("products").select("id,name,product_code,buying_price,packaging_cost,og_image_url").order("id")
        ),
        fetchAllSafe<ResellerLite>(() =>
          supabase.from("resellers").select("id,business_name,code,agent_id,avatar_url,status").order("id")
        ),
        fetchAllSafe<Agent>(() =>
          supabase
            .from("agents")
            .select("id,display_name,sale_target,commission_rate,commission_mode,commission_per_unit,is_active")
            .order("id")
        ),
        fetchAllSafe<Expense>(() =>
          supabase.from("expenses").select("*").order("spent_on", { ascending: false }).order("id")
        ),
      ]);

      const itData: BizItem[] = [];
      const sData: { id?: string; order_id: string; provider: string; cost: number | null; tracking_id?: string | null; consignment_id?: string | null; status?: string | null }[] = [];
      for (const o of oData) {
        if (Array.isArray((o as any).order_items)) {
          for (const it of (o as any).order_items) {
            itData.push({ ...it, order_id: it.order_id || o.id });
          }
        }
        if (Array.isArray((o as any).shipments)) {
          for (const s of (o as any).shipments) {
            sData.push({ ...s, order_id: s.order_id || o.id });
          }
        }
      }

      setOrders(oData);
      setItems(itData);
      setProducts(pData);
      setShipments(sData);
      setResellers(rData);
      setAgents(aData);
      setExpenses(eData);

      if (isRefresh) {
        toast.success(`Business report refreshed (${oData.length} orders loaded)`);
      }
    } catch (err: any) {
      console.error("[business-report] load error:", err);
      toast.error("Failed to load business report data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => setPage(1), [tab, filters]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Order IDs matching product name or product code search
  const orderIdsWithMatchingProduct = useMemo(() => {
    if (!filters.q) return null;
    const q = filters.q.toLowerCase().trim();
    const matchingOrderIds = new Set<string>();
    for (const it of items) {
      if (it.product_name && it.product_name.toLowerCase().includes(q)) {
        matchingOrderIds.add(it.order_id);
      }
    }
    for (const p of products) {
      if (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.product_code && p.product_code.toLowerCase().includes(q))
      ) {
        for (const it of items) {
          if (it.product_id === p.id) {
            matchingOrderIds.add(it.order_id);
          }
        }
      }
    }
    return matchingOrderIds;
  }, [items, products, filters.q]);

  const scoped = useMemo(() => {
    const { fromTs, toTs } = resolveDateRange(filters);
    const q = filters.q.trim().toLowerCase();

    let list = orders.filter((o) => {
      if (q) {
        const hay = [
          o.order_number,
          (o as any).customer_name ?? "",
          (o as any).customer_phone ?? "",
          (o as any).address_line ?? "",
          o.resellers?.business_name ?? "",
          o.resellers?.code ?? "",
        ]
          .join(" ")
          .toLowerCase();

        const matchesOrderInfo = hay.includes(q);
        const matchesProduct = orderIdsWithMatchingProduct ? orderIdsWithMatchingProduct.has(o.id) : false;
        if (!matchesOrderInfo && !matchesProduct) return false;
      }

      if (filters.reseller && o.reseller_id !== filters.reseller) return false;
      if (filters.area && (o as any).area !== filters.area) return false;

      const ts = new Date(o.created_at).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;

      return true;
    });

    if (filters.courier) {
      list = filterByCourier(list, filters.courier, shipments);
    }

    return list;
  }, [orders, filters, shipments, orderIdsWithMatchingProduct]);

  const scopedIds = useMemo(() => new Set(scoped.map((o) => o.id)), [scoped]);
  const scopedItems = useMemo(() => items.filter((i) => scopedIds.has(i.order_id)), [items, scopedIds]);

  const scopedExpenses = useMemo(() => {
    const { fromTs, toTs } = resolveDateRange(filters);
    return expenses.filter((e) => {
      const ts = new Date(`${e.spent_on}T12:00:00`).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      return true;
    });
  }, [expenses, filters]);

  // Product Rows
  const productRows = useMemo(() => {
    let rows = buildProductRows(scoped, scopedItems, productMap);
    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      const directMatches = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
      );
      if (directMatches.length > 0) {
        rows = directMatches;
      }
    }
    return sortRows(rows, prodSort.key, prodSort.dir);
  }, [scoped, scopedItems, productMap, prodSort, filters.q]);

  const resellerMap = useMemo(
    () => new Map(resellers.map((r) => [r.id, { business_name: r.business_name, code: r.code, status: r.status }])),
    [resellers],
  );

  // Reseller Rows
  const resellerRows = useMemo(() => {
    let rows = buildResellerRows(scoped, scopedItems, productMap, resellerMap, resellers);
    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      const direct = rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
      if (direct.length > 0) rows = direct;
    }
    return sortRows(rows, resSort.key, resSort.dir);
  }, [scoped, scopedItems, productMap, resellerMap, resellers, resSort, filters.q]);

  // Courier Rows
  const courierRows = useMemo(() => {
    let rows = buildCourierRows(scoped, scopedItems, productMap, shipments);
    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      const direct = rows.filter((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
      if (direct.length > 0) rows = direct;
    }
    return sortRows(rows, couSort.key, couSort.dir);
  }, [scoped, scopedItems, productMap, shipments, couSort, filters.q]);

  // Agent Rows
  const agentRows = useMemo(() => {
    const itemsByOrder = new Map<string, BizItem[]>();
    for (const i of scopedItems) {
      const arr = itemsByOrder.get(i.order_id) ?? [];
      arr.push(i);
      itemsByOrder.set(i.order_id, arr);
    }
    let rows: AgentRow[] = agents.map((ag) => {
      const mine = new Set(resellers.filter((r) => r.agent_id === ag.id).map((r) => r.id));
      const mineOrders = scoped.filter((o) => o.reseller_id && mine.has(o.reseller_id));
      let sales = 0;
      let commissionBase = 0;
      let adminProfit = 0;
      let units = 0;
      for (const o of mineOrders) {
        const myItems = itemsByOrder.get(o.id) ?? [];
        const ord = withKeptCost(o, myItems);
        sales += orderReceived(ord);
        if (isCommissionOrder(o.status)) {
          commissionBase += orderProfit(ord);
          units += myItems.reduce(
            (t, it) => t + Math.max(Number(it.quantity ?? 0) - Number((it as any).returned_qty ?? 0), 0),
            0,
          );
        }
        adminProfit += orderReceived(ord) - orderMargin(ord) - orderBuyingCost(myItems, o.status, productMap, o as any);
      }
      const target = Number(ag.sale_target ?? 0) || 0;
      const rate = Number(ag.commission_rate ?? 0) || 0;
      const perUnit = Number(ag.commission_per_unit ?? 0) || 0;
      const perProduct = commissionMode(ag) === "per_product";
      const commission = agentCommissionFor(ag, commissionBase, units);
      return {
        key: ag.id,
        name: ag.display_name,
        resellers: mine.size,
        orders: mineOrders.length,
        sales,
        target,
        achieved: target > 0 ? (sales / target) * 100 : 0,
        rate,
        rateLabel: perProduct ? `${bdt(perUnit)}/pc × ${units} pc` : `${rate}% rate`,
        commission,
        adminProfit,
        netAdminProfit: adminProfit - commission,
      };
    });
    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      const direct = rows.filter((r) => r.name.toLowerCase().includes(q));
      if (direct.length > 0) rows = direct;
    }
    return sortRows(rows, agtSort.key, agtSort.dir);
  }, [agents, resellers, scoped, scopedItems, productMap, agtSort, filters.q]);

  const agentCommissionTotal = useMemo(() => agentRows.reduce((t, a) => t + a.commission, 0), [agentRows]);
  const pnl = useMemo(
    () => buildPnL(scoped, scopedItems, productMap, scopedExpenses, agentCommissionTotal),
    [scoped, scopedItems, productMap, scopedExpenses, agentCommissionTotal],
  );

  // Totals calculations for summary footers
  const productTotals = useMemo(() => {
    return productRows.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        saleQty: acc.saleQty + r.saleQty,
        returnedQty: acc.returnedQty + r.returnedQty,
        sellValue: acc.sellValue + r.sellValue,
        adminRevenue: acc.adminRevenue + r.adminRevenue,
        buyCost: acc.buyCost + r.buyCost,
        adminProfit: acc.adminProfit + r.adminProfit,
      }),
      { orders: 0, saleQty: 0, returnedQty: 0, sellValue: 0, adminRevenue: 0, buyCost: 0, adminProfit: 0 }
    );
  }, [productRows]);

  const resellerTotals = useMemo(() => {
    return resellerRows.reduce(
      (acc, r) => ({
        orders: acc.orders + r.orders,
        delivered: acc.delivered + r.delivered,
        failed: acc.failed + r.failed,
        value: acc.value + r.value,
        received: acc.received + r.received,
        resellerProfit: acc.resellerProfit + r.resellerProfit,
        adminProfit: acc.adminProfit + r.adminProfit,
      }),
      { orders: 0, delivered: 0, failed: 0, value: 0, received: 0, resellerProfit: 0, adminProfit: 0 }
    );
  }, [resellerRows]);

  const courierTotals = useMemo(() => {
    return courierRows.reduce(
      (acc, r) => ({
        parcels: acc.parcels + r.parcels,
        delivered: acc.delivered + r.delivered,
        returned: acc.returned + r.returned,
        value: acc.value + r.value,
        received: acc.received + r.received,
        courierBill: acc.courierBill + r.courierBill,
        adminProfit: acc.adminProfit + r.adminProfit,
      }),
      { parcels: 0, delivered: 0, returned: 0, value: 0, received: 0, courierBill: 0, adminProfit: 0 }
    );
  }, [courierRows]);

  const agentTotals = useMemo(() => {
    return agentRows.reduce(
      (acc, r) => ({
        resellers: acc.resellers + r.resellers,
        orders: acc.orders + r.orders,
        sales: acc.sales + r.sales,
        target: acc.target + r.target,
        commission: acc.commission + r.commission,
        adminProfit: acc.adminProfit + r.adminProfit,
        netAdminProfit: acc.netAdminProfit + r.netAdminProfit,
      }),
      { resellers: 0, orders: 0, sales: 0, target: 0, commission: 0, adminProfit: 0, netAdminProfit: 0 }
    );
  }, [agentRows]);

  // Paginated collections
  const perPage = filters.perPage || 20;
  const pagedProducts = usePaginated(productRows, page, perPage);
  const pagedResellers = usePaginated(resellerRows, page, perPage);
  const pagedCouriers = usePaginated(courierRows, page, perPage);
  const pagedAgents = usePaginated(agentRows, page, perPage);

  const avatarByReseller = useMemo(
    () => new Map(resellers.map((r) => [r.id, r.avatar_url ?? null])),
    [resellers],
  );

  const sortP = (k: keyof ProductRow) =>
    setProdSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }));
  const sortR = (k: keyof ResellerRow) =>
    setResSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }));
  const sortC = (k: keyof CourierRow) =>
    setCouSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }));
  const sortA = (k: keyof AgentRow) =>
    setAgtSort((s) => ({ key: k, dir: s.key === k && s.dir === "desc" ? "asc" : "desc" }));

  const exportCurrent = () => {
    if (tab === "products")
      return downloadCsv(
        "most-selling-products.csv",
        toCsv(
          ["Product", "Code", "Orders", "Sold Qty", "Returned Qty", "Sell Value", "Admin Revenue", "Buying Cost", "Admin Profit"],
          productRows.map((r) => [r.name, r.code, r.orders, r.saleQty, r.returnedQty, r.sellValue, r.adminRevenue, r.buyCost, r.adminProfit]),
        ),
      );
    if (tab === "resellers")
      return downloadCsv(
        "reseller-report.csv",
        toCsv(
          ["Reseller", "Code", "Orders", "Delivered", "Failed", "Order Value", "Received", "Reseller Profit", "Admin Profit"],
          resellerRows.map((r) => [r.name, r.code, r.orders, r.delivered, r.failed, r.value, r.received, r.resellerProfit, r.adminProfit]),
        ),
      );
    if (tab === "couriers")
      return downloadCsv(
        "courier-report.csv",
        toCsv(
          ["Courier", "Parcels", "Delivered", "Returned", "Parcel Value", "Received", "Courier Bill", "Admin Profit"],
          courierRows.map((r) => [r.name, r.parcels, r.delivered, r.returned, r.value, r.received, r.courierBill, r.adminProfit]),
        ),
      );
    if (tab === "agents")
      return downloadCsv(
        "agent-report.csv",
        toCsv(
          ["Agent", "Resellers", "Orders", "Sales", "Target", "Achieved %", "Commission", "Admin Profit", "Net Profit"],
          agentRows.map((r) => [r.name, r.resellers, r.orders, r.sales, r.target, r.achieved.toFixed(1), r.commission, r.adminProfit, r.netAdminProfit]),
        ),
      );
    return downloadCsv(
      "profit-loss.csv",
      toCsv(
        ["Line", "Amount"],
        [
          ["Order value", pnl.value],
          ["Received (incl. advance)", pnl.received],
          ["Reseller payout", pnl.resellerPayout],
          ["Product buying cost", pnl.buyCost],
          ["Gross profit", pnl.grossProfit],
          ["Expenses", pnl.expenses],
          ["Agent commission", pnl.agentCommission],
          ["Net profit", pnl.netProfit],
        ],
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col h-72 items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading complete business report data without limits…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Business report"
        description="Most selling products, reseller report, courier report, agent report, and profit & loss."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void loadData(true)}
              className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              to="/admin/expenses"
              className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Expenses
            </Link>
            <button
              type="button"
              onClick={exportCurrent}
              className="inline-flex items-center rounded-md border bg-primary/10 text-primary border-primary/20 px-2.5 py-1.5 text-xs font-bold hover:bg-primary/20"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        }
      />

      {/* Filter Bar with Per-Page, Date, Reseller, Courier, Area, Search */}
      <OrderFilterBar
        value={filters}
        onChange={setFilters}
        resellerOptions={resellers.map((r) => ({ value: r.id, label: `${r.business_name} (${r.code})` }))}
        total={orders.length}
        shown={scoped.length}
        showPerPage
        variant="report"
        defaultFilters={DEFAULT_REPORT_FILTERS}
      />

      {/* Executive KPI Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Received money"
          value={bdt(pnl.received)}
          hint={`${pnl.orders} orders · order value ${bdt(pnl.value)} · advance ${bdt(pnl.advance)} included`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Reseller payout"
          value={bdt(pnl.resellerPayout)}
          hint="What the resellers finally earn from these orders"
          icon={<Users className="h-4 w-4" />}
          tone="sky"
        />
        <StatCard
          label="Product buying cost"
          value={bdt(pnl.buyCost)}
          hint="Your own buying price of the items the customer kept"
          icon={<Boxes className="h-4 w-4" />}
          tone="violet"
        />
        <StatCard
          label="Net admin profit"
          value={bdt(pnl.netProfit)}
          hint={`Gross ${bdt(pnl.grossProfit)} − expenses ${bdt(pnl.expenses)} − agent commission ${bdt(pnl.agentCommission)}`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="emerald"
        />
      </div>

      <ReportTabs tabs={TABS} active={tab} onChange={setTab} />

      {/* TAB 1: PRODUCT SALE REPORT */}
      {tab === "products" && (
        <div className="space-y-3">
          <ReportCard
            title="Most Selling Products"
            hint="Showing sales volume, orders, returned units and net profit per product. Default: highest sold quantity first. Click column header to sort."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className={th + " text-left"}>Product</th>
                    <SortTh label="Orders" sortKey="orders" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                    <SortTh label="Sold Qty" sortKey="saleQty" active={prodSort.key} dir={prodSort.dir} onSort={sortP} hint="Quantity the customer kept" />
                    <SortTh label="Returned" sortKey="returnedQty" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                    <SortTh label="Sell Value" sortKey="sellValue" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                    <SortTh label="Admin Revenue" sortKey="adminRevenue" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                    <SortTh label="Buying Cost" sortKey="buyCost" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                    <SortTh label="Admin Profit" sortKey="adminProfit" active={prodSort.key} dir={prodSort.dir} onSort={sortP} hint="Admin revenue − buying cost" />
                  </tr>
                </thead>
                <tbody>
                  {pagedProducts.map((r) => (
                    <tr key={r.key} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-muted">
                            {r.image ? (
                              <img src={r.image} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground/90">{r.name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">#{r.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{r.orders}</td>
                      <td className="px-3 py-2 text-center font-bold tabular-nums text-primary">{r.saleQty}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{r.returnedQty || "—"}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{bdt(r.sellValue)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{bdt(r.adminRevenue)}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{bdt(r.buyCost)}</td>
                      <td className={"px-3 py-2 text-center font-bold tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                    </tr>
                  ))}
                  {pagedProducts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-xs text-muted-foreground">
                        No product sold in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {productRows.length > 0 && (
                  <tfoot className="border-t-2 border-primary/20 bg-muted/40 font-bold">
                    <tr>
                      <td className="px-3 py-2.5 font-bold">Total ({productRows.length} Products)</td>
                      <td className="px-3 py-2.5 text-center">{productTotals.orders}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-primary">{productTotals.saleQty}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{productTotals.returnedQty || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(productTotals.sellValue)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(productTotals.adminRevenue)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{bdt(productTotals.buyCost)}</td>
                      <td className={"px-3 py-2.5 text-center tabular-nums font-black " + toneOf(productTotals.adminProfit)}>
                        {bdt(productTotals.adminProfit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={productRows.length} onPage={setPage} />
        </div>
      )}

      {/* TAB 2: RESELLER SALES REPORT */}
      {tab === "resellers" && (
        <div className="space-y-3">
          <ReportCard title="Reseller Report" hint={ADMIN_PROFIT_HINT}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className={th + " text-left"}>Reseller</th>
                    <SortTh label="Orders" sortKey="orders" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                    <SortTh label="Delivered" sortKey="delivered" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                    <SortTh label="Failed" sortKey="failed" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                    <SortTh label="Order Value" sortKey="value" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                    <SortTh label="Received" sortKey="received" active={resSort.key} dir={resSort.dir} onSort={sortR} hint="Courier collection + advance already taken" />
                    <SortTh label="Reseller Profit" sortKey="resellerProfit" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                    <SortTh label="Admin Profit" sortKey="adminProfit" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                  </tr>
                </thead>
                <tbody>
                  {pagedResellers.map((r) => (
                    <tr key={r.key} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <ResellerAvatar url={avatarByReseller.get(r.key) ?? null} name={r.name} size={28} />
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground/90">{r.name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">{r.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">{r.orders}</td>
                      <td className="px-3 py-2 text-center text-success font-semibold">{r.delivered}</td>
                      <td className="px-3 py-2 text-center text-destructive">{r.failed || "—"}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{bdt(r.value)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {bdt(r.received)}
                        {r.advance > 0 && <div className="text-[9px] text-primary">adv {bdt(r.advance)} included</div>}
                      </td>
                      <td className={"px-3 py-2 text-center tabular-nums " + toneOf(r.resellerProfit)}>{bdt(r.resellerProfit)}</td>
                      <td className={"px-3 py-2 text-center font-bold tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                    </tr>
                  ))}
                  {pagedResellers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-xs text-muted-foreground">
                        No reseller order in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {resellerRows.length > 0 && (
                  <tfoot className="border-t-2 border-primary/20 bg-muted/40 font-bold">
                    <tr>
                      <td className="px-3 py-2.5 font-bold">Total ({resellerRows.length} Resellers)</td>
                      <td className="px-3 py-2.5 text-center">{resellerTotals.orders}</td>
                      <td className="px-3 py-2.5 text-center text-success">{resellerTotals.delivered}</td>
                      <td className="px-3 py-2.5 text-center text-destructive">{resellerTotals.failed || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(resellerTotals.value)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(resellerTotals.received)}</td>
                      <td className={"px-3 py-2.5 text-center tabular-nums " + toneOf(resellerTotals.resellerProfit)}>
                        {bdt(resellerTotals.resellerProfit)}
                      </td>
                      <td className={"px-3 py-2.5 text-center tabular-nums font-black " + toneOf(resellerTotals.adminProfit)}>
                        {bdt(resellerTotals.adminProfit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={resellerRows.length} onPage={setPage} />
        </div>
      )}

      {/* TAB 3: COURIER PERFORMANCE REPORT */}
      {tab === "couriers" && (
        <div className="space-y-3">
          <ReportCard title="Courier Report" hint="Parcel count, parcel value, delivery completion, and admin profit per courier.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className={th + " text-left"}>Courier</th>
                    <SortTh label="Parcels" sortKey="parcels" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                    <SortTh label="Delivered" sortKey="delivered" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                    <SortTh label="Returned" sortKey="returned" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                    <SortTh label="Parcel Value" sortKey="value" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                    <SortTh label="Received" sortKey="received" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                    <SortTh label="Courier Bill" sortKey="courierBill" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                    <SortTh label="Admin Profit" sortKey="adminProfit" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                  </tr>
                </thead>
                <tbody>
                  {pagedCouriers.map((r) => (
                    <tr key={r.key} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-semibold capitalize">{r.name}</td>
                      <td className="px-3 py-2 text-center font-semibold">{r.parcels}</td>
                      <td className="px-3 py-2 text-center text-success font-semibold">{r.delivered}</td>
                      <td className="px-3 py-2 text-center text-destructive">{r.returned || "—"}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{bdt(r.value)}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{bdt(r.received)}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{bdt(r.courierBill)}</td>
                      <td className={"px-3 py-2 text-center font-bold tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                    </tr>
                  ))}
                  {pagedCouriers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-12 text-center text-xs text-muted-foreground">
                        No parcel in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {courierRows.length > 0 && (
                  <tfoot className="border-t-2 border-primary/20 bg-muted/40 font-bold">
                    <tr>
                      <td className="px-3 py-2.5 font-bold">Total ({courierRows.length} Couriers)</td>
                      <td className="px-3 py-2.5 text-center">{courierTotals.parcels}</td>
                      <td className="px-3 py-2.5 text-center text-success">{courierTotals.delivered}</td>
                      <td className="px-3 py-2.5 text-center text-destructive">{courierTotals.returned || "—"}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(courierTotals.value)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(courierTotals.received)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{bdt(courierTotals.courierBill)}</td>
                      <td className={"px-3 py-2.5 text-center tabular-nums font-black " + toneOf(courierTotals.adminProfit)}>
                        {bdt(courierTotals.adminProfit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={courierRows.length} onPage={setPage} />
        </div>
      )}

      {/* TAB 4: AGENT SALES REPORT */}
      {tab === "agents" && (
        <div className="space-y-3">
          <ReportCard title="Agent Report" hint={AGENT_COMMISSION_HINT}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead className="bg-muted/20">
                  <tr>
                    <th className={th + " text-left"}>Agent</th>
                    <SortTh label="Resellers" sortKey="resellers" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Orders" sortKey="orders" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Sales" sortKey="sales" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Target" sortKey="target" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Achieved" sortKey="achieved" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Commission" sortKey="commission" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Admin Profit" sortKey="adminProfit" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                    <SortTh label="Net Profit" sortKey="netAdminProfit" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  </tr>
                </thead>
                <tbody>
                  {pagedAgents.map((r) => (
                    <tr key={r.key} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-semibold">{r.name}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{r.resellers}</td>
                      <td className="px-3 py-2 text-center">{r.orders}</td>
                      <td className="px-3 py-2 text-center tabular-nums">{bdt(r.sales)}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.target ? bdt(r.target) : "—"}</td>
                      <td className="px-3 py-2 text-center">
                        {r.target ? (
                          <div className="mx-auto w-24">
                            <div className="mb-1 text-[11px] font-semibold">{r.achieved.toFixed(0)}%</div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={"h-full rounded-full " + (r.achieved >= 100 ? "bg-success" : "bg-primary")}
                                style={{ width: `${Math.min(r.achieved, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No target</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {bdt(r.commission)}
                        <div className="text-[9px] text-muted-foreground">{r.rateLabel}</div>
                      </td>
                      <td className={"px-3 py-2 text-center tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                      <td className={"px-3 py-2 text-center font-bold tabular-nums " + toneOf(r.netAdminProfit)}>
                        {bdt(r.netAdminProfit)}
                      </td>
                    </tr>
                  ))}
                  {pagedAgents.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-12 text-center text-xs text-muted-foreground">
                        No agent recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
                {agentRows.length > 0 && (
                  <tfoot className="border-t-2 border-primary/20 bg-muted/40 font-bold">
                    <tr>
                      <td className="px-3 py-2.5 font-bold">Total ({agentRows.length} Agents)</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{agentTotals.resellers}</td>
                      <td className="px-3 py-2.5 text-center">{agentTotals.orders}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{bdt(agentTotals.sales)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{bdt(agentTotals.target)}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        {bdt(agentTotals.commission)}
                      </td>
                      <td className={"px-3 py-2.5 text-center tabular-nums " + toneOf(agentTotals.adminProfit)}>
                        {bdt(agentTotals.adminProfit)}
                      </td>
                      <td className={"px-3 py-2.5 text-center tabular-nums font-black " + toneOf(agentTotals.netAdminProfit)}>
                        {bdt(agentTotals.netAdminProfit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={agentRows.length} onPage={setPage} />
        </div>
      )}

      {/* TAB 5: PROFIT & LOSS */}
      {tab === "pnl" && (
        <div className="space-y-4">
          <ReportCard
            title="Profit & Loss (P&L)"
            hint={ADMIN_PROFIT_HINT}
            right={
              <Link
                to="/admin/expenses"
                className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
              >
                <Receipt className="mr-1.5 h-3.5 w-3.5" /> Manage expenses
              </Link>
            }
          >
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {[
                  { label: "Order value", value: pnl.value, muted: true, note: `${pnl.orders} orders in this range` },
                  {
                    label: "Received (incl. advance)",
                    value: pnl.received,
                    note: `advance ${bdt(pnl.advance)} counted as received — same as transaction report`,
                  },
                  { label: "Reseller final payout", value: -pnl.resellerPayout, note: "what the resellers earn from these orders" },
                  { label: "Product buying cost", value: -pnl.buyCost, note: "your buying price of the kept items" },
                ].map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground/90">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground">{r.note}</div>
                    </td>
                    <td
                      className={
                        "px-3 py-2 text-right font-semibold tabular-nums " +
                        (r.muted ? "text-muted-foreground" : toneOf(r.value))
                      }
                    >
                      {bdt(r.value)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td className="px-3 py-2.5 font-bold">Gross profit</td>
                  <td className={"px-3 py-2.5 text-right font-bold tabular-nums " + toneOf(pnl.grossProfit)}>
                    {bdt(pnl.grossProfit)}
                  </td>
                </tr>
                {pnl.expenseByCategory.map((c) => (
                  <tr key={c.category} className="border-t">
                    <td className="px-3 py-2 pl-8 capitalize text-muted-foreground">Expense · {c.category}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">−{bdt(c.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-foreground/90">Total expenses</div>
                    <div className="text-[11px] text-muted-foreground">
                      Delivery and packaging are only deducted here — record them once as an expense.
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-destructive">−{bdt(pnl.expenses)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-foreground/90">Agent commission</div>
                    <div className="text-[11px] text-muted-foreground">Earned commission of all agents on these orders</div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-destructive">−{bdt(pnl.agentCommission)}</td>
                </tr>
                <tr className="border-t-2 bg-primary/5">
                  <td className="px-3 py-3.5 text-base font-black">Net admin profit</td>
                  <td className={"px-3 py-3.5 text-right text-base font-black tabular-nums " + toneOf(pnl.netProfit)}>
                    {bdt(pnl.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </ReportCard>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total expense"
              value={bdt(pnl.expenses)}
              hint={`${scopedExpenses.length} expense entries in this range`}
              icon={<Receipt className="h-4 w-4" />}
              tone="rose"
            />
            <StatCard
              label="Delivery charge (info)"
              value={bdt(pnl.delivery)}
              hint="Not deducted here — add it as a courier expense to deduct once"
              icon={<Truck className="h-4 w-4" />}
              tone="sky"
            />
            <StatCard
              label="Packaging (info)"
              value={bdt(pnl.packaging)}
              hint="Not deducted here — add it as a packaging expense to deduct once"
              icon={<Boxes className="h-4 w-4" />}
              tone="violet"
            />
            <StatCard
              label="Agent commission"
              value={bdt(pnl.agentCommission)}
              hint="Deducted from the net profit"
              icon={<Target className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}
