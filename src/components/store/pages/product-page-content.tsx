import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inCategory, categoryIdsOf } from "@/lib/product-categories";
import { addToCart } from "@/lib/store-cart";
import { getTrackingCookies, trackAddToCart, trackViewContent } from "@/lib/tracking";
import { trackViewContentServer } from "@/lib/capi.functions";
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
  ProductImageGallery,
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
  const mainOrderRef = useRef<HTMLDivElement>(null);
  const [isMainVisible, setIsMainVisible] = useState(true);
  const viewContentCapi = useServerFn(trackViewContentServer);

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

  useEffect(() => {
    setQty(1);
    setIdx(0);
    if (listing?.product) {
      const eventId = `vc_${listing.product.id}_${Date.now()}`;
      const title = store.title(listing);
      const price = Number(listing.selling_price);

      // 1. Client-side pixel event
      trackViewContent({
        id: listing.product.id,
        name: title,
        price,
        eventId,
      });

      // 2. Server-side CAPI event (deduped by matching eventId)
      const cookies = getTrackingCookies();
      viewContentCapi({
        data: {
          code,
          productId: listing.product.id,
          productName: title,
          price,
          eventId,
          origin: window.location.origin,
          fbp: cookies.fbp,
          fbc: cookies.fbc,
          ttp: cookies.ttp,
          userAgent: cookies.userAgent,
        },
      }).catch(() => {});
    }
  }, [listing?.id, code]);

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
  const [relatedVisible, setRelatedVisible] = useState(16);
  const sameCategory = store.listings.filter(
    (l) => l.id !== listing.id && l.product && categoryIdsOf(p).some((cid) => inCategory(l.product!, cid)),
  );
  const otherProducts = store.listings.filter(
    (l) => l.id !== listing.id && !sameCategory.some((s) => s.id === l.id),
  );
  const recommended = useMemo(() => [...sameCategory, ...otherProducts], [sameCategory, otherProducts]);

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
    else toast.success("কার্টে যোগ হয়েছে");
  }

  if (store.theme.id === "poripati") return <PoripatiProductBoundary listing={listing} />;

  if (store.theme.id === "atelier")
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <SohojProductPage
          listing={listing}
          detailsText={detailsText}
          related={recommended}
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

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0">
          <ProductImageGallery
            images={images.length > 0 ? images : active ? [{ url: active }] : []}
            title={title}
            activeIdx={idx}
            onIndexChange={setIdx}
            tools={
              tools ? (
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
              ) : null
            }
          />
        </div>

        <div className="min-w-0">
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

          <div className="mt-5 flex flex-wrap items-center justify-start gap-5">
            <Price value={price} className="text-3xl md:text-4xl" />
            <div className={cx("inline-flex items-center rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)]", borderc)}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease"
                className="p-2 sm:p-2.5 text-[var(--st-fg)] hover:bg-[var(--st-bg-alt)] transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[3.5ch] text-center text-sm font-bold text-[var(--st-fg)]">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase"
                className="p-2 sm:p-2.5 text-[var(--st-fg)] hover:bg-[var(--st-bg-alt)] transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={mainOrderRef} className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
            <PrimaryButton
              disabled={!inStock}
              onClick={() => add(true)}
              className="w-full sm:flex-1 justify-center py-3.5 text-base font-bold animate-order-jiggle shadow-sm"
            >
              <Zap className="h-4 w-4" /> অর্ডার করুন
            </PrimaryButton>
            <GhostButton
              disabled={!inStock}
              onClick={() => add(false)}
              className="w-full sm:flex-1 justify-center py-3.5 text-sm sm:text-base font-bold shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" /> কার্টে যোগ করুন
            </GhostButton>
          </div>
        </div>
      </div>

      {p.description && (
        <section className="mt-12 lg:mt-16">
          <div className="flex items-center justify-between gap-3">
            <Heading className="text-xl">প্রোডাক্ট বিবরণ</Heading>
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

      {false && recommended.length > 0 && (
        <section className="mt-14 sm:mt-16 border-t border-[var(--st-border)] pt-10">
          <SectionHead title="আপনার পছন্দ হতে পারে" subtitle="সম্পর্কিত ও জনপ্রিয় পণ্যসমূহ" />
          <ProductGrid listings={recommended.slice(0, relatedVisible)} />
          {relatedVisible < recommended.length && (
            <div className="mt-10 flex justify-center">
              <Button
                className="rounded-full px-8 py-3 font-extrabold text-sm bg-[var(--st-primary)] text-[var(--st-on-primary)] hover:bg-[var(--st-primary)] hover:opacity-90 shadow-md animate-order-jiggle transition-all"
                onClick={() => setRelatedVisible((v) => v + 16)}
              >
                আরও দেখুন
              </Button>
            </div>
          )}
        </section>
      )}

      {store.content.flag("pdp_sticky") && !isMainVisible && (
        <div
          className={cx(
            "fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--st-surface)]/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_25px_-10px_rgba(0,0,0,0.2)] animate-in fade-in slide-in-from-bottom duration-300",
            borderc,
          )}
        >
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-[var(--st-muted)]">{title}</div>
              <Price value={price} className="text-base sm:text-lg font-bold" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => add(false)}
                disabled={!inStock}
                className={cx(
                  "hidden sm:inline-flex items-center gap-1.5 rounded-[var(--st-radius-sm)] border border-[var(--st-primary)]/25 bg-[var(--st-primary)]/10 text-[var(--st-primary)] hover:bg-[var(--st-primary)]/18 px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all disabled:opacity-50",
                )}
              >
                <ShoppingBag className="h-4 w-4" /> কার্টে রাখুন
              </button>
              <PrimaryButton disabled={!inStock} onClick={() => add(true)} className="px-5 sm:px-7 py-2.5 animate-order-jiggle shadow-md font-bold text-xs sm:text-sm">
                <Zap className="h-4 w-4" /> অর্ডার করুন
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
