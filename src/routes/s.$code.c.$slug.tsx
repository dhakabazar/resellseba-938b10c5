import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/components/store/store-context";
import { borderc, cx, EmptyState, GhostButton, muted, ProductGrid, SectionHead } from "@/components/store/ui";

export const Route = createFileRoute("/s/$code/c/$slug")({
  component: CategoryPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Collection` },
      { name: "description", content: `Browse ${params.slug.replace(/-/g, " ")} products with cash on delivery.` },
      { property: "og:title", content: `${params.slug.replace(/-/g, " ")} — Collection` },
      { property: "og:description", content: `Browse ${params.slug.replace(/-/g, " ")} products.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Sort = "new" | "low" | "high";

function CategoryPage() {
  const { code, slug } = Route.useParams();
  const { categories, listings } = useStore();
  const [sort, setSort] = useState<Sort>("new");

  const category = categories.find((c) => c.slug === slug);

  const rows = useMemo(() => {
    const base = listings.filter((l) => l.product?.category_id === category?.id);
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
          <Link to="/s/$code" params={{ code }}>
            <GhostButton>Back to store</GhostButton>
          </Link>
        </div>
      </div>
    );

  return (
    <div>
      {category.image_url && (
        <div className="relative h-48 overflow-hidden md:h-64">
          <img src={category.image_url} alt={category.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] to-transparent" />
        </div>
      )}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SectionHead
          title={category.name}
          subtitle={`${rows.length} product${rows.length === 1 ? "" : "s"} available`}
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
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          }
        />
        {rows.length ? (
          <ProductGrid listings={rows} />
        ) : (
          <EmptyState title="No products here yet" hint="Check another collection." />
        )}
        <div className={cx("mt-10 text-center text-sm", muted)}>
          <Link to="/s/$code" params={{ code }} className="hover:text-[var(--st-primary)]">
            ← Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
