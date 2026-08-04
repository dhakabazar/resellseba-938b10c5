import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { useStore } from "@/components/store/store-context";
import { TrustBar } from "@/components/store/chrome";
import {
  borderc,
  cx,
  EmptyState,
  GhostButton,
  Heading,
  muted,
  PrimaryButton,
  ProductGrid,
  SectionHead,
} from "@/components/store/ui";

type Search = { q?: string };

export const Route = createFileRoute("/s/$code/")({
  component: StoreHome,
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
});

function StoreHome() {
  const { q } = Route.useSearch();
  const store = useStore();
  const { code, listings, categories, theme, name, settings } = store;

  const results = useMemo(() => {
    if (!q) return listings;
    const term = q.toLowerCase();
    return listings.filter((l) => store.title(l).toLowerCase().includes(term));
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
        {results.length ? <ProductGrid listings={results} /> : <EmptyState title="Nothing matched" hint="Try a different keyword." />}
      </div>
    );

  return (
    <div>
      <Hero />
      <TrustBar />

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <SectionHead title="Shop by category" subtitle="Browse the collection" />
          <div
            className={cx(
              "grid gap-4",
              theme.layout.grid === "dense" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/s/$code/c/$slug"
                params={{ code, slug: c.slug }}
                className={cx(
                  "group overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)] transition-colors hover:border-[var(--st-primary)]",
                  borderc,
                )}
              >
                <div className="aspect-[4/3] bg-[var(--st-bg-alt)]">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className={cx("grid h-full w-full place-items-center text-2xl font-semibold", muted)}>
                      {c.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 text-sm font-medium">{c.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className={cx("border-y bg-[var(--st-bg-alt)]", borderc)}>
          <div className="mx-auto max-w-6xl px-4 py-12">
            <SectionHead title="Featured picks" subtitle="Hand-selected best sellers" />
            <ProductGrid listings={featured} />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHead
          title="New arrivals"
          subtitle="Latest products in the store"
          action={
            listings.length > latest.length ? (
              <Link to="/s/$code/c/$slug" params={{ code, slug: categories[0]?.slug ?? "all" }} className="hidden" />
            ) : undefined
          }
        />
        {latest.length ? <ProductGrid listings={latest} /> : <EmptyState title="No products listed yet" hint="Come back soon." />}
      </section>

      {settings?.about_text && (
        <section className={cx("border-t bg-[var(--st-bg-alt)]", borderc)}>
          <div className="mx-auto max-w-3xl px-4 py-14 text-center">
            <Heading className="text-2xl md:text-3xl">About {name}</Heading>
            <p className={cx("mt-4 whitespace-pre-wrap text-sm leading-relaxed", muted)}>{settings.about_text}</p>
          </div>
        </section>
      )}
    </div>
  );
}

function Hero() {
  const { code, name, settings, theme, listings, image, title } = useStore();
  const headline = settings?.hero_headline || `Discover quality products at ${name}`;
  const sub =
    settings?.hero_subheadline ||
    settings?.tagline ||
    "Handpicked products, fair prices and cash on delivery anywhere in Bangladesh.";
  const banner = settings?.hero_image_url;
  const spotlight = listings[0];
  const first = listings[0]?.product?.slug;

  const cta = (
    <div className="flex flex-wrap gap-3">
      {first && (
        <Link to="/s/$code/p/$slug" params={{ code, slug: first }}>
          <PrimaryButton>
            Shop now <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </Link>
      )}
      {settings?.whatsapp && (
        <a href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer">
          <GhostButton>Order on WhatsApp</GhostButton>
        </a>
      )}
    </div>
  );

  if (theme.layout.hero === "banner")
    return (
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <div className={cx("overflow-hidden rounded-[var(--st-radius)] border bg-[var(--st-surface)]", borderc)}>
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="p-6 md:p-10">
              <span className="inline-block rounded-full bg-[var(--st-primary)]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--st-primary)]">
                Cash on delivery
              </span>
              <Heading as="h2" className="mt-3 text-2xl leading-tight md:text-4xl">
                {headline}
              </Heading>
              <p className={cx("mt-3 max-w-md text-sm", muted)}>{sub}</p>
              <div className="mt-5">{cta}</div>
            </div>
            <div className="min-h-[220px] bg-[var(--st-bg-alt)]">
              {(banner || (spotlight && image(spotlight))) && (
                <img
                  src={banner || image(spotlight!)!}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </section>
    );

  if (theme.layout.hero === "spotlight")
    return (
      <section className="relative overflow-hidden">
        {(banner || (spotlight && image(spotlight))) && (
          <img
            src={banner || image(spotlight!)!}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--st-bg)] via-[var(--st-bg)]/70 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center md:py-32">
          <span className="text-[11px] uppercase tracking-[0.4em] text-[var(--st-primary)]">{name}</span>
          <Heading as="h2" className="mt-4 text-4xl leading-[1.1] md:text-6xl">
            {headline}
          </Heading>
          <p className={cx("mx-auto mt-5 max-w-xl text-sm md:text-base", muted)}>{sub}</p>
          <div className="mt-8 flex justify-center">{cta}</div>
        </div>
      </section>
    );

  if (theme.layout.hero === "split")
    return (
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="text-[11px] uppercase tracking-[0.3em] text-[var(--st-muted)]">Est. {new Date().getFullYear()}</span>
          <Heading as="h2" className="mt-4 text-4xl leading-[1.05] md:text-6xl">
            {headline}
          </Heading>
          <p className={cx("mt-5 max-w-md text-base leading-relaxed", muted)}>{sub}</p>
          <div className="mt-8">{cta}</div>
        </div>
        <div className="aspect-[4/5] overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-alt)]">
          {(banner || (spotlight && image(spotlight))) && (
            <img
              src={banner || image(spotlight!)!}
              alt={spotlight ? title(spotlight) : name}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </section>
    );

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          background:
            "radial-gradient(1000px 420px at 12% -10%, var(--st-primary), transparent 60%), radial-gradient(800px 400px at 90% 0%, var(--st-accent), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--st-border)] bg-[var(--st-surface)] px-3 py-1 text-[11px] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--st-primary)]" /> Trusted online store
          </span>
          <Heading as="h2" className="mt-4 text-3xl leading-tight md:text-5xl">
            {headline}
          </Heading>
          <p className={cx("mt-4 max-w-md text-sm md:text-base", muted)}>{sub}</p>
          <div className="mt-7">{cta}</div>
        </div>
        <div className="relative">
          <div className="overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-surface)] shadow-[var(--st-shadow)]">
            <div className="aspect-[4/3] bg-[var(--st-bg-alt)]">
              {(banner || (spotlight && image(spotlight))) && (
                <img
                  src={banner || image(spotlight!)!}
                  alt={spotlight ? title(spotlight) : name}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
