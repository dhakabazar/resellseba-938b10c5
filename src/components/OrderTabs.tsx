import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { ORDER_TABS, orderTabClasses, orderTabGroup, type OrderTabKey } from "@/lib/courier-status";

/** Light tint classes for the mobile status dropdown, based on the active tab's group. */
function tabTint(key: OrderTabKey): string {
  const group = orderTabGroup(key);
  if (group === "delivered") return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (group === "partial") return "bg-amber-50 border-amber-200 text-amber-700";
  if (group === "terminal") return "bg-rose-50 border-rose-200 text-rose-700";
  return "bg-blue-50 border-blue-200 text-blue-700";
}

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
  highlight = false,
}: {
  tab: OrderTabKey;
  onChange: (key: OrderTabKey) => void;
  count: (key: OrderTabKey) => number;
  /** Override the outer wrapper margin when embedding inside a grid. */
  className?: string;
  /** When true, the mobile dropdown button gets a light tint based on the active tab's group. */
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const active = ORDER_TABS.find((t) => t.key === tab);

  const updateMenuPosition = () => {
    const trigger = ref.current?.getBoundingClientRect();
    if (!trigger || typeof window === "undefined") return;

    const margin = 16;
    const gap = 6;
    const desiredWidth = Math.min(window.innerWidth - margin * 2, 360);
    const width = Math.max(trigger.width, desiredWidth);
    const left = Math.min(
      Math.max(margin, trigger.right - width),
      window.innerWidth - width - margin,
    );
    const availableBelow = window.innerHeight - trigger.bottom - margin;
    const availableAbove = trigger.top - margin;
    const openUp = availableBelow < 260 && availableAbove > availableBelow;
    const maxHeight = Math.max(180, Math.min(360, openUp ? availableAbove - gap : availableBelow - gap));
    const top = openUp ? trigger.top - gap - maxHeight : trigger.bottom + gap;

    setMenuPosition({ top, left, width, maxHeight });
  };

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

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <div className={className}>
      {/* Mobile: compact dropdown styled like other filter selects */}
      <div ref={ref} className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-ring ${highlight ? tabTint(tab) : "bg-background"}`}
        >
          <span className="min-w-0 truncate font-medium">
            {active?.label ?? "Orders"}
            <span className="ml-1.5 text-xs opacity-70">{count(tab)}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && menuPosition && createPortal(
          <div
            className="fixed z-[100] rounded-md border bg-popover p-2 shadow-lg"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
          >
            <div
              className="grid grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain"
              style={{ maxHeight: menuPosition.maxHeight }}
            >
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
          </div>,
          document.body,
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
