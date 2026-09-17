import { inCategory } from "@/lib/product-categories";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCatalog } from "@/lib/catalog.functions";
import { CopyBtn, useCatalogBrand } from "@/components/catalog/shell";
import { ImagePickerButton } from "@/components/catalog/image-picker";
import { ProductCodeChip } from "@/components/product-code";
import { bdt } from "@/lib/finance-report";
import { Pagination, usePaginated } from "@/components/data-list";
import { ArrowRight, Check, ChevronDown, LayoutGrid, Loader2, Search, X } from "lucide-react";

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
  categoryIds?: string[] | null;
  brandId: string | null;
  image: string | null;
  images: string[];
};

const TILE = ["brand-tile-1", "brand-tile-2", "brand-tile-3", "brand-tile-4"];

function CatalogIndex() {
  const { category, brand, q, page } = Route.useSearch();
  const { banner, siteName } = useCatalogBrand();
  const navigate = useNavigate();
  const fetchCatalog = useServerFn(getCatalog);
  const [data, setData] = useState<{ categories: Cat[]; brands: { id: string; name: string; slug: string }[]; products: Prod[] } | null>(null);
  const [term, setTerm] = useState(q ?? "");
  const [openSug, setOpenSug] = useState(false);
  const [openCat, setOpenCat] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(24);
  const currentPage = page ?? 1;

  useEffect(() => {
    if (!openCat) return;
    const close = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setOpenCat(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenCat(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [openCat]);

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
    if (activeCat) list = list.filter((p) => inCategory({ category_id: p.categoryId, category_ids: p.categoryIds }, activeCat.id));
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
      {/* ───────────── Hero ───────────── */}
      <section className="relative isolate">
        <div className="pointer-events-none absolute inset-0 z-0 catalog-hero">
          {banner && <img src={banner} alt="" aria-hidden className="h-full w-full object-cover opacity-25 mix-blend-luminosity" />}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-12 text-center sm:px-6 sm:pb-28 sm:pt-16">
          <h1
            className="mt-5 text-balance text-4xl font-black tracking-tight text-white sm:text-6xl"
            style={{ textShadow: "0 6px 30px rgba(0,0,0,.35)" }}
          >
            {activeCat ? activeCat.name : (
              <>
                {siteName} <span className="brand-gradient-text" style={{ filter: "brightness(1.4)" }}>ক্যাটালগ</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/80 sm:text-base">
            {activeCat
              ? `${rows.length} টি প্রোডাক্ট এই ক্যাটাগরিতে`
              : "ছবি, বিবরণ, হোলসেল ও সেল প্রাইস — লিস্ট করার আগেই আপনার প্রফিট দেখে নিন।"}
          </p>

          <form
            className="relative mx-auto mt-8 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              setOpenSug(false);
              void navigate({ to: "/catalog", search: { category, brand, q: term.trim() || undefined, page: undefined } });
            }}
          >
            <div className="relative flex items-center rounded-2xl bg-card p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.5)] ring-1 ring-white/30">
              <div ref={catRef} className="relative shrink-0 border-r pr-1.5 sm:pr-2.5">
                <button
                  type="button"
                  aria-label="Category"
                  aria-expanded={openCat}
                  onClick={() => setOpenCat((v) => !v)}
                  className={`flex max-w-[108px] items-center gap-1.5 rounded-xl bg-muted/70 py-2 pl-2.5 pr-2 text-xs font-bold outline-none transition-colors hover:bg-muted sm:max-w-[190px] sm:py-2.5 sm:pl-3 sm:text-sm ${openCat ? "ring-2 ring-primary/40" : ""}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                  <span className="truncate">{activeCat ? activeCat.name : "All category"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${openCat ? "rotate-180" : ""}`} />
                </button>
                {openCat && (
                  <div className="absolute left-0 top-full z-40 mt-2 w-60 max-w-[80vw] overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-16px_rgba(0,0,0,.45)]">
                    <div className="max-h-[min(18rem,55vh)] overflow-y-auto overscroll-contain p-1.5 [touch-action:pan-y]">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCat(false);
                          void navigate({ to: "/catalog", search: { category: undefined, brand, q, page: undefined } });
                        }}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition-colors hover:bg-muted/70 sm:text-sm ${!activeCat ? "bg-primary/10 text-primary" : ""}`}
                      >
                        <LayoutGrid className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="flex-1">All category</span>
                        {!activeCat && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                      <div className="mx-2 my-1 border-t border-dashed" />
                      {(data?.categories ?? []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setOpenCat(false);
                            void navigate({ to: "/catalog", search: { category: c.slug, brand, q, page: undefined } });
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-muted/70 sm:text-sm ${activeCat?.id === c.id ? "bg-primary/10 text-primary" : ""}`}
                        >
                          <span className="truncate">{c.name}</span>
                          {activeCat?.id === c.id && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setOpenSug(true);
                }}
                onFocus={() => setOpenSug(true)}
                onBlur={() => window.setTimeout(() => setOpenSug(false), 150)}
                placeholder="প্রোডাক্টের নাম বা ID লিখুন…"
                aria-label="Search products"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none sm:text-base"
              />
              {term && (
                <button
                  type="button"
                  aria-label="Clear"
                  onClick={() => {
                    setTerm("");
                    void navigate({ to: "/catalog", search: { category, brand, q: undefined, page: undefined } });
                  }}
                  className="mr-1 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button type="submit" className="btn-brand-4 rounded-xl px-5 py-2.5 text-sm font-bold">
                Search
              </button>
            </div>
            {openSug && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-card text-left shadow-2xl">
                {suggestions.map((s, i) => (
                  <Link
                    key={s.id}
                    to="/catalog/$slug"
                    params={{ slug: s.slug }}
                    className="flex items-center gap-3 border-b px-3 py-2.5 last:border-0 hover:bg-muted/60"
                  >
                    <span className={`h-11 w-11 shrink-0 overflow-hidden rounded-xl ${TILE[i % 4]}`}>
                      {s.image ? <img src={s.image} alt={s.name} className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{s.name}</span>
                      <span className="block text-[11px] text-muted-foreground">#{s.code} · {bdt(s.price)}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
                <button
                  type="submit"
                  className="block w-full bg-muted/50 px-3 py-2.5 text-xs font-bold text-primary hover:bg-muted"
                >
                  সব রেজাল্ট দেখুন ({matchCount})
                </button>
              </div>
            )}
          </form>
        </div>
      </section>

      {!data ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ───────────── Products ───────────── */}
          <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            {rows.length === 0 ? (
              <div className="catalog-card grid place-items-center p-16 text-center text-sm text-muted-foreground">
                কোনো প্রোডাক্ট পাওয়া যায়নি।
              </div>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-2 sm:gap-6 lg:grid-cols-4">
                  {pagedRows.map((p, i) => (
                    <ProductCard key={p.id} p={p} i={i} />
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">{rows.length} products</span>
                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-9 rounded-lg border bg-card px-2 text-xs font-semibold"
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

function ProductCard({ p, i }: { p: Prod; i: number }) {
  const profit = Math.max(0, p.price - p.resellerPrice);
  return (
    <article className="catalog-card group flex flex-col overflow-hidden">
      <Link to="/catalog/$slug" params={{ slug: p.slug }} className="relative block aspect-square overflow-hidden rounded-t-[1.2rem] bg-muted">
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className={`grid h-full w-full place-items-center text-xs ${TILE[i % 4]}`}>No image</div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute bottom-2 right-2 translate-y-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-foreground opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
          View details →
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <ProductCodeChip code={p.code} />
        <Link
          to="/catalog/$slug"
          params={{ slug: p.slug }}
          className="mt-2 line-clamp-2 min-h-[2.4em] text-[13px] font-bold leading-tight hover:text-brand-1 sm:text-sm"
        >
          {p.name}
        </Link>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className={`price-tile ${TILE[0]}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Wholesale</div>
            <div className="mt-1 text-xs font-black sm:text-sm">{bdt(p.resellerPrice)}</div>
          </div>
          <div className={`price-tile ${TILE[3]}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Sale</div>
            <div className="mt-1 text-xs font-black sm:text-sm">{bdt(p.price)}</div>
          </div>
          <div className={`price-tile ${TILE[2]}`}>
            <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Profit</div>
            <div className="mt-1 text-xs font-black sm:text-sm">{bdt(profit)}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-dashed pt-3">
          <CopyBtn text={p.name} title="Title" label="Title copied" />
          <CopyBtn text={`${p.name}\n\nPrice: ${bdt(p.price)}`} title="Details" label="Details copied" />
          <ImagePickerButton images={p.images ?? (p.image ? [p.image] : [])} baseName={p.name} />
        </div>
      </div>
    </article>
  );
}

