/**
 * সহজ শপ theme — product page layout.
 *
 * Bangla-first, order-focused single screen: bordered image box on the left,
 * price + big order button + call button on the right, then a বিবরণ /
 * রিটার্ন পলিসি tab block and related products.
 */
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Phone, Plus, ShoppingBasket, Truck } from "lucide-react";
import { deliveryLabel, resolveDelivery } from "@/lib/delivery";
import { useStore, type StoreListing } from "./store-context";
import { CopyButton, ImageDownloadTools } from "./reseller-tools";
import { borderc, cx, muted, Price, ProductGrid, SectionHead } from "./ui";

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

  const p = listing.product!;
  const title = store.title(listing);
  const price = Number(listing.selling_price);
  const images = p.product_images ?? [];
  const active = images[idx]?.url ?? store.image(listing);
  const inStock = p.stock === null || Number(p.stock) > 0;
  const free = resolveDelivery(p).mode === "free";
  const phone = settings?.support_phone?.trim();
  const orderLabel = free
    ? content.text("sohoj_free_label") || "ফ্রী ডেলিভারিতে অর্ডার করুন"
    : content.text("sohoj_order_label") || "অর্ডার করুন";
  const returnText = content.text("sohoj_return");

  return (
    <div className="mx-auto max-w-6xl px-3 pb-24 pt-3 lg:pb-8">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* ছবি */}
        <div className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-3", borderc)}>
          <div className="relative aspect-square overflow-hidden rounded-[var(--st-radius-sm)] bg-[var(--st-bg-alt)]">
            {active ? (
              <img src={active} alt={title} className="h-full w-full object-contain" />
            ) : (
              <div className={cx("grid h-full w-full place-items-center text-xs", muted)}>ছবি নেই</div>
            )}
            {tools && (
              <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
                <ImageDownloadTools
                  compact
                  images={images.map((im) => im.url).filter(Boolean)}
                  activeUrl={active}
                  baseName={title}
                />
                <CopyButton value={title} className="h-9 w-9 rounded-full bg-[var(--st-surface)]/90 p-0 shadow-sm" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {images.map((im, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`ছবি ${i + 1}`}
                  className={cx(
                    "h-14 w-14 flex-none overflow-hidden rounded-[var(--st-radius-sm)] border",
                    i === idx ? "border-[var(--st-primary)]" : borderc,
                  )}
                >
                  <img src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* অর্ডার প্যানেল */}
        <div className={cx("rounded-[var(--st-radius)] border bg-[var(--st-surface)] p-4", borderc)}>
          <h1 className="text-lg font-extrabold leading-snug text-[var(--st-fg)] md:text-2xl">{title}</h1>

          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Price value={price} className="text-2xl md:text-3xl" />
            <span
              className={cx(
                "rounded-[var(--st-radius-sm)] px-2 py-0.5 text-[11px] font-bold",
                inStock ? "bg-[#0f8a4d]/12 text-[#0f8a4d]" : "bg-[var(--st-bg-alt)] text-[var(--st-muted)]",
              )}
            >
              {inStock ? "স্টকে আছে" : "স্টকে নেই"}
            </span>
          </div>

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
            className={cx(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--st-radius-sm)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50",
              free ? "bg-[#0f8a4d]" : "bg-[var(--st-primary)]",
            )}
          >
            <ShoppingBasket className="h-4 w-4" /> {orderLabel}
          </button>

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

          <div className={cx("mt-3 flex items-center gap-2 text-sm", muted)}>
            <Truck className="h-4 w-4 text-[var(--st-primary)]" /> ডেলিভারি: {deliveryLabel(p)}
          </div>

          {free && (
            <div className="mt-3 rounded-[var(--st-radius-sm)] bg-[#e11d48] px-3 py-2.5 text-sm font-bold text-white">
              {content.text("sohoj_free_note") || "এই পণ্যটি পাচ্ছেন সম্পূর্ণ ফ্রি ডেলিভারিতে!"}
            </div>
          )}

          <Link
            to="/login"
            search={{ mode: "signup" }}
            className={cx(
              "mt-4 flex items-center justify-center gap-2 rounded-[var(--st-radius-sm)] border px-4 py-2.5 text-sm font-medium",
              borderc,
              "bg-[var(--st-bg-alt)] hover:border-[var(--st-primary)] hover:text-[var(--st-primary)]",
            )}
          >
            এই প্রোডাক্ট বিক্রি করতে চান?
          </Link>
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
                to="/s/$code"
                params={{ code }}
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

      {/* মোবাইল স্টিকি অর্ডার বার */}
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-[var(--st-surface)] px-3 py-2.5 lg:hidden",
          borderc,
        )}
      >
        <div className="min-w-0 flex-1">
          <div className={cx("truncate text-[11px]", muted)}>{title}</div>
          <Price value={price} className="text-base" />
        </div>
        {phone && (
          <a
            href={`tel:${phone}`}
            aria-label="কল করুন"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent)] text-[var(--st-on-accent)]"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
        <button
          onClick={() => onOrder(qty)}
          disabled={!inStock}
          className={cx(
            "flex items-center gap-1.5 rounded-[var(--st-radius-sm)] px-4 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-50",
            free ? "bg-[#0f8a4d]" : "bg-[var(--st-primary)]",
          )}
        >
          <ShoppingBasket className="h-4 w-4" /> {orderLabel}
        </button>
      </div>
    </div>
  );
}
