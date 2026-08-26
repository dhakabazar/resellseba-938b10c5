import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ORDER_TABS, orderTabClasses, type OrderTabKey } from "@/lib/courier-status";

/**
 * Responsive order status tabs.
 * - Mobile: compact dropdown that sits inside the filter grid (lighter highlight).
 * - Desktop: wraps into multiple rows, never overflows horizontally.
 */
export function OrderTabs({
  tab,
  onChange,
  count,
  className = "mb-4 w-full min-w-0",
}: {
  tab: OrderTabKey;
  onChange: (key: OrderTabKey) => void;
  count: (key: OrderTabKey) => number;
  /** Override the outer wrapper margin when embedding inside a grid. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = ORDER_TABS.find((t) => t.key === tab);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className={className}>
      {/* Mobile: compact dropdown styled like other filter selects */}
      <div ref={ref} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <span className="min-w-0 truncate font-medium">
            {active?.label ?? "Orders"}
            <span className="ml-1.5 text-xs text-muted-foreground">{count(tab)}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute left-0 z-40 mt-1 w-[min(100vw-2rem,360px)] min-w-full rounded-md border bg-popover p-2 shadow-lg">
            <div className="grid max-h-[60vh] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain">
              {ORDER_TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      onChange(t.key);
                      setOpen(false);
                    }}
                    className={`min-w-0 rounded-md border px-2 py-1.5 text-center text-xs transition-colors ${orderTabClasses(t.key, isActive)}`}
                  >
                    <span className="block truncate font-medium">{t.label}</span>
                    <span className="text-[10px] opacity-70">{count(t.key)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: wrapping buttons */}
      <div className="hidden flex-wrap gap-2 sm:flex">
        {ORDER_TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`min-w-0 rounded-md border px-2.5 py-1.5 text-center text-xs transition-colors sm:px-3 sm:text-sm ${orderTabClasses(
                t.key,
                isActive,
              )}`}
            >
              <span className="truncate font-medium">{t.label}</span>
              <span className={`ml-1.5 text-[11px] ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                {count(t.key)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
