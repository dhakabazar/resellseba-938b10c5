import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ORDER_TABS, orderTabClasses, type OrderTabKey } from "@/lib/courier-status";

/**
 * Responsive order status tabs.
 * - Desktop: wraps into multiple rows, never overflows horizontally.
 * - Mobile: collapsible section showing only the active tab until expanded.
 */
export function OrderTabs({
  tab,
  onChange,
  count,
}: {
  tab: OrderTabKey;
  onChange: (key: OrderTabKey) => void;
  count: (key: OrderTabKey) => number;
}) {
  const [open, setOpen] = useState(false);
  const active = ORDER_TABS.find((t) => t.key === tab);

  return (
    <div className="mb-4 w-full min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm sm:hidden"
      >
        <span className="min-w-0 truncate font-medium">
          {active?.label ?? "Orders"}
          <span className="ml-1.5 text-xs text-muted-foreground">{count(tab)}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div
        className={`${open ? "grid" : "hidden"} grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap`}
      >
        {ORDER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              onChange(t.key);
              setOpen(false);
            }}
            className={`min-w-0 rounded-md border px-2.5 py-1.5 text-center text-xs sm:px-3 sm:text-sm ${
              tab === t.key ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-accent"
            }`}
          >
            <span className="truncate">{t.label}</span>
            <span className="ml-1.5 text-[11px] text-muted-foreground">{count(t.key)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
