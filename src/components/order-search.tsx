import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export type OrderSearchMode = "order" | "product";

/** One merged search box: mode select sits inside the input shell. */
export function OrderSearch({
  mode,
  onMode,
  value,
  onChange,
  className = "",
  products,
}: {
  products?: { product_name: string; product_image?: string | null; order_id: string }[];
  mode: OrderSearchMode;
  onMode: (m: OrderSearchMode) => void;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (mode !== "product" || !q || !products) return [];
    const m = new Map<string, { name: string; image: string | null; orders: Set<string> }>();
    for (const it of products) {
      if (!it.product_name?.toLowerCase().includes(q)) continue;
      const e = m.get(it.product_name) ?? { name: it.product_name, image: it.product_image ?? null, orders: new Set<string>() };
      if (!e.image && it.product_image) e.image = it.product_image;
      e.orders.add(it.order_id);
      m.set(it.product_name, e);
    }
    return [...m.values()].sort((a, b) => b.orders.size - a.orders.size).slice(0, 8);
  }, [mode, value, products]);
  const show = open && suggestions.length > 0 && !(suggestions.length === 1 && suggestions[0].name === value);
  return (
    <div
      className={`relative flex h-10 min-w-[260px] flex-1 items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring ${className}`}
    >
      <select
        value={mode}
        onChange={(e) => onMode(e.target.value as OrderSearchMode)}
        className="h-full shrink-0 rounded-l-md border-0 border-r bg-muted/40 px-2 text-xs font-medium outline-none"
        title="Search type"
      >
        <option value="order">Order search</option>
        <option value="product">Product search</option>
      </select>
      <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          mode === "product" ? "Product name…" : "Order no / customer name / mobile…"
        }
        className="h-full w-full bg-transparent px-2 text-sm outline-none"
      />
      {show && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          {suggestions.map((sg) => (
            <button
              key={sg.name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(sg.name); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
            >
              {sg.image ? (
                <img src={sg.image} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-7 w-7 shrink-0 rounded bg-muted" />
              )}
              <span className="min-w-0 flex-1 truncate">{sg.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{sg.orders.size} orders</span>
            </button>
          ))}
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mr-2 rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
