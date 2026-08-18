import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Phone, MessageCircle, FileSpreadsheet, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/ui-kit";
import { toCsv, downloadCsv } from "@/lib/finance-report";
import { SearchableSelect } from "@/components/searchable-select";
import { toast } from "sonner";

type OrderRow = {
  id: string;
  reseller_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address_line: string;
  city: string | null;
  area: string;
  status: string;
  total: number;
  received_amount: number | null;
  created_at: string;
};

export type Customer = {
  phone: string;
  name: string;
  email: string | null;
  address: string;
  city: string;
  area: string;
  orders: number;
  delivered: number;
  returned: number;
  pending: number;
  spent: number;
  paid: number;
  firstAt: string;
  lastAt: string;
  resellerIds: string[];
};

const DELIVERED = new Set(["delivered", "partial"]);
const LOST = new Set(["returned", "cancelled"]);

function normalizePhone(p: string) {
  return (p || "").replace(/[^0-9]/g, "").replace(/^88/, "");
}

export function useCustomers(resellerId?: string | null) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("orders")
        .select(
          "id, reseller_id, customer_name, customer_phone, customer_email, address_line, city, area, status, total, received_amount, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (resellerId) q = q.eq("reseller_id", resellerId);
      const { data, error } = await q;
      if (cancelled) return;
      if (error) toast.error(error.message);
      setRows((data ?? []) as OrderRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resellerId]);

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const o of rows) {
      const key = normalizePhone(o.customer_phone) || o.customer_phone;
      const c =
        map.get(key) ??
        ({
          phone: o.customer_phone,
          name: o.customer_name,
          email: o.customer_email,
          address: o.address_line,
          city: o.city ?? "",
          area: o.area,
          orders: 0,
          delivered: 0,
          returned: 0,
          pending: 0,
          spent: 0,
          paid: 0,
          firstAt: o.created_at,
          lastAt: o.created_at,
          resellerIds: [],
        } as Customer);
      c.orders += 1;
      if (DELIVERED.has(o.status)) c.delivered += 1;
      else if (LOST.has(o.status)) c.returned += 1;
      else c.pending += 1;
      c.spent += Number(o.total ?? 0);
      if (DELIVERED.has(o.status)) c.paid += Number(o.received_amount ?? o.total ?? 0);
      if (o.created_at > c.lastAt) {
        c.lastAt = o.created_at;
        c.name = o.customer_name;
        c.address = o.address_line;
        c.city = o.city ?? "";
        c.area = o.area;
        c.email = o.customer_email ?? c.email;
      }
      if (o.created_at < c.firstAt) c.firstAt = o.created_at;
      if (o.reseller_id && !c.resellerIds.includes(o.reseller_id)) c.resellerIds.push(o.reseller_id);
      map.set(key, c);
    }
    return Array.from(map.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [rows]);

  return { customers, loading };
}

const bdt = (n: number) => `৳${Math.round(n).toLocaleString("en-US")}`;
const day = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Address",
  "City",
  "Area",
  "Total orders",
  "Delivered",
  "Returned/Cancelled",
  "Running",
  "Order value",
  "Received",
  "First order",
  "Last order",
  "Store",
];

