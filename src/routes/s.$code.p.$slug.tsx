import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Minus, Plus, ShieldCheck, ShoppingBag, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { trackAddToCart, trackViewContent } from "@/lib/tracking";
import { addToCart } from "@/lib/store-cart";
import { deliveryLabel } from "@/lib/delivery";
import { useStore } from "@/components/store/store-context";
import { ProductCodeChip } from "@/components/product-code";
import {
  CopyButton,
  ImageDownloadTools,
  stripHtml,
  useResellerTools,
} from "@/components/store/reseller-tools";
import {
  borderc,
  cx,
  EmptyState,
  GhostButton,
  Heading,
  muted,
  Price,
  PrimaryButton,
  ProductGrid,
  SectionHead,
} from "@/components/store/ui";

export const Route = createFileRoute("/s/$code/p/$slug")({
  component: ProductPage,
  head: ({ params }) => {
    const label = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${label} — Buy online, cash on delivery` },
        { name: "description", content: `Order ${label} online with cash on delivery across Bangladesh.` },
        { property: "og:title", content: label },
        { property: "og:description", content: `Order ${label} with cash on delivery.` },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
});

function ProductPage() {
  const { code, slug } = Route.useParams();
  const nav = useNavigate();
  const store = useStore();
  const listing = store.bySlug(slug);
  const [qty, setQty] = useState(1);
  const [idx, setIdx] = useState(0);
  const tools = useResellerTools();

  useEffect(() => {
    setQty(1);
    setIdx(0);
    if (listing)
      trackViewContent({ id: listing.product!.id, name: store.title(listing), price: Number(listing.selling_price) });
  }, [listing?.id]);

  if (!listing)
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <EmptyState title="Product not available" hint="It may have been removed from this store." />
        <div className="mt-6 text-center">
          <Link to="/s/$code" params={{ code }}>
            <GhostButton>Back to store</GhostButton>
          </Link>
        </div>
      </div>
    );

  const p = listing.product!;
  const title = store.title(listing);
  const price = Number(listing.selling_price);
  const images = p.product_images ?? [];
  const active = images[idx]?.url ?? store.image(listing);
  const inStock = p.stock === null || Number(p.stock) > 0;
  const imageUrls = images.map((im) => im.url).filter(Boolean);
  const detailsText = stripHtml(
    [listing.custom_description || p.short_description || "", p.description || ""].filter(Boolean).join("\n\n"),
  );
  const related = store.listings.filter((l) => l.id !== listing.id && l.product?.category_id === p.category_id).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: title,
    description: listing.custom_description || p.short_description || title,
    image: active ? [active] : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  function add(goCheckout: boolean) {
    addToCart(code, listing!.id, qty);
    trackAddToCart({ id: p.id, name: title, price, qty });
    if (goCheckout) nav({ to: "/s/$code/checkout", params: { code } });
    else toast.success("Added to cart");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 lg:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className={cx("mb-5 flex items-center gap-1 text-xs", muted)}>
        <Link to="/s/$code" params={{ code }} className="inline-flex items-center gap-1 hover:text-[var(--st-primary)]">
          <ChevronLeft className="h-3 w-3" /> Store
        </Link>
        <span>/</span>
        <span className="truncate text-[var(--st-fg)]">{title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div
            className={cx(
              "relative aspect-square overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-bg-alt)]",
              borderc,
            )}
          >
            {active ? (
              <img src={active} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className={cx("grid h-full w-full place-items-center text-xs", muted)}>No image</div>
            )}
            {tools && (
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
                <ImageDownloadTools compact images={imageUrls} activeUrl={active} baseName={title} />
                <CopyButton
                  value={title}
                  className="h-9 w-9 rounded-full bg-[var(--st-surface)]/90 p-0 shadow-sm backdrop-blur"
                />
                {detailsText && (
                  <CopyButton
                    value={detailsText}
                    label="details"
                    className="h-9 w-9 rounded-full bg-[var(--st-surface)]/90 p-0 shadow-sm backdrop-blur"
                  />
                )}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {images.map((im, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Image ${i + 1}`}
                  className={cx(
                    "h-16 w-16 flex-none overflow-hidden rounded-[var(--st-radius-sm)] border",
                    i === idx ? "border-[var(--st-primary)]" : borderc,
                  )}
                >
                  <img src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="group flex items-start gap-2">
            <Heading as="h1" className="text-2xl leading-tight md:text-4xl">
              {title}
            </Heading>
            {tools && (
              <CopyButton value={title} className="mt-1.5 flex-none opacity-70 group-hover:opacity-100" />
            )}
          </div>
          <div className="mt-2">
            <ProductCodeChip code={p.product_code} />
          </div>
          {(listing.custom_description || p.short_description) && (
            <p className={cx("mt-3 text-sm leading-relaxed", muted)}>
              {listing.custom_description || p.short_description}
            </p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <Price value={price} className="text-3xl md:text-4xl" />
            <span
              className={cx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                inStock ? "bg-[var(--st-primary)]/12 text-[var(--st-primary)]" : "bg-[var(--st-bg-alt)] text-[var(--st-muted)]",
              )}
            >
              {inStock ? "In stock" : "Out of stock"}
            </span>
          </div>

          {store.content.text("pdp_urgency") && inStock && (
            <p className="mt-3 text-sm font-medium text-[var(--st-primary)]">{store.content.text("pdp_urgency")}</p>
          )}

          <div className={cx("mt-5 grid gap-2 rounded-[var(--st-radius)] border p-4 text-sm", borderc)}>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[var(--st-primary)]" />
              <span>Delivery: {deliveryLabel(p)}</span>
            </div>
            {[1, 2, 3]
              .map((i) => store.content.text(`pdp_trust${i}`))
              .filter(Boolean)
              .map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--st-primary)]" />
                  <span>{line}</span>
                </div>
              ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className={cx("inline-flex items-center rounded-[var(--st-radius-sm)] border", borderc)}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease" className="p-3">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[3ch] text-center text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Increase" className="p-3">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <PrimaryButton disabled={!inStock} onClick={() => add(true)} className="flex-1">
              <Zap className="h-4 w-4" /> Order now
            </PrimaryButton>
            <GhostButton disabled={!inStock} onClick={() => add(false)}>
              <ShoppingBag className="h-4 w-4" /> Add to cart
            </GhostButton>
          </div>

          {store.content.text("pdp_returns") && (
            <p className={cx("mt-3 text-xs leading-relaxed", muted)}>{store.content.text("pdp_returns")}</p>
          )}


          {p.description && (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <Heading className="text-lg">Product details</Heading>
                {tools && <CopyButton value={detailsText} label="details" />}
              </div>
              <div
                className={cx("prose prose-sm mt-2 max-w-none text-sm leading-relaxed", muted)}
                dangerouslySetInnerHTML={{ __html: p.description }}
              />
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <SectionHead title="You may also like" subtitle="More from this collection" />
          <ProductGrid listings={related} />
        </section>
      )}

      {store.content.flag("pdp_sticky") && (
        <div
          className={cx(
            "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-[var(--st-surface)] px-4 py-3 lg:hidden",
            borderc,
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-[var(--st-muted)]">{title}</div>
            <Price value={price} className="text-lg" />
          </div>
          <PrimaryButton disabled={!inStock} onClick={() => add(true)} className="px-4 py-2.5">
            <Zap className="h-4 w-4" /> Order now
          </PrimaryButton>
        </div>
      )}
    </div>

  );
}
