import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/components/store/store-context";
import {
  BenefitStrip,
  CategoryStrip,
  Faq,
  Hero,
  PromoBanner,
  Reviews,
  ThemeSignature,
  WhyUs,
} from "@/components/store/sections";
import {
  borderc,
  cx,
  EmptyState,
  GhostButton,
  Heading,
  muted,
  ProductGrid,
  SectionHead,
} from "@/components/store/ui";

type Search = { q?: string; theme?: string; palette?: string };

export const Route = createFileRoute("/s/$code/")({
  component: StoreHome,
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    theme: typeof s.theme === "string" && s.theme ? s.theme : undefined,
    palette: typeof s.palette === "string" && s.palette ? s.palette : undefined,
  }),
});

function StoreHome() {
  const { q } = Route.useSearch();
  const store = useStore();
  const { code, listings, theme, name, content } = store;

  const results = useMemo(() => {
    if (!q) return listings;
    const term = q.toLowerCase();
    return listings.filter(
      (l) =>
        store.title(l).toLowerCase().includes(term) ||
        String(l.product?.product_code ?? "").toLowerCase().includes(term),
    );
  }, [q, listings, store]);

  const featured = listings.filter((l) => l.product?.is_featured).slice(0, 8);
  const latest = listings.slice(0, theme.layout.grid === "dense" ? 10 : 8);

  if (q)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SectionHead
          title={`Search: “${q}”`}
          subtitle={`${results.length} product${results.length === 1 ? "" : "s"} found`}
          action={
            <Link to="/s/$code" params={{ code }}>
              <GhostButton>Clear</GhostButton>
            </Link>
          }
        />
        {results.length ? (
          <ProductGrid listings={results} />
        ) : (
          <EmptyState title="Nothing matched" hint="Try a different keyword." />
        )}
      </div>
    );

  return (
    <div>
      <Hero />
      <ThemeSignature slot="top" />
      <BenefitStrip />
      <CategoryStrip />

      {content.flag("featured_show") && featured.length > 0 && (
        <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
          <div className="mx-auto max-w-6xl px-4 py-12">
            <SectionHead title={content.text("featured_title")} subtitle={content.text("featured_sub")} />
            <ProductGrid listings={featured} />
          </div>
        </section>
      )}

      <ThemeSignature />
      <PromoBanner />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHead title={content.text("latest_title")} subtitle={content.text("latest_sub")} />
        {latest.length ? (
          <ProductGrid listings={latest} />
        ) : (
          <EmptyState title="No products listed yet" hint="Come back soon." />
        )}
      </section>

      <WhyUs />
      <Reviews />
      <Faq />

      {content.text("footer_about") && (
        <section className={cx("border-t", borderc)}>
          <div className="mx-auto max-w-3xl px-4 py-14 text-center">
            <Heading className="text-2xl md:text-3xl">About {name}</Heading>
            <p className={cx("mt-4 whitespace-pre-wrap text-sm leading-relaxed", muted)}>
              {content.text("footer_about")}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