export function CustomersReport({
  resellerId,
  resellerNames,
  showStore = false,
  allowExport = false,
}: {
  /** When set, only this reseller's customers are aggregated. */
  resellerId?: string | null;
  /** id -> store label, used for the admin "Store" column + export. */
  resellerNames?: Map<string, string>;
  showStore?: boolean;
  allowExport?: boolean;
}) {
  const { customers, loading } = useCustomers(resellerId);
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [store, setStore] = useState("");

  const storeLabel = (c: Customer) =>
    c.resellerIds.map((id) => resellerNames?.get(id) ?? "—").join(", ") || "Admin";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => {
      if (store && !c.resellerIds.includes(store)) return false;
      if (bucket === "repeat" && c.orders < 2) return false;
      if (bucket === "new" && c.orders !== 1) return false;
      if (bucket === "delivered" && c.delivered === 0) return false;
      if (bucket === "returned" && c.returned === 0) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        normalizePhone(c.phone).includes(normalizePhone(term)) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term)
      );
    });
  }, [customers, q, bucket, store]);

  const body = () =>
    filtered.map((c) => [
      c.name,
      c.phone,
      c.email ?? "",
      c.address,
      c.city,
      c.area === "inside_dhaka" ? "Inside Dhaka" : c.area === "sub_dhaka" ? "Sub Dhaka" : "Outside Dhaka",
      c.orders,
      c.delivered,
      c.returned,
      c.pending,
      Math.round(c.spent),
      Math.round(c.paid),
      day(c.firstAt),
      day(c.lastAt),
      storeLabel(c),
    ]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...body()]);
    ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(12, Math.min(38, h.length + 6)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filtered.length} customer exported`);
  }

  const totals = useMemo(
    () => ({
      people: filtered.length,
      repeat: filtered.filter((c) => c.orders > 1).length,
      value: filtered.reduce((s, c) => s + c.spent, 0),
      received: filtered.reduce((s, c) => s + c.paid, 0),
    }),
    [filtered],
  );

  if (loading)
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Customers", value: totals.people.toLocaleString() },
          { label: "Repeat buyers", value: totals.repeat.toLocaleString() },
          { label: "Order value", value: bdt(totals.value) },
          { label: "Received (delivered)", value: bdt(totals.received) },
        ].map((s) => (
          <div key={s.label} className="surface-card p-3">
            <div className="text-[11px] font-medium text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 text-lg font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="surface-card flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, phone, city, address…"
            className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <SearchableSelect
          label="Type"
          value={bucket}
          onChange={setBucket}
          options={[
            { value: "all", label: "All customers" },
            { value: "new", label: "Single order" },
            { value: "repeat", label: "Repeat buyers" },
            { value: "delivered", label: "Has delivered order" },
            { value: "returned", label: "Has return/cancel" },
          ]}
          className="w-48"
        />
        {showStore && resellerNames && (
          <SearchableSelect
            label="Store"
            value={store}
            onChange={setStore}
            placeholder="All stores"
            options={Array.from(resellerNames.entries()).map(([id, label]) => ({ value: id, label }))}
            className="w-56"
          />
        )}
        {allowExport && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="btn-brand inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium"
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button
              onClick={() => downloadCsv("customers.csv", toCsv(HEADERS, body()))}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              <FileText className="h-4 w-4" /> CSV
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Customers appear here automatically once orders start coming in."
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 text-center font-semibold">Orders</th>
                <th className="px-3 py-2 text-right font-semibold">Order value</th>
                <th className="px-3 py-2 text-right font-semibold">Received</th>
                <th className="px-3 py-2 font-semibold">Last order</th>
                {showStore && <th className="px-3 py-2 font-semibold">Store</th>}
                <th className="px-3 py-2 text-right font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.phone} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </td>
                  <td className="max-w-[240px] px-3 py-2 text-xs text-muted-foreground">
                    <div className="truncate">{c.address}</div>
                    <div>
                      {c.city ? `${c.city} · ` : ""}
                      {c.area === "inside_dhaka" ? "Inside Dhaka" : c.area === "sub_dhaka" ? "Sub Dhaka" : "Outside Dhaka"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="font-semibold">{c.orders}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="text-success">{c.delivered}D</span> · <span className="text-destructive">{c.returned}R</span> ·{" "}
                      {c.pending}P
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{bdt(c.spent)}</td>
                  <td className="px-3 py-2 text-right">{bdt(c.paid)}</td>
                  <td className="px-3 py-2 text-xs">{day(c.lastAt)}</td>
                  {showStore && <td className="px-3 py-2 text-xs">{storeLabel(c)}</td>}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={`tel:${c.phone}`}
                        className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
                        aria-label="Call customer"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`https://wa.me/${normalizePhone(c.phone).replace(/^0/, "88")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
                        aria-label="WhatsApp customer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
