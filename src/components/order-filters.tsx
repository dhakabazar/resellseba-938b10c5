import { useMemo } from "react";
import { Search, X, SlidersHorizontal, CalendarDays } from "lucide-react";
import { FilterOption } from "@/components/data-list";
import { SearchableSelect } from "@/components/searchable-select";

export type DatePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "lifetime"
  | "custom";

/** Global order-list filter state — same shape for SA admin & reseller panels. */
export type OrderFilterState = {
  q: string;
  reseller: string;
  datePreset: DatePreset;
  from: string;
  to: string;
  sort: "newest" | "oldest" | "updated" | "high" | "low";
  area: string;
  courier: string;
  perPage: number;
};

export const DEFAULT_ORDER_FILTERS: OrderFilterState = {
  q: "",
  reseller: "",
  datePreset: "lifetime",
  from: "",
  to: "",
  sort: "newest",
  area: "",
  courier: "",
  perPage: 20,
};

export const AREA_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All areas" },
  { value: "inside_dhaka", label: "Inside Dhaka" },
  { value: "sub_dhaka", label: "Sub Dhaka" },
  { value: "outside_dhaka", label: "Outside Dhaka" },
];

export const COURIER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All couriers" },
  { value: "steadfast", label: "Steadfast" },
  { value: "pathao", label: "Pathao" },
  { value: "carrybee", label: "Carrybee" },
  { value: "none", label: "Not booked" },
];

export const DATE_PRESET_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "lifetime", label: "Life time" },
  { value: "custom", label: "Custom range" },
];

const SORT_OPTIONS: { value: OrderFilterState["sort"]; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "high", label: "Amount: high → low" },
  { value: "low", label: "Amount: low → high" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

/** Resolve a preset (or custom range) into a timestamp window. */
export function resolveDateRange(f: OrderFilterState): { fromTs: number | null; toTs: number | null } {
  const now = new Date();
  switch (f.datePreset) {
    case "today":
      return { fromTs: startOfDay(now), toTs: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { fromTs: startOfDay(y), toTs: endOfDay(y) };
    }
    case "last7": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { fromTs: startOfDay(s), toTs: endOfDay(now) };
    }
    case "last30": {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { fromTs: startOfDay(s), toTs: endOfDay(now) };
    }
    case "this_month":
      return {
        fromTs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        toTs: endOfDay(now),
      };
    case "last_month":
      return {
        fromTs: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
        toTs: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime(),
      };
    case "this_year":
      return { fromTs: new Date(now.getFullYear(), 0, 1).getTime(), toTs: endOfDay(now) };
    case "last_year":
      return {
        fromTs: new Date(now.getFullYear() - 1, 0, 1).getTime(),
        toTs: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime(),
      };
    case "custom":
      return {
        fromTs: f.from ? new Date(`${f.from}T00:00:00`).getTime() : null,
        toTs: f.to ? new Date(`${f.to}T23:59:59`).getTime() : null,
      };
    default:
      return { fromTs: null, toTs: null };
  }
}

type FilterableOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_line?: string | null;
  total: number | string;
  created_at: string;
  reseller_id?: string | null;
  resellers?: { business_name: string; code: string } | null;
};

/** Shared filter + sort logic so admin & reseller lists behave identically. */
export function applyOrderFilters<T extends FilterableOrder>(rows: T[], f: OrderFilterState): T[] {
  const q = f.q.trim().toLowerCase();
  const { fromTs, toTs } = resolveDateRange(f);

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
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={"flex min-w-0 flex-col gap-1 " + className}>
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
  showPerPage = false,
  variant = "default",
}: {
  value: OrderFilterState;
  onChange: (next: OrderFilterState) => void;
  /** Pass reseller list only for SA admin — reseller panel never sees it. */
  resellerOptions?: FilterOption[];
  total: number;
  shown: number;
  right?: React.ReactNode;
  /** Show the per-page selector inline (report pages that have no separate one). */
  showPerPage?: boolean;
  /** Report layout: search takes 40%, filters take 60% and are more compact. */
  variant?: "default" | "report";
}) {
  const set = (patch: Partial<OrderFilterState>) => onChange({ ...value, ...patch });
  const dirty = useMemo(
    () =>
      value.q !== "" ||
      value.reseller !== "" ||
      value.datePreset !== "lifetime" ||
      value.sort !== "newest",
    [value],
  );

  const isReport = variant === "report";

  return (
    <div className="surface-card mb-4 space-y-3 p-3 sm:p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <div className={`relative min-w-0 lg:pb-[1px] ${isReport ? "lg:w-[40%]" : "flex-1"}`}>
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

        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:shrink-0 lg:items-end ${isReport ? "lg:w-[60%]" : ""}`}>
          {resellerOptions && (
            <SearchableSelect
              label="Reseller"
              options={resellerOptions.map((r) => ({ value: r.value, label: r.label }))}
              value={value.reseller}
              onChange={(v) => set({ reseller: v })}
              placeholder="All resellers"
              searchPlaceholder="Search reseller…"
              className={isReport ? "lg:w-[170px]" : "lg:w-[190px]"}
            />
          )}

          <Select
            label="Date"
            value={value.datePreset}
            className={isReport ? "lg:w-[120px]" : "lg:w-[150px]"}
            onChange={(v) =>
              set(
                v === "custom"
                  ? { datePreset: "custom" }
                  : { datePreset: v as DatePreset, from: "", to: "" },
              )
            }
          >
            {DATE_PRESET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Sort"
            value={value.sort}
            className={isReport ? "lg:w-[140px]" : "lg:w-[170px]"}
            onChange={(v) => set({ sort: v as OrderFilterState["sort"] })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {showPerPage && (
            <Select
              label="Per page"
              value={String(value.perPage)}
              className={isReport ? "lg:w-[80px]" : "lg:w-[92px]"}
              onChange={(v) => set({ perPage: Number(v) })}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={-1}>All</option>
            </Select>
          )}
        </div>
        {right}
      </div>


      {value.datePreset === "custom" && (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed p-2 sm:max-w-md">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> From
            </span>
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> To
            </span>
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      )}

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
