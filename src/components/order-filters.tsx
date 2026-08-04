import { useMemo } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { FilterOption } from "@/components/data-list";

/** Global order-list filter state — same shape for SA admin & reseller panels. */
export type OrderFilterState = {
  q: string;
  paymentMethod: string;
  paymentStatus: string;
  reseller: string;
  from: string;
  to: string;
  sort: "newest" | "oldest" | "high" | "low";
  perPage: number;
};

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  q: "",
  paymentMethod: "",
  paymentStatus: "",
  reseller: "",
  from: "",
  to: "",
  sort: "newest",
  perPage: 20,
};

export const PAYMENT_METHOD_OPTIONS: FilterOption[] = [
  { value: "cod", label: "Cash on Delivery" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "card", label: "Card" },
  { value: "sslcommerz", label: "SSLCommerz" },
  { value: "eps", label: "EPS" },
  { value: "other", label: "Other" },
];

export const PAYMENT_STATUS_OPTIONS: FilterOption[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
];

const SORT_OPTIONS: { value: OrderFilterState["sort"]; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "high", label: "Amount: high → low" },
  { value: "low", label: "Amount: low → high" },
];

type FilterableOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line?: string | null;
  total: number | string;
  payment_method?: string | null;
  payment_status?: string | null;
  created_at: string;
  reseller_id?: string | null;
  resellers?: { business_name: string; code: string } | null;
};

/** Shared filter + sort logic so admin & reseller lists behave identically. */
export function applyOrderFilters<T extends FilterableOrder>(rows: T[], f: OrderFilterState): T[] {
  const q = f.q.trim().toLowerCase();
  const fromTs = f.from ? new Date(`${f.from}T00:00:00`).getTime() : null;
  const toTs = f.to ? new Date(`${f.to}T23:59:59`).getTime() : null;

  const out = rows.filter((o) => {
    if (q) {
      const hay = [
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.address_line ?? "",
        o.resellers?.business_name ?? "",
        o.resellers?.code ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.paymentMethod && o.payment_method !== f.paymentMethod) return false;
    if (f.paymentStatus && o.payment_status !== f.paymentStatus) return false;
    if (f.reseller && o.reseller_id !== f.reseller) return false;
    const ts = new Date(o.created_at).getTime();
    if (fromTs != null && ts < fromTs) return false;
    if (toTs != null && ts > toTs) return false;
    return true;
  });

  return out.sort((a, b) => {
    if (f.sort === "high" || f.sort === "low") {
      const diff = Number(a.total) - Number(b.total);
      return f.sort === "high" ? -diff : diff;
    }
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return f.sort === "oldest" ? diff : -diff;
  });
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {children}
      </select>
    </label>
  );
}

/**
 * Global order filter bar. Used by both SA admin and reseller order pages so
 * the UI/behaviour stays identical everywhere.
 */
export function OrderFilterBar({
  value,
  onChange,
  resellerOptions,
  total,
  shown,
  right,
}: {
  value: OrderFilterState;
  onChange: (next: OrderFilterState) => void;
  /** Pass reseller list only for SA admin — reseller panel never sees it. */
  resellerOptions?: FilterOption[];
  total: number;
  shown: number;
  right?: React.ReactNode;
}) {
  const set = (patch: Partial<OrderFilterState>) => onChange({ ...value, ...patch });
  const dirty = useMemo(
    () =>
      value.q !== "" ||
      value.paymentMethod !== "" ||
      value.paymentStatus !== "" ||
      value.reseller !== "" ||
      value.from !== "" ||
      value.to !== "" ||
      value.sort !== "newest",
    [value],
  );

  return (
    <div className="surface-card mb-4 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={value.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Order no, customer name, phone, address…"
            className="h-9 w-full rounded-md border bg-background pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {value.q && (
            <button
              type="button"
              onClick={() => set({ q: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {right}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {resellerOptions && (
          <Select label="Reseller" value={value.reseller} onChange={(v) => set({ reseller: v })}>
            <option value="">All resellers</option>
            {resellerOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        )}
        <Select label="Payment method" value={value.paymentMethod} onChange={(v) => set({ paymentMethod: v })}>
          <option value="">All methods</option>
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Payment status" value={value.paymentStatus} onChange={(v) => set({ paymentStatus: v })}>
          <option value="">All payments</option>
          {PAYMENT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">From</span>
          <input
            type="date"
            value={value.from}
            onChange={(e) => set({ from: e.target.value })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">To</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => set({ to: e.target.value })}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <Select label="Sort" value={value.sort} onChange={(v) => set({ sort: v as OrderFilterState["sort"] })}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Per page" value={String(value.perPage)} onChange={(v) => set({ perPage: Number(v) })}>
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
          <option value={-1}>All</option>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {shown} of {total} order{total === 1 ? "" : "s"}
        </span>
        {dirty && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_ORDER_FILTERS, perPage: value.perPage })}
            className="rounded-md border px-2 py-1 hover:bg-accent"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
