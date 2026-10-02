import { useState } from "react";
import { useStore } from "@/components/store/store-context";
import { PoripatiListingBoundary } from "@/components/store/theme-loader";
import { borderc, cx, EmptyState, Heading, muted, ProductGrid } from "@/components/store/ui";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 24;

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
        <Heading className="text-2xl md:text-3xl">All products</Heading>
        <p className={cx("mt-2 text-xs", muted)}>{listings.length} items</p>
      </div>

      {listings.length ? (
        <ProductGrid listings={listings.slice(0, visible)} />
      ) : (
        <EmptyState title="No products yet" hint="Products will appear here once added to this store." />
      )}

      {visible < listings.length && (
        <div className="mt-10 flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}
