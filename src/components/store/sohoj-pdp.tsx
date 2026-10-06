/**
 * সহজ শপ theme — product page layout.
 *
 * Bangla-first, order-focused single screen: bordered image box on the left,
 * price + big order button + call button on the right, then a বিবরণ /
 * রিটার্ন পলিসি tab block and related products.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Minus, Phone, Plus, ShoppingBasket } from "lucide-react";
import { useStore, type StoreListing } from "./store-context";
import { CopyButton, ImageDownloadTools } from "./reseller-tools";
import { borderc, cx, muted, Price, ProductGrid, ProductImageGallery, SectionHead } from "./ui";

export function SohojProductPage({
  listing,
  detailsText,
  related,
  tools,
  onOrder,
  onAddToCart,
}: {
  listing: StoreListing;
  detailsText: string;
  related: StoreListing[];
  tools: boolean;
  onOrder: (qty: number) => void;
  onAddToCart: (qty: number) => void;
}) {
  const store = useStore();
  const { code, content, settings } = store;
  const [idx, setIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "return">("desc");
  const mainOrderRef = useRef<HTMLDivElement>(null);
  const [isMainVisible, setIsMainVisible] = useState(true);

  useEffect(() => {
    const el = mainOrderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [listing?.id]);

  const p = listing.product!;
  const title = store.title(listing);
  const price = Number(listing.selling_price);
  const images = p.product_images ?? [];
  const active = images[idx]?.url ?? store.image(listing);
  const inStock = p.stock === null || Number(p.stock) > 0;
  const phone = settings?.support_phone?.trim();
  const orderLabel = content.text("sohoj_order_label") || "অর্ডার করুন";
  const returnText = content.text("sohoj_return");

  return (
    <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 lg:pb-8">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* ছবি */}
        <div className={cx("min-w-0 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-3", borderc)}>
          <ProductImageGallery
            images={images.length > 0 ? images : active ? [{ url: active }] : []}
            title={title}
            objectFit="contain"
            activeIdx={idx}
            onIndexChange={setIdx}
            tools={
              tools ? (
                <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
                  <ImageDownloadTools
                    compact
                    images={images.map((im) => im.url).filter(Boolean)}
                    activeUrl={active}
                    baseName={title}
                  />
                  <CopyButton value={title} className="h-9 w-9 rounded-full bg-[var(--st-surface)]/90 p-0 shadow-sm" />
                </div>
              ) : null
            }
          />
        </div>

        {/* অর্ডার প্যানেল */}
        <div className={cx("min-w-0 rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4", borderc)}>
          <h1 className="text-lg font-extrabold leading-snug text-[var(--st-fg)] md:text-2xl">{title}</h1>

          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Price value={price} className="text-2xl md:text-3xl" />
          </div>

          <div ref={mainOrderRef}>
            <div className="mt-4 flex items-center gap-3">
              <div className={cx("inline-flex items-center rounded-[var(--st-radius-sm)] border", borderc)}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="কমান" className="px-3 py-2.5">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[3ch] text-center text-sm font-bold">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="বাড়ান" className="px-3 py-2.5">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => onAddToCart(qty)}
                disabled={!inStock}
                className={cx(
                  "flex-1 rounded-[var(--st-radius-sm)] border px-4 py-2.5 text-sm font-bold disabled:opacity-50",
                  borderc,
                  "hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]",
                )}
              >
                কার্টে যোগ করুন
              </button>
            </div>

            <button
              onClick={() => onOrder(qty)}
              disabled={!inStock}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--st-radius-sm)] bg-[var(--st-primary)] px-4 py-3.5 text-sm font-extrabold text-white animate-order-jiggle shadow-md disabled:opacity-50"
            >
              <ShoppingBasket className="h-4 w-4" /> {orderLabel}
            </button>
          </div>

          {phone && (
            <a
              href={`tel:${phone}`}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[var(--st-radius-sm)] bg-[var(--st-accent)] px-4 py-3 text-sm font-extrabold text-[var(--st-on-accent)]"
            >
              {content.text("sohoj_call_label") || "অর্ডার করতে কল করুন"} <Phone className="h-4 w-4" /> {phone}
            </a>
          )}

          {p.product_code && (
            <div className="mt-3 text-sm">
              <span className="font-bold">Code :</span> <span className={muted}>{p.product_code}</span>
            </div>
          )}

        </div>
      </div>

      {/* বিবরণ / রিটার্ন পলিসি */}
      <section className="mt-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["desc", "বিবরণ"],
              ["return", "রিটার্ন পলিসি"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cx(
                "rounded-t-[var(--st-radius)] border px-5 py-2.5 text-sm font-bold",
                borderc,
                tab === key
                  ? "border-b-transparent bg-[var(--st-surface)] text-[var(--st-primary)]"
                  : "bg-[var(--st-bg-alt)] text-[var(--st-fg)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4", borderc)}>
          {tab === "desc" ? (
            p.description ? (
              <div
                className={cx("prose prose-sm max-w-none text-sm leading-relaxed", muted)}
                dangerouslySetInnerHTML={{ __html: p.description }}
              />
            ) : (
              <p className={cx("text-sm", muted)}>{detailsText || "বিবরণ যোগ করা হয়নি।"}</p>
            )
          ) : (
            <p className={cx("whitespace-pre-wrap text-sm leading-relaxed", muted)}>{returnText}</p>
          )}
          {tools && detailsText && (
            <div className="mt-3">
              <CopyButton value={detailsText} label="details" />
            </div>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="mt-6">
          <SectionHead
            title="রিলেটেড প্রোডাক্টস"
            action={
              <Link
                to={store.url("/")}
                className={cx(
                  "rounded-[var(--st-radius-sm)] border px-4 py-2 text-[13px] font-bold hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]",
                  borderc,
                )}
              >
                সব দেখুন
              </Link>
            }
          />
          <ProductGrid listings={related} />
        </section>
      )}

      {/* স্টিকি অর্ডার বার (Mobile & PC) */}
      {!isMainVisible && (
        <div
          className={cx(
            "fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--st-surface)]/95 backdrop-blur-md px-4 py-2.5 shadow-[0_-8px_25px_-10px_rgba(0,0,0,0.2)] animate-in fade-in slide-in-from-bottom duration-300",
            borderc,
          )}
        >
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className={cx("truncate text-xs font-medium", muted)}>{title}</div>
              <Price value={price} className="text-base sm:text-lg font-bold" />
            </div>
            <div className="flex items-center gap-2">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  aria-label="কল করুন"
                  className="flex items-center gap-1.5 rounded-[var(--st-radius-sm)] bg-[var(--st-accent)] px-3 py-2 text-xs font-bold text-[var(--st-on-accent)] hover:opacity-90"
                >
                  <Phone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">কল করুন</span>
                </a>
              )}
              <button
                onClick={() => onOrder(qty)}
                disabled={!inStock}
                className={cx(
                  "flex items-center gap-1.5 rounded-[var(--st-radius-sm)] px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white animate-order-jiggle shadow-md disabled:opacity-50",
                  "bg-[var(--st-primary)]",
                )}
              >
                <ShoppingBasket className="h-4 w-4" /> {orderLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
