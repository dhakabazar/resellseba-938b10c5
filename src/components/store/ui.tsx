import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, ShoppingBag, ShoppingBasket } from "lucide-react";
import { addToCart, bdt } from "@/lib/store-cart";
import { trackAddToCart } from "@/lib/tracking";
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
        "inline-flex items-center justify-center gap-2 border px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0",
        "rounded-[var(--st-radius-sm)] border-[var(--st-primary)]/25 bg-[var(--st-primary)]/10 text-[var(--st-primary)] hover:bg-[var(--st-primary)]/15 hover:border-[var(--st-primary)]/40 shadow-sm",
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
  const navigate = useNavigate();
  const img = image(listing);
  const p = listing.product!;
  const sold = useMemo(() => soldCount(p.id), [p.id]);
  const price = Number(listing.selling_price);
  const to = { to: url(`/p/${p.slug}`) };

  const handleDirectOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(code, listing.id, 1);
    trackAddToCart({ id: p.id, name: title(listing), price, qty: 1 });
    navigate({ to: url("/checkout") });
  };

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
        </div>
        <div className="flex flex-1 flex-col p-2.5">
          <h3 className="truncate text-[13px] leading-snug text-[var(--st-fg)]" title={title(listing)}>
            {title(listing)}
          </h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Price value={price} className="text-base font-extrabold" />
          </div>
          <div className={cx("mt-1 flex items-center gap-1 text-[10px] font-semibold", muted)}>
            <Flame className="h-3 w-3 text-[var(--st-primary)]" /> {sold} sold
          </div>
          <button
            type="button"
            onClick={handleDirectOrder}
            className="mt-2 block w-full rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] py-2 text-center text-[12px] font-bold text-[var(--st-on-primary)] transition-transform hover:opacity-95 active:scale-[0.98]"
          >
            অর্ডার করুন
          </button>
        </div>
      </Link>
    );

  /* ------------------------------------------------- Noir: gallery frame */
  if (theme.id === "noir")
    return (
      <Link {...to} className="group block">
        <div className={cx("relative aspect-[3/4] overflow-hidden border bg-[var(--st-bg-alt)]", borderc)}>
          <Img className="opacity-95 group-hover:opacity-100" />
          <button
            type="button"
            onClick={handleDirectOrder}
            className="absolute inset-x-0 bottom-0 translate-y-full bg-[var(--st-primary)] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--st-on-primary)] transition-transform duration-300 group-hover:translate-y-0"
          >
            অর্ডার করুন
          </button>
        </div>
        <h3
          className="mt-4 truncate text-[13px] uppercase tracking-[0.16em] text-[var(--st-fg)]"
          style={{ fontFamily: "var(--st-font-body)" }}
          title={title(listing)}
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
    const label = content.text("sohoj_order_label") || "অর্ডার করুন";
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
        </div>
        <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2">
          <h3 className="truncate text-[13px] font-semibold leading-snug text-[var(--st-fg)]" title={title(listing)}>
            {title(listing)}
          </h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Price value={price} className="text-[16px] font-extrabold" />
          </div>
          <div className={cx("mt-0.5 text-[11px]", muted)}>{sold} জন কিনেছেন</div>
        </div>
        <button
          type="button"
          onClick={handleDirectOrder}
          className="flex w-full items-center justify-center gap-1.5 bg-[var(--st-primary)] px-2 py-2.5 text-center text-[12px] font-bold leading-snug text-white transition-transform hover:opacity-95 active:scale-[0.98]"
        >
          <ShoppingBasket className="h-3.5 w-3.5 shrink-0" /> {label}
        </button>
      </Link>
    );
  }


  /* --------------------------------------------------- Aurora: soft card */
  return (
    <Link
      {...to}
      className="group flex flex-col overflow-hidden rounded-[var(--st-radius)] border border-transparent bg-[var(--st-surface)] shadow-[var(--st-shadow)] transition-all hover:-translate-y-1 hover:border-[var(--st-primary)]/40 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--st-bg-alt)]">
        <Img />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <ShoppingBag className="h-2.5 w-2.5" /> {sold} sold
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3.5">
        <h3 className="truncate text-[13px] sm:text-sm font-semibold leading-snug text-[var(--st-fg)]" title={title(listing)}>
          {title(listing)}
        </h3>
        <button
          type="button"
          onClick={handleDirectOrder}
          className="mt-2.5 flex w-full items-center justify-between gap-1 rounded-full bg-[var(--st-primary)] px-3.5 py-2 text-xs sm:text-[13px] font-bold text-[var(--st-on-primary)] shadow-sm transition-all hover:brightness-105 hover:shadow active:scale-[0.98]"
        >
          <span className="font-extrabold tracking-tight">{bdt(price)}</span>
          <span>অর্ডার করুন</span>
        </button>
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

export function ProductImageGallery({
  images,
  title,
  tools,
  aspectRatio = "aspect-square",
  objectFit = "cover",
  activeIdx,
  onIndexChange,
  showThumbnails = true,
}: {
  images: { url: string }[];
  title: string;
  tools?: React.ReactNode;
  aspectRatio?: string;
  objectFit?: "cover" | "contain";
  activeIdx?: number;
  onIndexChange?: (idx: number) => void;
  showThumbnails?: boolean;
}) {
  const allImages = images.length > 0 ? images.map((im) => im.url).filter(Boolean) : [];
  const [internalIdx, setInternalIdx] = useState(0);
  const currentIdx = activeIdx !== undefined ? activeIdx : internalIdx;
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const handleSelect = (index: number) => {
    const validIdx = Math.max(0, Math.min(index, allImages.length - 1));
    if (activeIdx === undefined) setInternalIdx(validIdx);
    onIndexChange?.(validIdx);
    if (scrollRef.current) {
      isProgrammaticScroll.current = true;
      const el = scrollRef.current;
      el.scrollTo({
        left: validIdx * el.clientWidth,
        behavior: "smooth",
      });
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 400);
    }
  };

  const handleScroll = () => {
    if (isProgrammaticScroll.current || !scrollRef.current) return;
    const el = scrollRef.current;
    if (el.clientWidth > 0) {
      const newIdx = Math.round(el.scrollLeft / el.clientWidth);
      if (newIdx !== currentIdx && newIdx >= 0 && newIdx < allImages.length) {
        if (activeIdx === undefined) setInternalIdx(newIdx);
        onIndexChange?.(newIdx);
      }
    }
  };

  useEffect(() => {
    if (activeIdx !== undefined && scrollRef.current) {
      const el = scrollRef.current;
      const targetLeft = activeIdx * el.clientWidth;
      if (Math.abs(el.scrollLeft - targetLeft) > 10) {
        isProgrammaticScroll.current = true;
        el.scrollTo({ left: targetLeft, behavior: "smooth" });
        setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 400);
      }
    }
  }, [activeIdx]);

  useEffect(() => {
    if (thumbContainerRef.current) {
      const activeBtn = thumbContainerRef.current.children[currentIdx] as HTMLElement | undefined;
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [currentIdx]);

  if (allImages.length === 0) {
    return (
      <div className={cx("relative aspect-square w-full overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-bg-alt)]", borderc)}>
        <div className={cx("grid h-full w-full place-items-center text-xs", muted)}>ছবি নেই</div>
      </div>
    );
  }

  const hasMultiple = showThumbnails && allImages.length > 1;

  return (
    <div
      className={cx(
        "relative w-full min-w-0 select-none",
        hasMultiple ? "flex flex-col md:grid md:grid-cols-[68px_1fr] md:gap-3.5 md:items-start" : "w-full",
      )}
    >
      {/* Thumbnails (Left side on PC matching gallery height, Bottom on Mobile) */}
      {hasMultiple && (
        <div
          ref={thumbContainerRef}
          className="no-scrollbar order-2 mt-3 flex w-full max-w-full min-w-0 gap-2 overflow-x-auto pb-1 md:order-1 md:mt-0 md:h-full md:max-h-full md:min-h-0 md:w-[68px] md:flex-col md:justify-start md:overflow-y-auto md:pb-0"
        >
          {allImages.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(i)}
              aria-label={`Image ${i + 1}`}
              className={cx(
                "relative aspect-square h-16 w-16 shrink-0 flex-none overflow-hidden rounded-[var(--st-radius-sm)] border-2 transition-all hover:opacity-90",
                i === currentIdx ? "border-[var(--st-primary)] ring-2 ring-[var(--st-primary)]/20" : borderc,
              )}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className={cx("aspect-square h-full w-full", objectFit === "contain" ? "object-contain" : "object-cover")}
              />
            </button>
          ))}
        </div>
      )}

      {/* Main Image Slider with Touch Swipe (Strict 1:1 Square) */}
      <div className={cx("relative order-1 aspect-square w-full min-w-0 overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-bg-alt)] md:order-2", borderc)}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="no-scrollbar flex h-full w-full min-w-0 snap-x snap-mandatory overflow-x-auto scroll-smooth touch-pan-x"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {allImages.map((url, i) => (
            <div key={i} className="flex aspect-square h-full w-full min-w-full flex-none snap-center items-center justify-center">
              <img
                src={url}
                alt={`${title} - ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                className={cx("aspect-square h-full w-full select-none", objectFit === "contain" ? "object-contain" : "object-cover")}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* Navigation Arrows for Previous / Next Image (< and >) */}
        {allImages.length > 1 && (
          <>
            {currentIdx > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(currentIdx - 1);
                }}
                aria-label="Previous image"
                className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/75 hover:scale-110 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {currentIdx < allImages.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(currentIdx + 1);
                }}
                aria-label="Next image"
                className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white shadow-md backdrop-blur-sm transition-all hover:bg-black/75 hover:scale-110 active:scale-95"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </>
        )}

        {/* Counter Badge */}
        {allImages.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {currentIdx + 1} / {allImages.length}
          </div>
        )}

        {/* Reseller Tools */}
        {tools}
      </div>
    </div>
  );
}
