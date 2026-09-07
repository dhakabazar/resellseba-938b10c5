import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCatalog } from "@/lib/catalog.functions";
import { CopyBtn, useCatalogBrand } from "@/components/catalog/shell";
import { ImagePickerButton } from "@/components/catalog/image-picker";
import { ProductCodeChip } from "@/components/product-code";
import { bdt } from "@/lib/finance-report";
import { Pagination, usePaginated } from "@/components/data-list";
import { Boxes, Layers, Loader2, Search, Sparkles, Tag } from "lucide-react";

type Search = { category?: string; brand?: string; q?: string; page?: number };

export const Route = createFileRoute("/catalog/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" && s.category ? s.category : undefined,
    brand: typeof s.brand === "string" && s.brand ? s.brand : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    page: typeof s.page === "number" && s.page > 1 ? s.page : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Master Catalog — সব প্রোডাক্ট এক জায়গায়" },
      {
        name: "description",
        content: "ক্যাটাগরি অনুযায়ী সম্পূর্ণ প্রোডাক্ট ক্যাটালগ — ছবি, বিবরণ ও রিসেল প্রাইস সহ।",
      },
      { property: "og:title", content: "Master Catalog — সব প্রোডাক্ট এক জায়গায়" },
      { property: "og:description", content: "ক্যাটাগরি অনুযায়ী সম্পূর্ণ প্রোডাক্ট ক্যাটালগ, ছবি ও রিসেল প্রাইস সহ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogIndex,
});

type Cat = { id: string; name: string; slug: string; image_url: string | null; count: number };
type Prod = {
  id: string;
  name: string;
  slug: string;
  code: string;
  short: string;
  price: number;
  resellerPrice: number;
  categoryId: string | null;
  brandId: string | null;
  image: string | null;
  images: string[];
};

