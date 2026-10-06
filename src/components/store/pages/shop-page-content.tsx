import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useStore } from "@/components/store/store-context";
import { PoripatiListingBoundary } from "@/components/store/theme-loader";
import { borderc, cx, EmptyState, GhostButton, Heading, muted, ProductGrid } from "@/components/store/ui";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 16;

export function ShopPageContent({ query }: { query?: string }) {
  const { listings, theme, url } = useStore();
  const poripati = theme.id === "poripati";
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!query) return listings;
    const term = query.toLowerCase().trim();
    return listings.filter(
      (l) =>
        (l.product?.title || "").toLowerCase().includes(term) ||
        String(l.product?.product_code ?? "").toLowerCase().includes(term) ||
        String(l.product?.short_description ?? "").toLowerCase().includes(term)
    );
  }, [listings, query]);

  if (poripati) {
    return (
      <PoripatiListingBoundary
        title={query ? `Search: “${query}”` : "All products"}
        listings={filtered}
        clearUrl={query ? url("/shop") : undefined}
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className={cx("mb-8 flex items-center justify-between border-b pb-6", borderc)}>
        <div>
          <Heading className="text-2xl md:text-3xl">
            {query ? `Search: “${query}”` : "সকল প্রোডাক্ট"}
          </Heading>
          {query && (
            <p className={cx("mt-1 text-xs", muted)}>
              {filtered.length} {filtered.length === 1 ? "টি প্রোডাক্ট পাওয়া গেছে" : "টি প্রোডাক্ট পাওয়া গেছে"}
            </p>
          )}
        </div>
        {query && (
          <Link to={url("/shop")}>
            <GhostButton>Clear</GhostButton>
          </Link>
        )}
      </div>

      {filtered.length ? (
        <ProductGrid listings={filtered.slice(0, visible)} />
      ) : (
        <EmptyState title="কোনো প্রোডাক্ট পাওয়া যায়নি" hint="ভিন্ন কোনো কি-ওয়ার্ড দিয়ে আবার চেষ্টা করুন।" />
      )}

      {visible < filtered.length && (
        <div className="mt-10 flex justify-center">
          <Button
            className="rounded-full px-8 py-3 font-extrabold text-sm bg-[var(--st-primary)] text-[var(--st-on-primary)] hover:bg-[var(--st-primary)] hover:opacity-90 shadow-md animate-order-jiggle transition-all"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            আরও দেখুন
          </Button>
        </div>
      )}
    </section>
  );
}
