import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ShoppingBag } from "lucide-react";
import { bdt } from "@/lib/store-cart";
import { deliveryLabel, resolveDelivery } from "@/lib/delivery";
import { useStore, type StoreListing } from "./store-context";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Shared surface / text helpers driven by theme CSS vars. */
export const surface = "bg-[var(--st-surface)] text-[var(--st-fg)]";
export const muted = "text-[var(--st-muted)]";
export const borderc = "border-[var(--st-border)]";

export function Heading({
  children,
  className,
  as: As = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <As
      className={cx("text-[var(--st-fg)]", className)}
      style={{
        fontFamily: "var(--st-font-head)",
        fontWeight: "var(--st-head-weight)" as unknown as number,
        letterSpacing: "var(--st-track)",
      }}
    >
      {children}
    </As>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { theme } = useStore();
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Heading className={theme.layout.card === "bare" ? "text-3xl md:text-4xl" : "text-xl md:text-2xl"}>
          {title}
        </Heading>
        {subtitle && <p className={cx("mt-1 text-sm", muted)}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0",
        "rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] text-[var(--st-on-primary)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 border px-5 py-3 text-sm font-medium",
        "rounded-[var(--st-radius-sm)]",
        borderc,
        "hover:bg-[var(--st-bg-alt)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cx("text-[var(--st-primary)]", className)}
      style={{ fontFamily: "var(--st-font-head)", fontWeight: "var(--st-head-weight)" as unknown as number }}
    >
      {bdt(value)}
    </span>
  );
}

export function ProductCard({ listing }: { listing: StoreListing }) {
  const { code, theme, title, image } = useStore();
  const variant = theme.layout.card;
  const img = image(listing);
  const p = listing.product!;
  const free = resolveDelivery(p).mode === "free";

  const shell =
    variant === "soft"
      ? "rounded-[var(--st-radius)] bg-[var(--st-surface)] shadow-[var(--st-shadow)] border border-transparent hover:border-[var(--st-primary)]/40"
      : variant === "frame"
        ? "rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-surface)] hover:border-[var(--st-primary)]"
        : variant === "compact"
          ? "rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-surface)]"
          : "bg-transparent";

  const saleCount = useMemo(() => {
    // Basic deterministic hash from product id for consistent visual sale counts
    let hash = 0;
    const str = p.id;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash % 200) + 15;
  }, [p.id]);

  return (
    <Link
      to="/s/$code/p/$slug"
      params={{ code, slug: p.slug }}
      className={cx("group block overflow-hidden transition-all", shell, variant === "bare" && "hover:opacity-90")}
    >
      <div
        className={cx(
          "relative overflow-hidden bg-[var(--st-bg-alt)]",
          variant === "bare" ? "aspect-[4/5] rounded-[var(--st-radius)]" : "aspect-square",
        )}
      >
        {img ? (
          <img
            src={img}
            alt={title(listing)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className={cx("grid h-full w-full place-items-center text-xs", muted)}>No image</div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1.5">
          {free && (
            <span className="rounded-full bg-[var(--st-primary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--st-on-primary)]">
              Free delivery
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-bold text-white">
            <ShoppingBag className="h-2.5 w-2.5" /> {saleCount} Sold
          </span>
        </div>
      </div>

      <div className={cx(variant === "bare" ? "pt-3" : variant === "compact" ? "p-2.5" : "p-4")}>
        <h3
          className={cx(
            "line-clamp-2 text-[var(--st-fg)]",
            variant === "compact" ? "text-[13px] leading-snug" : "text-sm",
            variant === "bare" && "text-base",
          )}
          style={variant === "bare" ? { fontFamily: "var(--st-font-head)" } : undefined}
        >
          {title(listing)}
        </h3>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <Price value={Number(listing.selling_price)} className={variant === "compact" ? "text-sm" : "text-base"} />
          {!free && variant !== "compact" && (
            <span className={cx("text-[11px]", muted)}>{deliveryLabel(p)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ listings }: { listings: StoreListing[] }) {
  const { theme } = useStore();
  const cols =
    theme.layout.grid === "dense"
      ? "grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      : theme.layout.grid === "airy"
        ? "grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4";
  return (
    <div className={cx("grid", cols)}>
      {listings.map((l) => (
        <ProductCard key={l.id} listing={l} />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={cx("grid place-items-center rounded-[var(--st-radius)] border border-dashed py-24 text-center", borderc)}>
      <div>
        <Heading className="text-lg">{title}</Heading>
        {hint && <p className={cx("mt-1 text-sm", muted)}>{hint}</p>}
      </div>
    </div>
  );
}