function CatalogIndex() {
  const { category, brand, q, page } = Route.useSearch();
  const { banner, siteName } = useCatalogBrand();
  const navigate = useNavigate();
  const fetchCatalog = useServerFn(getCatalog);
  const [data, setData] = useState<{ categories: Cat[]; brands: { id: string; name: string; slug: string }[]; products: Prod[] } | null>(null);
  const [term, setTerm] = useState(q ?? "");
  const [openSug, setOpenSug] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  // Master catalog is a reseller-facing showcase: admin price & profit are always visible.
  const showPrices = true;
  const [perPage, setPerPage] = useState(24);
  const currentPage = page ?? 1;

  const matches = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return [];
    return (data?.products ?? []).filter(
      (p) => p.name.toLowerCase().includes(t) || p.code.toLowerCase().includes(t),
    );
  }, [data, term]);
  const suggestions = matches.slice(0, 6);
  const matchCount = matches.length;


  useEffect(() => {
    fetchCatalog().then((d) => setData(d as never));
  }, [fetchCatalog]);

  const activeCat = data?.categories.find((c) => c.slug === category) ?? null;
  const activeBrand = data?.brands.find((b) => b.slug === brand) ?? null;

  const rows = useMemo(() => {
    let list = data?.products ?? [];
    if (activeCat) list = list.filter((p) => p.categoryId === activeCat.id);
    if (activeBrand) list = list.filter((p) => p.brandId === activeBrand.id);
    const t = (q ?? "").trim().toLowerCase();
    if (t) list = list.filter((p) => p.name.toLowerCase().includes(t) || p.code.includes(t));
    return list;
  }, [data, activeCat, activeBrand, q]);

  const pagedRows = usePaginated(rows, currentPage, perPage);

  const setPage = (p: number) =>
    void navigate({ to: "/catalog", search: { category, brand, q, page: p > 1 ? p : undefined } });

  return (
    <div>
      <section className="relative isolate overflow-hidden border-b border-border/60">
        {banner ? (
          <div className="pointer-events-none absolute inset-0 z-0">
            <img src={banner} alt="" aria-hidden className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/65" />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        )}
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur ${
              banner ? "border-white/30 bg-white/15 text-white" : "border-primary/25 bg-primary/10 text-primary"
            }`}
          >
            <Sparkles className="h-3 w-3" /> Master Catalog
          </span>
          <h1
            className={`mt-4 text-balance text-3xl font-extrabold tracking-tight sm:text-5xl ${banner ? "text-white" : ""}`}
            style={banner ? { textShadow: "0 2px 20px rgba(0,0,0,.55)" } : undefined}
          >
            {activeCat ? activeCat.name : `${siteName} প্রোডাক্ট ক্যাটালগ`}
          </h1>
          <p className={`mx-auto mt-3 max-w-xl text-sm sm:text-base ${banner ? "text-white/90" : "text-muted-foreground"}`}>
            {activeCat
              ? `${rows.length} টি প্রোডাক্ট এই ক্যাটাগরিতে`
              : "ছবি, বিবরণ ও রিসেল প্রাইস দেখুন — লিস্ট করার আগেই সম্পূর্ণ ধারণা নিন।"}
          </p>

          <form
            className="relative mx-auto mt-7 flex max-w-md items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setOpenSug(false);
              void navigate({ to: "/catalog", search: { category, brand, q: term.trim() || undefined, page: undefined } });
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setOpenSug(true);
                }}
                onFocus={() => setOpenSug(true)}
                onBlur={() => window.setTimeout(() => setOpenSug(false), 150)}
                placeholder="প্রোডাক্ট খুঁজুন…"
                aria-label="Search products"
                className="w-full rounded-xl border bg-card/95 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              {openSug && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border bg-card text-left shadow-xl">
                  {suggestions.map((s) => (
                    <Link
                      key={s.id}
                      to="/catalog/$slug"
                      params={{ slug: s.slug }}
                      className="flex items-center gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/60"
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {s.image ? <img src={s.image} alt={s.name} className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold">{s.name}</span>
                        <span className="block text-[11px] text-muted-foreground">#{s.code} · {bdt(s.price)}</span>
                      </span>
                    </Link>
                  ))}
                  <button
                    type="submit"
                    className="block w-full bg-muted/50 px-3 py-2 text-[11px] font-bold text-primary hover:bg-muted"
                  >
                    সব রেজাল্ট দেখুন ({matchCount})
                  </button>
                </div>
              )}
            </div>
            <button type="submit" className="btn-brand rounded-xl px-4 py-2.5 text-sm font-semibold">
              Search
            </button>
          </form>
        </div>
      </section>

      {!data ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Boxes className="h-4 w-4" />} label="Products" value={data.products.length} />
              <Stat icon={<Layers className="h-4 w-4" />} label="Categories" value={data.categories.length} />
              <Stat icon={<Tag className="h-4 w-4" />} label="Brands" value={data.brands.length} />
              <Stat icon={<Sparkles className="h-4 w-4" />} label="Showing" value={rows.length} />
            </div>

            {/* Mobile: one animated pill opens the whole category list. */}
            <button
              type="button"
              onClick={() => setCatsOpen((v) => !v)}
              aria-expanded={catsOpen}
              className="mt-6 flex w-full items-center justify-between gap-2 rounded-xl border border-primary/40 bg-[image:var(--gradient-brand)] px-4 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-elegant)] transition active:scale-[.99] sm:hidden"
            >
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground/70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground" />
                </span>
                {activeCat ? activeCat.name : `All products (${data.products.length})`} + ক্যাটাগরি
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${catsOpen ? "rotate-180" : ""}`} />
            </button>

            <div
              className={`grid overflow-hidden transition-all duration-300 sm:!grid-rows-[1fr] sm:!opacity-100 ${
                catsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0">
                <div className="mt-3 flex flex-wrap gap-2 sm:mt-6">
                  <Link
                    to="/catalog"
                    search={{ page: undefined }}
                    onClick={() => setCatsOpen(false)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      !category ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
                    }`}
                  >
                    সব ({data.products.length})
                  </Link>
                  {data.categories.map((c) => (
                    <Link
                      key={c.id}
                      to="/catalog"
                      search={{ category: c.slug, page: undefined }}
                      onClick={() => setCatsOpen(false)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        category === c.slug ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
                      }`}
                    >
                      {c.name} ({c.count})
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {rows.length === 0 ? (
              <div className="surface-card grid place-items-center p-16 text-center text-sm text-muted-foreground">
                কোনো প্রোডাক্ট পাওয়া যায়নি।
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {pagedRows.map((p) => (
                    <div key={p.id} className="group surface-card flex flex-col overflow-hidden">
                      <Link to="/catalog/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden bg-muted">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
                        )}
                      </Link>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-center justify-between gap-2">
                          <ProductCodeChip code={p.code} />
                          <Link
                            to="/catalog/$slug"
                            params={{ slug: p.slug }}
                            className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold hover:border-primary/50 hover:text-primary"
                          >
                            Details
                          </Link>
                        </div>
                        <Link
                          to="/catalog/$slug"
                          params={{ slug: p.slug }}
                          className="mt-2 line-clamp-2 text-sm font-bold leading-tight hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        {showPrices ? (
                          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-2.5 text-[11px]">
                            <div>
                              <div className="font-bold uppercase tracking-wide text-muted-foreground">Wholesale</div>
                              <div className="text-sm font-bold">{bdt(p.resellerPrice)}</div>
                            </div>
                            <div>
                              <div className="font-bold uppercase tracking-wide text-muted-foreground">Sale</div>
                              <div className="text-sm font-black text-primary">{bdt(p.price)}</div>
                            </div>
                            <div>
                              <div className="font-bold uppercase tracking-wide text-muted-foreground">Profit</div>
                              <div className="text-sm font-bold text-emerald-600">{bdt(Math.max(0, p.price - p.resellerPrice))}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sale price</div>
                            <div className="text-base font-black text-primary">{bdt(p.price)}</div>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                          <CopyBtn text={p.name} title="Title" label="Title copied" />
                          <CopyBtn text={`${p.name}\n\n${p.short}\n\nPrice: ${bdt(p.price)}`} title="Details" label="Details copied" />
                          <ImagePickerButton images={p.images ?? (p.image ? [p.image] : [])} baseName={p.name} />
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {rows.length} products
                  </span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-9 rounded-md border bg-background px-2 text-xs"
                    aria-label="Products per page"
                  >
                    {[24, 48, 96, 200].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                </div>
                <Pagination page={currentPage} perPage={perPage} total={rows.length} onPage={setPage} />

              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-black leading-none">{value}</div>
        <div className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
