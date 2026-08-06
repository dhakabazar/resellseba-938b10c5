import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCatalog } from "@/lib/catalog.functions";
import { CopyBtn, DownloadBtn, useCatalogBrand } from "@/components/catalog/shell";
import { bdt } from "@/lib/finance-report";
import { Boxes, Layers, Loader2, Search, Sparkles, Tag } from "lucide-react";

type Search = { category?: string; brand?: string; q?: string };

export const Route = createFileRoute("/catalog/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" && s.category ? s.category : undefined,
    brand: typeof s.brand === "string" && s.brand ? s.brand : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
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
  categoryId: string | null;
  brandId: string | null;
  image: string | null;
};

function CatalogIndex() {
  const { category, brand, q } = Route.useSearch();
  const { banner, siteName } = useCatalogBrand();
  const navigate = useNavigate();
  const fetchCatalog = useServerFn(getCatalog);
  const [data, setData] = useState<{ categories: Cat[]; brands: { id: string; name: string; slug: string }[]; products: Prod[] } | null>(null);
  const [term, setTerm] = useState(q ?? "");

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
            className="mx-auto mt-7 flex max-w-md items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void navigate({ to: "/catalog", search: { category, brand, q: term.trim() || undefined } });
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="প্রোডাক্ট খুঁজুন…"
                aria-label="Search products"
                className="w-full rounded-xl border bg-card/95 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
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

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/catalog"
                search={{}}
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
                  search={{ category: c.slug }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    category === c.slug ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50"
                  }`}
                >
                  {c.name} ({c.count})
                </Link>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {rows.length === 0 ? (
              <div className="surface-card grid place-items-center p-16 text-center text-sm text-muted-foreground">
                কোনো প্রোডাক্ট পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {rows.map((p) => (
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
                      <span className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-1 text-[10px] font-bold backdrop-blur">
                        #{p.code}
                      </span>
                    </Link>
                    <div className="flex flex-1 flex-col p-4">
                      <Link to="/catalog/$slug" params={{ slug: p.slug }} className="line-clamp-2 text-sm font-bold leading-tight hover:text-primary">
                        {p.name}
                      </Link>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resell price</div>
                          <div className="text-base font-black text-primary">{bdt(p.price)}</div>
                        </div>
                        <Link
                          to="/catalog/$slug"
                          params={{ slug: p.slug }}
                          className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:border-primary/50 hover:text-primary"
                        >
                          Details
                        </Link>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                        <CopyBtn text={p.name} title="Title" label="Title copied" />
                        <CopyBtn text={`${p.name}\n\n${p.short}\n\nPrice: ${bdt(p.price)}`} title="Details" label="Details copied" />
                        {p.image && <DownloadBtn url={p.image} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
