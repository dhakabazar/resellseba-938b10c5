import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Flame, ShoppingBag, ShoppingBasket } from "lucide-react";
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

  /* Bazaar — marketplace ribbon: colored bar + uppercase label */
  if (theme.id === "bazaar")
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1.5 rounded-full bg-[var(--st-primary)]" />
          <div>
            <Heading className="text-lg font-extrabold uppercase tracking-wide md:text-xl">{title}</Heading>
            {subtitle && <p className={cx("text-[12px]", muted)}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    );

  /* Noir — centered, hairline rules, wide letterspacing */
  if (theme.id === "noir")
    return (
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 h-px w-16 bg-[var(--st-primary)]" />
        <Heading className="text-2xl md:text-3xl">{title}</Heading>
        {subtitle && (
          <p className={cx("mx-auto mt-2 max-w-xl text-[11px] uppercase tracking-[0.28em]", muted)}>{subtitle}</p>
        )}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    );

  /* সহজ শপ — bold heading, last word in the brand color, action on the right */
  if (theme.id === "atelier") {
    const words = title.trim().split(" ");
    const last = words.length > 1 ? words.pop()! : "";
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Heading className="text-xl font-extrabold leading-tight md:text-2xl">
          {words.join(" ")} {last && <span className="text-[var(--st-primary)]">{last}</span>}
        </Heading>
        {action}
      </div>
    );
  }


  /* Aurora — soft modern with a gradient underline */
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Heading className="text-xl md:text-2xl">{title}</Heading>
        <span
          className="mt-2 block h-1 w-12 rounded-full"
          style={{ background: "linear-gradient(90deg, var(--st-primary), var(--st-accent))" }}
        />
        {subtitle && <p className={cx("mt-2 text-sm", muted)}>{subtitle}</p>}
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

/** Deterministic "sold" count so the social proof never jumps between renders. */
function soldCount(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 200) + 15;
}

export function ProductCard({ listing }: { listing: StoreListing }) {
  const { code, theme, title, image, content, url } = useStore();
  const img = image(listing);
  const p = listing.product!;
  const free = resolveDelivery(p).mode === "free";
  const sold = useMemo(() => soldCount(p.id), [p.id]);
  const price = Number(listing.selling_price);
  const to = { to: url(`/p/${p.slug}`) };

  const Img = ({ className }: { className?: string }) =>
    img ? (
      <img
        src={img}
        alt={title(listing)}
        loading="lazy"
        className={cx("h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.07]", className)}
      />
    ) : (
      <div className={cx("grid h-full w-full place-items-center text-xs", muted)}>No image</div>
    );

  /* ---------------------------------------------- Bazaar: dense deal card */
  if (theme.id === "bazaar")
    return (
      <Link
        {...to}
        className={cx(
          "group flex flex-col overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] transition-shadow hover:shadow-lg",
          borderc,
        )}
      >
        <div className="relative aspect-square overflow-hidden bg-[var(--st-bg-alt)]">
          <Img />
          {free && (
            <span className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-center text-[10px] font-bold uppercase text-white">
              Free delivery
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-2.5">
          <h3 className="line-clamp-2 text-[13px] leading-snug text-[var(--st-fg)]">{title(listing)}</h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Price value={price} className="text-base font-extrabold" />
          </div>
          <div className={cx("mt-1 flex items-center gap-1 text-[10px] font-semibold", muted)}>
            <Flame className="h-3 w-3 text-[var(--st-primary)]" /> {sold} sold
          </div>
          <span className="mt-2 block rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] py-2 text-center text-[12px] font-bold text-[var(--st-on-primary)]">
            Order now
          </span>
        </div>
      </Link>
    );

  /* ------------------------------------------------- Noir: gallery frame */
  if (theme.id === "noir")
    return (
      <Link {...to} className="group block">
        <div className={cx("relative aspect-[3/4] overflow-hidden border bg-[var(--st-bg-alt)]", borderc)}>
          <Img className="opacity-95 group-hover:opacity-100" />
          <span className="absolute inset-x-0 bottom-0 translate-y-full bg-[var(--st-primary)] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--st-on-primary)] transition-transform duration-300 group-hover:translate-y-0">
            Order now
          </span>
        </div>
        <h3
          className="mt-4 line-clamp-2 text-[13px] uppercase tracking-[0.16em] text-[var(--st-fg)]"
          style={{ fontFamily: "var(--st-font-body)" }}
        >
          {title(listing)}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          <Price value={price} className="text-sm tracking-widest" />
        </div>
        <div className={cx("mt-1 text-[10px] uppercase tracking-[0.22em]", muted)}>{sold} sold</div>
      </Link>
    );

  /* --------------------------- সহজ শপ: বাংলা ডিল কার্ড, বড় অর্ডার বাটন */
  if (theme.id === "atelier") {
    const label = free
      ? content.text("sohoj_free_label") || "ফ্রী ডেলিভারিতে অর্ডার করুন"
      : content.text("sohoj_order_label") || "অর্ডার করুন";
    return (
      <Link
        {...to}
        className={cx(
          "group flex flex-col overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(0,0,0,0.45)]",
          borderc,
        )}
      >
        <div className="relative aspect-square overflow-hidden bg-[var(--st-bg-alt)]">
          <Img />
          {free && (
            <span className="absolute left-2 top-2 rounded-md bg-[#e11d48] px-2 py-1 text-[10px] font-extrabold leading-none text-white shadow-sm">
              ফ্রি ডেলিভারি
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--st-fg)]">{title(listing)}</h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Price value={price} className="text-[16px] font-extrabold" />
          </div>
          <div className={cx("mt-0.5 text-[11px]", muted)}>{sold} জন কিনেছেন</div>
        </div>
        <span
          className={cx(
            "flex items-center justify-center gap-1.5 px-2 py-2.5 text-center text-[12px] font-bold leading-snug text-white",
            free ? "bg-[#0f8a4d]" : "bg-[var(--st-primary)]",
          )}
        >
          <ShoppingBasket className="h-3.5 w-3.5 shrink-0" /> {label}
        </span>
      </Link>
    );
  }


  /* --------------------------------------------------- Aurora: soft card */
  return (
    <Link
      {...to}
      className="group block overflow-hidden rounded-[var(--st-radius)] border border-transparent bg-[var(--st-surface)] shadow-[var(--st-shadow)] transition-all hover:-translate-y-1 hover:border-[var(--st-primary)]/40"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--st-bg-alt)]">
        <Img />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          {free && (
            <span className="rounded-full bg-[var(--st-accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--st-on-accent)]">
              Free delivery
            </span>
          )}
        </div>
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <ShoppingBag className="h-2.5 w-2.5" /> {sold} sold
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm text-[var(--st-fg)]">{title(listing)}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <Price value={price} className="text-base" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={cx("text-[11px]", muted)}>{free ? "Cash on delivery" : deliveryLabel(p)}</span>
          <span className="rounded-full bg-[var(--st-primary)]/12 px-3 py-1 text-[11px] font-semibold text-[var(--st-primary)] transition-colors group-hover:bg-[var(--st-primary)] group-hover:text-[var(--st-on-primary)]">
            Order now
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ listings }: { listings: StoreListing[] }) {
  const { theme } = useStore();
  const cols =
    theme.id === "bazaar"
      ? "grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      : theme.id === "noir"
        ? "grid-cols-2 gap-5 md:gap-8 lg:grid-cols-4"
        : theme.id === "atelier"
          ? "grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"

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
