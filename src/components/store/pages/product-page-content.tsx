import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";
import { inCategory, categoryIdsOf } from "@/lib/product-categories";
import { addToCart } from "@/lib/store-cart";
import { trackAddToCart, trackViewContent } from "@/lib/tracking";
import { useResellerTools, stripHtml, CopyButton, ImageDownloadTools } from "@/components/store/reseller-tools";
import { ProductCodeChip } from "@/components/product-code";
import { useStore } from "@/components/store/store-context";
import { PoripatiProductBoundary } from "@/components/store/theme-loader";
import { SohojProductPage } from "@/components/store/sohoj-pdp";
import {
  borderc,
  cx,
  EmptyState,
  GhostButton,
  Heading,
  muted,
  Price,
  PrimaryButton,
  ProductCard,
  ProductGrid,
  SectionHead,
} from "@/components/store/ui";

export function ProductPageContent({ slug, code: propCode }: { slug: string; code?: string }) {
  const store = useStore();
  const code = propCode || store.code;
  const nav = useNavigate();
  const listing = store.bySlug(slug);
  const [qty, setQty] = useState(1);
  const [idx, setIdx] = useState(0);
  const tools = useResellerTools();

  useEffect(() => {
    setQty(1);
    setIdx(0);
    if (listing?.product)
      trackViewContent({ id: listing.product.id, name: store.title(listing), price: Number(listing.selling_price) });
  }, [listing?.id]);

  if (!listing || !listing.product)
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <EmptyState title="Product not available" hint="It may have been removed from this store." />
        <div className="mt-6 text-center">
          <Link to={store.url("/")}>
            <GhostButton>Back to store</GhostButton>
          </Link>
        </div>
      </div>
    );

  const p = listing.product;
  const title = store.title(listing);
  const price = Number(listing.selling_price);
  const images = p.product_images ?? [];
  const active = images[idx]?.url ?? store.image(listing);
  const inStock = p.stock === null || Number(p.stock) > 0;
  const imageUrls = images.map((im) => im.url).filter(Boolean);
  const detailsText = stripHtml(
    [listing.custom_description || p.short_description || "", p.description || ""].filter(Boolean).join("\n\n"),
  );
  const related = store.listings.filter((l) => l.id !== listing.id && l.product && categoryIdsOf(p).some((cid) => inCategory(l.product!, cid))).slice(0, 4);

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
    if (goCheckout) nav({ to: store.url("/checkout") });
    else toast.success("Added to cart");
  }

  if (store.theme.id === "poripati") return <PoripatiProductBoundary listing={listing} />;

  if (store.theme.id === "atelier")
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <SohojProductPage
          listing={listing}
          detailsText={detailsText}
          related={related}
          tools={!!tools}
          onOrder={(q) => {
            addToCart(code, listing.id, q);
            trackAddToCart({ id: p.id, name: title, price, qty: q });
            nav({ to: store.url("/checkout") });
          }}
          onAddToCart={(q) => {
            addToCart(code, listing.id, q);
            trackAddToCart({ id: p.id, name: title, price, qty: q });
            toast.success("কার্টে যোগ হয়েছে");
          }}
        />
      </>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 lg:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
        </div>
      </div>

      {p.description && (
        <section className="mt-12 lg:mt-16">
          <div className="flex items-center justify-between gap-3">
            <Heading className="text-xl">Product details</Heading>
            {tools && <CopyButton value={detailsText} label="details" />}
          </div>
          <div
            className={cx(
              "prose prose-sm mt-4 max-w-none rounded-[var(--st-radius)] border p-5 text-sm leading-relaxed",
              borderc,
              muted,
            )}
            dangerouslySetInnerHTML={{ __html: p.description }}
          />
        </section>
      )}

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
