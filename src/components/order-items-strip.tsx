import { useState } from "react";
import { ChevronDown, ExternalLink, ShoppingCart, X } from "lucide-react";

export type StripItem = {
  id?: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price?: number | null;
  line_total?: number | null;
  image?: string | null;
  slug?: string | null;
};

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-background/90 p-2 text-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-xl border border-white/10 object-contain shadow-2xl animate-in zoom-in-95"
      />
    </div>
  );
}

/**
 * Full-width single-line product rows shown under an order row.
 * Two rows visible, the rest behind a "more" toggle.
 * Image click = zoom, title click = product page in the catalog.
 */
export function OrderItemsStrip({
  items,
  limit = 2,
  className = "",
}: {
  items: StripItem[];
  limit?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, limit);
  const hidden = items.length - visible.length;

  return (
    <div className={`divide-y divide-dashed border-t bg-muted/20 ${className}`}>
      {visible.map((it, idx) => {
        const unit = Number(it.unit_price ?? 0);
        const total = Number(it.line_total ?? unit * it.quantity);
        return (
          <div key={it.id ?? idx} className="flex w-full items-center gap-3 px-4 py-2">
            <button
              type="button"
              onClick={() => it.image && setZoom(it.image)}
              className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-background transition-transform hover:scale-105"
              title={it.image ? "Click to zoom" : undefined}
            >
              {it.image ? (
                <img src={it.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              {it.slug ? (
                <a
                  href={`/catalog/${it.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
                >
                  <span className="truncate">{it.product_name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
              ) : (
                <span className="block truncate text-xs font-semibold">{it.product_name}</span>
              )}
            </div>

            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary tabular-nums">
              x{it.quantity}
            </span>
            {unit > 0 && (
              <span className="hidden shrink-0 text-[11px] text-muted-foreground tabular-nums sm:inline">
                ৳{unit.toFixed(0)}
              </span>
            )}
            <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums">৳{total.toFixed(0)}</span>
          </div>
        );
      })}

      {items.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 px-4 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/5"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : `+${hidden} more product${hidden > 1 ? "s" : ""}`}
        </button>
      )}

      {zoom && <ImageLightbox src={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

/**
 * Compact product cell used inside an order list row.
 * Always renders exactly ONE product so the table row height stays stable.
 * The "+N more" chip toggles the row collapse (same action as the row chevron),
 * and the full item list is rendered inside that collapse via `OrderItemsList`.
 */
export function OrderProductCell({
  items,
  expanded,
  onZoom,
  onToggle,
}: {
  items: StripItem[];
  expanded: boolean;
  onZoom: (src: string) => void;
  onToggle?: () => void;
}) {
  const hidden = Math.max(items.length - 1, 0);

  if (items.length === 0) {
    return <span className="text-[10px] text-muted-foreground/60 italic">No items</span>;
  }

  const it = items[0]!;
  const unit = Number(it.unit_price ?? 0);

  return (
    <div className="min-w-0 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => it.image && onZoom(it.image)}
          className="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-background transition-transform hover:scale-105"
          title={it.image ? "Click to zoom" : undefined}
        >
          {it.image ? (
            <img src={it.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          {it.slug ? (
            <a
              href={`/catalog/${it.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
            >
              <span className="truncate">{it.product_name}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          ) : (
            <span className="block truncate text-xs font-semibold">{it.product_name}</span>
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums">
            x{it.quantity} {unit > 0 && <span className="ml-1">৳{unit.toFixed(0)}</span>}
          </span>
        </div>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary transition-colors hover:bg-primary/20"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Hide items" : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}

/** Full item list rendered inside an expanded order row. */
export function OrderItemsList({
  items,
  onZoom,
  className = "",
}: {
  items: StripItem[];
  onZoom: (src: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Products ({items.length})
      </h4>
      <div className="divide-y divide-dashed rounded-xl border bg-background">
        {items.map((it, idx) => {
          const unit = Number(it.unit_price ?? 0);
          const total = Number(it.line_total ?? unit * it.quantity);
          return (
            <div key={it.id ?? idx} className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                onClick={() => it.image && onZoom(it.image)}
                className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-background transition-transform hover:scale-105"
                title={it.image ? "Click to zoom" : undefined}
              >
                {it.image ? (
                  <img src={it.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                {it.slug ? (
                  <a
                    href={`/catalog/${it.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    <span className="truncate">{it.product_name}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                ) : (
                  <span className="block truncate text-xs font-semibold">{it.product_name}</span>
                )}
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  x{it.quantity} {unit > 0 && <span className="ml-1">৳{unit.toFixed(0)}</span>}
                </span>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums">৳{total.toFixed(0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

