import { useState, type ReactNode } from "react";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FilterOption = { value: string; label: string };
export type FilterDef = {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: FilterOption[];
};

export function DataToolbar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  filters = [],
  perPage,
  onPerPage,
  perPageOptions = [10, 20, 50, 100],
  right,
  inline = false,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  perPage: number;
  onPerPage: (n: number) => void;
  perPageOptions?: number[];
  right?: ReactNode;
  inline?: boolean;
}) {
  const searchInput = (
    <input
      value={search}
      onChange={(e) => onSearch(e.target.value)}
      placeholder={searchPlaceholder}
      className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  );

  const perPageSelect = (
    <select
      value={perPage}
      onChange={(e) => onPerPage(Number(e.target.value))}
      className="shrink-0 rounded-md border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      title="Per page"
    >
      {perPageOptions.map((n) => (
        <option key={n} value={n}>
          {n} / page
        </option>
      ))}
      <option value={-1}>All</option>
    </select>
  );

  const filterSelects = filters.map((f) => (
    <select
      key={f.key}
      value={f.value}
      onChange={(e) => f.onChange(e.target.value)}
      className="min-w-[120px] rounded-md border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      title={f.label}
    >
      <option value="">{f.label}: All</option>
      {f.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ));

  if (inline) {
    return (
      <div className="mb-4">
        <div className="flex flex-col gap-2 md:grid md:grid-cols-[40%_1fr] md:items-center">
          {searchInput}
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {filterSelects.map((s) => (
              <div key={s.key} className="min-w-[120px] flex-1">
                {s}
              </div>
            ))}
            {perPageSelect}
            {right}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        {searchInput}
        <div className="flex shrink-0 items-center gap-2">
          {perPageSelect}
          {right}
        </div>
      </div>
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filterSelects}
        </div>
      )}
    </div>
  );
}

function pageWindow(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const showAll = perPage <= 0;
  const effectivePer = showAll ? Math.max(total, 1) : perPage;
  const pages = Math.max(1, Math.ceil(total / effectivePer));
  const from = total === 0 ? 0 : showAll ? 1 : (page - 1) * perPage + 1;
  const to = showAll ? total : Math.min(page * perPage, total);
  const [goTo, setGoTo] = useState("");
  const current = Math.min(Math.max(1, page), pages);

  const go = (p: number) => onPage(Math.min(pages, Math.max(1, p)));
  const submitGoTo = () => {
    const n = Number.parseInt(goTo, 10);
    if (Number.isFinite(n)) go(n);
    setGoTo("");
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      {!showAll && pages > 1 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => go(current - 1)}
              disabled={current <= 1}
              title="Previous"
              className="inline-flex h-8 items-center rounded-md border px-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageWindow(current, pages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => go(p)}
                  aria-current={p === current ? "page" : undefined}
                  className={
                    p === current
                      ? "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-primary bg-primary px-2 font-medium text-primary-foreground"
                      : "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 hover:bg-muted"
                  }
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => go(current + 1)}
              disabled={current >= pages}
              title="Next"
              className="inline-flex h-8 items-center rounded-md border px-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="whitespace-nowrap">Go to</span>
            <input
              type="number"
              min={1}
              max={pages}
              value={goTo}
              onChange={(e) => setGoTo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitGoTo();
                }
              }}
              placeholder={String(current)}
              className="h-8 w-16 rounded-md border bg-background px-2 text-center text-foreground"
            />
            <button
              onClick={submitGoTo}
              disabled={!goTo}
              className="inline-flex h-8 items-center rounded-md border px-2 hover:bg-muted disabled:opacity-40"
            >
              Go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export function ActionMenu({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          title="Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function usePaginated<T>(items: T[], page: number, perPage: number) {
  if (perPage <= 0) return items;
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
