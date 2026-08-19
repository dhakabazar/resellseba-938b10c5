import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export type SearchOption = { value: string; label: string };

/**
 * Global searchable dropdown. Used for every reseller filter (and any other
 * long option list) so the behaviour and look stay identical everywhere.
 * Mobile: full-width trigger + panel that never overflows the viewport.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "All",
  searchPlaceholder = "Search…",
  className,
  align = "start",
}: {
  options: SearchOption[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
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
    if (!open) setQ("");
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, q]);

  const selected = options.find((o) => o.value === value);

  const trigger = (
    <div ref={boxRef} className="relative min-w-0 w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        title={label ?? placeholder}
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>
      {open && (
        <div
          className={`absolute z-40 mt-1 w-[min(320px,calc(100vw-2rem))] min-w-full rounded-md border bg-popover p-2 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-2 flex items-center gap-2 rounded-md border px-2">
            <Search className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full bg-transparent text-sm outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="rounded p-0.5 hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${!value ? "bg-muted font-medium" : ""}`}
            >
              {placeholder}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                  value === o.value ? "bg-muted font-medium" : ""
                }`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">Nothing found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-w-0 ${className ?? "w-full"}`}>
      {label && (
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      )}
      {trigger}
    </div>
  );
}
