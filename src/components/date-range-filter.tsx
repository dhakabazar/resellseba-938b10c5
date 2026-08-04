import { CalendarDays } from "lucide-react";
import {
  DATE_PRESET_OPTIONS,
  DEFAULT_ORDER_FILTERS,
  resolveDateRange,
  type DatePreset,
} from "@/components/order-filters";

/** Global date-range state shared by every dashboard / report page. */
export type DateRangeState = {
  preset: DatePreset;
  from: string;
  to: string;
};

export const DEFAULT_DATE_RANGE: DateRangeState = { preset: "last30", from: "", to: "" };

/** Same preset math as the order filter bar — single source of truth. */
export function resolveRange(v: DateRangeState) {
  return resolveDateRange({ ...DEFAULT_ORDER_FILTERS, datePreset: v.preset, from: v.from, to: v.to });
}

export function inRange(createdAt: string, v: DateRangeState) {
  const { fromTs, toTs } = resolveRange(v);
  const ts = new Date(createdAt).getTime();
  if (fromTs != null && ts < fromTs) return false;
  if (toTs != null && ts > toTs) return false;
  return true;
}

const fmt = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function rangeLabel(v: DateRangeState) {
  const { fromTs, toTs } = resolveRange(v);
  if (fromTs == null && toTs == null) return "Life time";
  if (fromTs != null && toTs != null) {
    const a = fmt(fromTs);
    const b = fmt(toTs);
    return a === b ? a : `${a} → ${b}`;
  }
  return fromTs != null ? `From ${fmt(fromTs)}` : `Until ${fmt(toTs!)}`;
}

/** Chip-style smart date filter. Works on mobile (scrolls) and desktop. */
export function DateRangeBar({
  value,
  onChange,
  right,
  note,
}: {
  value: DateRangeState;
  onChange: (v: DateRangeState) => void;
  right?: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="surface-card mb-6 space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" /> {rangeLabel(value)}
        </span>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max items-center gap-1.5">
          {DATE_PRESET_OPTIONS.map((o) => {
            const on = o.value === value.preset;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(
                    o.value === "custom"
                      ? { ...value, preset: "custom" }
                      : { preset: o.value, from: "", to: "" },
                  )
                }
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {value.preset === "custom" && (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-dashed p-2 sm:max-w-md">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">From</span>
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">To</span>
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      )}

      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
