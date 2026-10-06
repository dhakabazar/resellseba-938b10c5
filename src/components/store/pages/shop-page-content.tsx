import { useState } from "react";
import { useStore } from "@/components/store/store-context";
import { PoripatiListingBoundary } from "@/components/store/theme-loader";
import { borderc, cx, EmptyState, Heading, muted, ProductGrid } from "@/components/store/ui";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 16;

export function ShopPageContent() {
  const { listings, theme } = useStore();
  const poripati = theme.id === "poripati";
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (poripati) {
    return <PoripatiListingBoundary title="All products" listings={listings} />;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className={cx("mb-8 border-b pb-6", borderc)}>
        <Heading className="text-2xl md:text-3xl">সকল প্রোডাক্ট</Heading>
      </div>

      {listings.length ? (
        <ProductGrid listings={listings.slice(0, visible)} />
      ) : (
        <EmptyState title="কোনো প্রোডাক্ট নেই" hint="নতুন প্রোডাক্ট শীঘ্রই যুক্ত করা হবে।" />
      )}

      {visible < listings.length && (
        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            className="rounded-full px-8 py-2.5 font-bold text-sm hover:bg-[var(--st-primary)] hover:text-[var(--st-on-primary)] transition-colors shadow-sm"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            আরও দেখুন
          </Button>
        </div>
      )}
    </section>
  );
}
