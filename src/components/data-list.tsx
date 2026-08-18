import { type ReactNode } from "react";
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
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  perPage: number;
  onPerPage: (n: number) => void;
  perPageOptions?: number[];
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="rounded-md border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            title="Per page"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
            <option value={-1}>All</option>
          </select>
          {right}
        </div>
      </div>
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="rounded-md border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              title={f.label}
            >
              <option value="">{f.label}: All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
    </div>
  );
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
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {from}–{to} of {total}
      </span>
      {!showAll && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="inline-flex items-center rounded-md border px-2 py-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2">
            {page} / {pages}
          </span>
          <button
            onClick={() => onPage(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="inline-flex items-center rounded-md border px-2 py-1 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
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
