import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/components/store/store-context";
import { EmptyState, ProductGrid, SectionHead } from "@/components/store/ui";
import { Button } from "@/components/ui/button";
import { PoripatiListingBoundary, usePoripati } from "@/components/store/theme-loader";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/s/$code/shop")({
  component: ShopPage,
  head: ({ params }) => ({
    meta: [
      { title: `All Products — ${params.code}` },
      { name: "description", content: `Browse all products available from ${params.code}.` },
      { property: "og:title", content: `All Products — ${params.code}` },
      { property: "og:description", content: `Browse all products available from ${params.code}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ShopPage() {
  const { listings } = useStore();
  const poripati = usePoripati();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const rows = listings.slice(0, visible);

  if (poripati) return <PoripatiListingBoundary title="All products" listings={listings} />;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHead title="All products" />
      {rows.length ? (
        <>
          <ProductGrid listings={rows} />
          {visible < listings.length && (
            <div className="mt-8 flex justify-center">
              <Button onClick={() => setVisible((count) => count + PAGE_SIZE)}>Load more</Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No products listed yet" hint="Come back soon." />
      )}
    </section>
  );
}