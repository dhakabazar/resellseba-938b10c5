import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { inCategory } from "@/lib/product-categories";
import { useStore } from "@/components/store/store-context";
import { borderc, cx, EmptyState, GhostButton, ProductGrid, SectionHead } from "@/components/store/ui";
import { PoripatiListingBoundary, usePoripati } from "@/components/store/theme-loader";

type Sort = "new" | "low" | "high";

export function CategoryPageContent({ slug, code: propCode }: { slug: string; code?: string }) {
  const store = useStore();
  const code = propCode || store.code;
  const { categories, listings } = store;
  const [sort, setSort] = useState<Sort>("new");
  const poripati = usePoripati();

  const category = categories.find((c) => c.slug === slug);

  const rows = useMemo(() => {
    const base = listings.filter((l) => l.product && category && inCategory(l.product, category.id));
    const sorted = [...base];
    if (sort === "low") sorted.sort((a, b) => Number(a.selling_price) - Number(b.selling_price));
    if (sort === "high") sorted.sort((a, b) => Number(b.selling_price) - Number(a.selling_price));
    return sorted;
  }, [listings, category?.id, sort]);

  if (!category)
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <EmptyState title="Collection not found" hint="This collection is no longer available." />
        <div className="mt-6 text-center">
          <Link to={store.url("/")}>
            <GhostButton>Back to store</GhostButton>
          </Link>
        </div>
      </div>
    );

  if (poripati) return <PoripatiListingBoundary title={category.name} listings={listings} categoryId={category.id} />;

  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SectionHead
          title={category.name}
          action={
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Sort products"
              className={cx(
                "rounded-[var(--st-radius-sm)] border bg-[var(--st-surface)] px-3 py-2 text-sm outline-none",
                borderc,
              )}
            >
              <option value="new">Newest first</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
            </select>
          }
        />
        {rows.length ? (
          <ProductGrid listings={rows} />
        ) : (
          <EmptyState title="No products in this collection" hint="Check back soon." />
        )}
      </div>
    </div>
  );
}
