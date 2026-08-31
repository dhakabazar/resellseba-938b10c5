import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  OrderFilterBar,
  applyOrderFilters,
  DEFAULT_ORDER_FILTERS,
  resolveDateRange,
  type OrderFilterState,
} from "@/components/order-filters";
import { ReportCard, ReportTabs, SortTh, toneOf } from "@/components/report-blocks";
import { Pagination, usePaginated } from "@/components/data-list";
import { ResellerAvatar } from "@/components/reseller-avatar";
import { bdt, toCsv, downloadCsv, orderProfit, orderReceived } from "@/lib/finance-report";
import { agentCommissionFor, commissionMode, AGENT_COMMISSION_HINT } from "@/lib/agents";
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
import { Loader2, Download, Wallet, Boxes, TrendingUp, Receipt, Package, Users, Truck, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/business-report")({
  component: BusinessReportPage,
  head: () => ({
    meta: [
      { title: "Business report — Admin" },
      {
        name: "description",
        content: "Most selling products, reseller and courier performance, agent targets and the admin profit & loss.",
      },
      { property: "og:title", content: "Business report — Admin" },
      { property: "og:description", content: "Five simple reports: products, resellers, couriers, agents, profit & loss." },
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
type ResellerLite = { id: string; business_name: string; code: string; agent_id: string | null; avatar_url?: string | null };
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

const th = "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function BusinessReportPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<BizOrder[]>([]);
  const [items, setItems] = useState<BizItem[]>([]);
  const [products, setProducts] = useState<BizProduct[]>([]);
  const [shipments, setShipments] = useState<{ order_id: string; provider: string; cost: number | null }[]>([]);
  const [resellers, setResellers] = useState<ResellerLite[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [filters, setFilters] = useState<OrderFilterState>(DEFAULT_ORDER_FILTERS);
  const [tab, setTab] = useState<Tab>("products");
  const [page, setPage] = useState(1);

  const [prodSort, setProdSort] = useState<{ key: keyof ProductRow; dir: SortDir }>({ key: "saleQty", dir: "desc" });
  const [resSort, setResSort] = useState<{ key: keyof ResellerRow; dir: SortDir }>({ key: "orders", dir: "desc" });
  const [couSort, setCouSort] = useState<{ key: keyof CourierRow; dir: SortDir }>({ key: "parcels", dir: "desc" });
  const [agtSort, setAgtSort] = useState<{ key: keyof AgentRow; dir: SortDir }>({ key: "sales", dir: "desc" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, it, p, s, r, a, e] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,order_number,reseller_id,status,created_at,customer_name,customer_phone,address_line,subtotal,shipping_cost,total,sa_cost_total,reseller_profit,received_amount,packaging_total,delivery_cost,advance_amount,advance_by,resellers(business_name,code)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("order_items")
          .select("order_id,product_id,product_name,quantity,returned_qty,sa_price,line_total,profit,buying_price,packaging_cost"),
        supabase.from("products").select("id,name,product_code,buying_price,packaging_cost,og_image_url"),
        supabase.from("shipments").select("order_id,provider,cost"),
        supabase.from("resellers").select("id,business_name,code,agent_id,avatar_url"),
        supabase.from("agents").select("id,display_name,sale_target,commission_rate,commission_mode,commission_per_unit,is_active"),
        supabase.from("expenses").select("*"),
      ]);
      setOrders((o.data ?? []) as unknown as BizOrder[]);
      setItems((it.data ?? []) as unknown as BizItem[]);
      setProducts((p.data ?? []) as unknown as BizProduct[]);
      setShipments((s.data ?? []) as unknown as { order_id: string; provider: string; cost: number | null }[]);
      setResellers((r.data ?? []) as unknown as ResellerLite[]);
      setAgents((a.data ?? []) as unknown as Agent[]);
      setExpenses((e.data ?? []) as unknown as Expense[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => setPage(1), [tab, filters]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const scoped = useMemo(
    () => applyOrderFilters(orders as unknown as (BizOrder & { customer_name: string; customer_phone: string })[], filters),
    [orders, filters],
  ) as unknown as BizOrder[];
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

  const productRows = useMemo(
    () => sortRows(buildProductRows(scoped, scopedItems, productMap), prodSort.key, prodSort.dir),
    [scoped, scopedItems, productMap, prodSort],
  );
  const resellerRows = useMemo(
    () => sortRows(buildResellerRows(scoped, scopedItems, productMap), resSort.key, resSort.dir),
    [scoped, scopedItems, productMap, resSort],
  );
  const courierRows = useMemo(
    () => sortRows(buildCourierRows(scoped, scopedItems, productMap, shipments), couSort.key, couSort.dir),
    [scoped, scopedItems, productMap, shipments, couSort],
  );

  const agentRows = useMemo(() => {
    const itemsByOrder = new Map<string, BizItem[]>();
    for (const i of scopedItems) {
      const arr = itemsByOrder.get(i.order_id) ?? [];
      arr.push(i);
      itemsByOrder.set(i.order_id, arr);
    }
    const rows: AgentRow[] = agents.map((ag) => {
      const mine = new Set(resellers.filter((r) => r.agent_id === ag.id).map((r) => r.id));
      const mineOrders = scoped.filter((o) => o.reseller_id && mine.has(o.reseller_id));
      let sales = 0;
      let base = 0;
      let adminProfit = 0;
      let units = 0;
      for (const o of mineOrders) {
        const myItems = itemsByOrder.get(o.id) ?? [];
        const ord = withKeptCost(o, myItems);
        sales += orderReceived(ord);
        base += orderProfit(ord);
        if (["delivered", "partial", "partial_full", "partial_item", "damaged"].includes(String(o.status)))
          units += myItems.reduce(
            (t, it) => t + Math.max(Number(it.quantity ?? 0) - Number((it as any).returned_qty ?? 0), 0),
            0,
          );
        adminProfit += orderReceived(ord) - orderProfit(ord) - orderBuyingCost(myItems, o.status, productMap);
      }
      const target = Number(ag.sale_target ?? 0) || 0;
      const rate = Number(ag.commission_rate ?? 0) || 0;
      const perUnit = Number(ag.commission_per_unit ?? 0) || 0;
      const perProduct = commissionMode(ag) === "per_product";
      const commission = agentCommissionFor(ag, base, units);
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
    return sortRows(rows, agtSort.key, agtSort.dir);
  }, [agents, resellers, scoped, scopedItems, productMap, agtSort]);

  const agentCommissionTotal = useMemo(() => agentRows.reduce((t, a) => t + a.commission, 0), [agentRows]);
  const pnl = useMemo(
    () => buildPnL(scoped, scopedItems, productMap, scopedExpenses, agentCommissionTotal),
    [scoped, scopedItems, productMap, scopedExpenses, agentCommissionTotal],
  );

  const perPage = filters.perPage;
  const pagedProducts = usePaginated(productRows, page, perPage);
  const pagedResellers = usePaginated(resellerRows, page, perPage);
  const avatarByReseller = useMemo(
    () => new Map(resellers.map((r) => [r.id, r.avatar_url ?? null])),
    [resellers],
  );
  const pagedAgents = usePaginated(agentRows, page, perPage);

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
          ["Product", "Code", "Orders", "Sale qty", "Returned qty", "Sell value", "Admin revenue", "Buying cost", "Admin profit"],
          productRows.map((r) => [r.name, r.code, r.orders, r.saleQty, r.returnedQty, r.sellValue, r.adminRevenue, r.buyCost, r.adminProfit]),
        ),
      );
    if (tab === "resellers")
      return downloadCsv(
        "reseller-report.csv",
        toCsv(
          ["Reseller", "Code", "Orders", "Delivered", "Failed", "Order value", "Received", "Advance", "Reseller profit", "Admin profit"],
          resellerRows.map((r) => [r.name, r.code, r.orders, r.delivered, r.failed, r.value, r.received, r.advance, r.resellerProfit, r.adminProfit]),
        ),
      );
    if (tab === "couriers")
      return downloadCsv(
        "courier-report.csv",
        toCsv(
          ["Courier", "Parcels", "Delivered", "Returned", "Parcel value", "Received", "Courier bill", "Admin profit"],
          courierRows.map((r) => [r.name, r.parcels, r.delivered, r.returned, r.value, r.received, r.courierBill, r.adminProfit]),
        ),
      );
    if (tab === "agents")
      return downloadCsv(
        "agent-report.csv",
        toCsv(
          ["Agent", "Resellers", "Orders", "Sales", "Target", "Achieved %", "Rate %", "Commission", "Admin profit", "Net after commission"],
          agentRows.map((r) => [r.name, r.resellers, r.orders, r.sales, r.target, r.achieved.toFixed(1), r.rate, r.commission, r.adminProfit, r.netAdminProfit]),
        ),
      );
    return downloadCsv(
      "admin-profit-loss.csv",
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Business report"
        description="Five simple reports — products, resellers, couriers, agents and your own profit & loss."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/admin/expenses"
              className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Receipt className="mr-1.5 h-3.5 w-3.5" /> Expenses
            </Link>
            <button
              type="button"
              onClick={exportCurrent}
              className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </button>
          </div>
        }
      />

      <OrderFilterBar
        value={filters}
        onChange={setFilters}
        resellerOptions={resellers.map((r) => ({ value: r.id, label: `${r.business_name} (${r.code})` }))}
        total={orders.length}
        shown={scoped.length}
        showPerPage
        variant="report"
      />

      <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
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

      {tab === "products" && (
        <>
          <ReportCard title="Most selling products" hint="Default: highest sale count first. Click any column arrow to sort.">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-muted/20">
                <tr>
                  <th className={th + " text-left"}>Product</th>
                  <SortTh label="Orders" sortKey="orders" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                  <SortTh label="Sale count" sortKey="saleQty" active={prodSort.key} dir={prodSort.dir} onSort={sortP} hint="Quantity the customer kept" />
                  <SortTh label="Returned" sortKey="returnedQty" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                  <SortTh label="Sell value" sortKey="sellValue" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                  <SortTh label="Admin revenue" sortKey="adminRevenue" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                  <SortTh label="Buying cost" sortKey="buyCost" active={prodSort.key} dir={prodSort.dir} onSort={sortP} />
                  <SortTh label="Total profit" sortKey="adminProfit" active={prodSort.key} dir={prodSort.dir} onSort={sortP} hint="Admin revenue − buying cost" />
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border bg-muted">
                          {r.image ? (
                            <img src={r.image} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">#{r.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{r.orders}</td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.saleQty}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{r.returnedQty || "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{bdt(r.sellValue)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{bdt(r.adminRevenue)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{bdt(r.buyCost)}</td>
                    <td className={"px-3 py-2 text-center font-semibold tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                  </tr>
                ))}
                {pagedProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-xs text-muted-foreground">
                      No product sold in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={productRows.length} onPage={setPage} />
        </>
      )}

      {tab === "resellers" && (
        <>
          <ReportCard title="Reseller report" hint={ADMIN_PROFIT_HINT}>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/20">
                <tr>
                  <th className={th + " text-left"}>Reseller</th>
                  <SortTh label="Orders" sortKey="orders" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                  <SortTh label="Delivered" sortKey="delivered" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                  <SortTh label="Failed" sortKey="failed" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                  <SortTh label="Order value" sortKey="value" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                  <SortTh label="Received" sortKey="received" active={resSort.key} dir={resSort.dir} onSort={sortR} hint="Courier collection + advance already taken" />
                  <SortTh label="Reseller profit" sortKey="resellerProfit" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                  <SortTh label="Admin profit" sortKey="adminProfit" active={resSort.key} dir={resSort.dir} onSort={sortR} />
                </tr>
              </thead>
              <tbody>
                {pagedResellers.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ResellerAvatar url={avatarByReseller.get(r.key) ?? null} name={r.name} size={28} />
                        <div className="min-w-0">
                          <div className="font-medium">{r.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{r.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">{r.orders}</td>
                    <td className="px-3 py-2 text-center text-success">{r.delivered}</td>
                    <td className="px-3 py-2 text-center text-destructive">{r.failed || "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{bdt(r.value)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {bdt(r.received)}
                      {r.advance > 0 && <div className="text-[9px] text-primary">adv {bdt(r.advance)} included</div>}
                    </td>
                    <td className={"px-3 py-2 text-center tabular-nums " + toneOf(r.resellerProfit)}>{bdt(r.resellerProfit)}</td>
                    <td className={"px-3 py-2 text-center font-semibold tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                  </tr>
                ))}
                {pagedResellers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-xs text-muted-foreground">
                      No reseller order in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={resellerRows.length} onPage={setPage} />
        </>
      )}

      {tab === "couriers" && (
        <ReportCard title="Courier report" hint="Parcel count, parcel value and admin profit per courier.">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/20">
              <tr>
                <th className={th + " text-left"}>Courier</th>
                <SortTh label="Parcels" sortKey="parcels" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                <SortTh label="Delivered" sortKey="delivered" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                <SortTh label="Returned" sortKey="returned" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                <SortTh label="Parcel value" sortKey="value" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                <SortTh label="Received" sortKey="received" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                <SortTh label="Courier bill" sortKey="courierBill" active={couSort.key} dir={couSort.dir} onSort={sortC} />
                <SortTh label="Admin profit" sortKey="adminProfit" active={couSort.key} dir={couSort.dir} onSort={sortC} />
              </tr>
            </thead>
            <tbody>
              {courierRows.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 font-medium capitalize">{r.name}</td>
                  <td className="px-3 py-2 text-center font-semibold">{r.parcels}</td>
                  <td className="px-3 py-2 text-center text-success">{r.delivered}</td>
                  <td className="px-3 py-2 text-center text-destructive">{r.returned || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{bdt(r.value)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{bdt(r.received)}</td>
                  <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{bdt(r.courierBill)}</td>
                  <td className={"px-3 py-2 text-center font-semibold tabular-nums " + toneOf(r.adminProfit)}>{bdt(r.adminProfit)}</td>
                </tr>
              ))}
              {courierRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-xs text-muted-foreground">
                    No parcel in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ReportCard>
      )}

      {tab === "agents" && (
        <>
          <ReportCard title="Agent report" hint={AGENT_COMMISSION_HINT}>
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/20">
                <tr>
                  <th className={th + " text-left"}>Agent</th>
                  <SortTh label="Resellers" sortKey="resellers" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Orders" sortKey="orders" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Sales" sortKey="sales" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Target" sortKey="target" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Achieved" sortKey="achieved" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Commission" sortKey="commission" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Admin profit" sortKey="adminProfit" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                  <SortTh label="Net after commission" sortKey="netAdminProfit" active={agtSort.key} dir={agtSort.dir} onSort={sortA} />
                </tr>
              </thead>
              <tbody>
                {pagedAgents.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
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
                    <td className={"px-3 py-2 text-center font-semibold tabular-nums " + toneOf(r.netAdminProfit)}>
                      {bdt(r.netAdminProfit)}
                    </td>
                  </tr>
                ))}
                {pagedAgents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-xs text-muted-foreground">
                      No agent yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ReportCard>
          <Pagination page={page} perPage={perPage} total={agentRows.length} onPage={setPage} />
        </>
      )}

      {tab === "pnl" && (
        <>
          <ReportCard
            title="Admin profit & loss"
            hint={ADMIN_PROFIT_HINT}
            right={
              <Link
                to="/admin/expenses"
                className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
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
                    note: `advance ${bdt(pnl.advance)} counted as received — same as the transaction report`,
                  },
                  { label: "Reseller final payout", value: -pnl.resellerPayout, note: "what the resellers earn from these orders" },
                  { label: "Product buying cost", value: -pnl.buyCost, note: "your buying price of the kept items" },
                ].map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground">{r.note}</div>
                    </td>
                    <td className={"px-3 py-2 text-right font-semibold tabular-nums " + (r.muted ? "text-muted-foreground" : toneOf(r.value))}>
                      {bdt(r.value)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td className="px-3 py-2 font-bold">Gross profit</td>
                  <td className={"px-3 py-2 text-right font-bold tabular-nums " + toneOf(pnl.grossProfit)}>{bdt(pnl.grossProfit)}</td>
                </tr>
                {pnl.expenseByCategory.map((c) => (
                  <tr key={c.category} className="border-t">
                    <td className="px-3 py-2 pl-8 capitalize text-muted-foreground">Expense · {c.category}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">−{bdt(c.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">Total expenses</div>
                    <div className="text-[11px] text-muted-foreground">
                      Delivery and packaging are only deducted here — record them once as an expense.
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-destructive">−{bdt(pnl.expenses)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">Agent commission</div>
                    <div className="text-[11px] text-muted-foreground">Earned commission of all agents on these orders</div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-destructive">−{bdt(pnl.agentCommission)}</td>
                </tr>
                <tr className="border-t bg-primary/5">
                  <td className="px-3 py-3 text-base font-black">Net admin profit</td>
                  <td className={"px-3 py-3 text-right text-base font-black tabular-nums " + toneOf(pnl.netProfit)}>
                    {bdt(pnl.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </ReportCard>

          <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total expense" value={bdt(pnl.expenses)} hint={`${scopedExpenses.length} expense entries in this range`} icon={<Receipt className="h-4 w-4" />} tone="rose" />
            <StatCard label="Delivery charge (info)" value={bdt(pnl.delivery)} hint="Not deducted here — add it as a courier expense to deduct once" icon={<Truck className="h-4 w-4" />} tone="sky" />
            <StatCard label="Packaging (info)" value={bdt(pnl.packaging)} hint="Not deducted here — add it as a packaging expense to deduct once" icon={<Boxes className="h-4 w-4" />} tone="violet" />
            <StatCard label="Agent commission" value={bdt(pnl.agentCommission)} hint="Deducted from the net profit" icon={<Target className="h-4 w-4" />} />
          </div>
        </>
      )}
    </div>
  );
}
