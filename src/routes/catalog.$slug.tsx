import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCatalogProduct } from "@/lib/catalog.functions";
import { CopyBtn } from "@/components/catalog/shell";
import { ImagePickerButton } from "@/components/catalog/image-picker";
import { ProductCodeChip } from "@/components/product-code";
import { bdt } from "@/lib/finance-report";
import { useAdvancedSettings } from "@/lib/advanced-settings";
import { ArrowLeft, Loader2, Package, Sparkles, Truck } from "lucide-react";

export const Route = createFileRoute("/catalog/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Catalog details` },
      { name: "description", content: `${params.slug.replace(/-/g, " ")} — ছবি, বিবরণ ও রিসেল প্রাইস।` },
      { property: "og:title", content: `${params.slug.replace(/-/g, " ")} — Catalog details` },
      { property: "og:description", content: `${params.slug.replace(/-/g, " ")} — ছবি, বিবরণ ও রিসেল প্রাইস।` },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogDetails,
});

type P = Awaited<ReturnType<typeof getCatalogProduct>>;

function CatalogDetails() {
  const { slug } = Route.useParams();
  const fetchProduct = useServerFn(getCatalogProduct);
  const [state, setState] = useState<"loading" | "done">("loading");
  const [p, setP] = useState<P>(null);
  const [idx, setIdx] = useState(0);
  const { settings } = useAdvancedSettings();
  const showStock = settings.resellerCatalogShowStock;

  useEffect(() => {
    setState("loading");
    fetchProduct({ data: { slug } }).then((d) => {
      setP(d as P);
      setIdx(0);
      setState("done");
    });
  }, [fetchProduct, slug]);

  if (state === "loading")
    return (
      <div className="grid place-items-center py-28">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (!p)
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">প্রোডাক্ট পাওয়া যায়নি</h1>
        <Link to="/catalog" search={{}} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          ← ক্যাটালগে ফিরে যান
        </Link>
      </div>
    );

  const profit = Math.max(0, p.price - p.resellerPrice);
  const pct = p.resellerPrice > 0 ? Math.round((profit / p.resellerPrice) * 100) : 0;

  const detailText = [
    p.name,
    p.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    `Price: ${bdt(p.price)}`,
    `Code: #${p.code}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="brand-mesh">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          to="/catalog"
          search={p.categorySlug ? { category: p.categorySlug } : {}}
          className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm backdrop-blur hover:text-brand-1"
        >
          <ArrowLeft className="h-4 w-4" /> Catalog
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="catalog-card aspect-square overflow-hidden">
              {p.images[idx] ? (
                <img src={p.images[idx]} alt={p.name} className="h-full w-full rounded-[1.2rem] object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">No image</div>
              )}
            </div>
            {p.images.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.images.map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                      i === idx ? "border-brand-1 shadow-md" : "border-transparent opacity-75 hover:opacity-100"
                    }`}
                  >
                    <img src={u} alt={`${p.name} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <ProductCodeChip code={p.code} size="md" />
              {p.category && <span className="brand-tile-1 rounded-full px-3 py-1">{p.category}</span>}
              {p.brand && <span className="brand-tile-2 rounded-full px-3 py-1">{p.brand}</span>}
              {showStock && (
                <span className={`rounded-full px-3 py-1 ${p.stock > 0 ? "brand-tile-3" : "bg-rose-500/10 text-rose-600"}`}>
                  {p.stock > 0 ? `Stock ${p.stock}` : "Stock out"}
                </span>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">{p.name}</h1>

            {/* Price board */}
            <div className="catalog-card mt-6 p-5">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="price-tile brand-tile-1 !p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Wholesale</div>
                  <div className="mt-1 text-lg font-black sm:text-xl">{bdt(p.resellerPrice)}</div>
                </div>
                <div className="price-tile brand-tile-4 !p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Sale price</div>
                  <div className="mt-1 text-lg font-black sm:text-xl">{bdt(p.price)}</div>
                </div>
                <div className="price-tile brand-tile-3 !p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Your profit</div>
                  <div className="mt-1 text-lg font-black sm:text-xl">{bdt(profit)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
                {profit > 0 && (
                  <span className="brand-solid-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]">
                    <Sparkles className="h-3.5 w-3.5" /> +{pct}% margin
                  </span>
                )}
                {p.weight ? (
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> {p.weight} g
                  </span>
                ) : null}
              </div>
            </div>

            {/* Delivery */}
            <div className="catalog-card mt-4 p-5">
              <div className="flex items-center gap-2 text-base font-black">
                <span className="brand-solid-3 grid h-8 w-8 place-items-center rounded-xl">
                  <Truck className="h-4 w-4" />
                </span>
                Delivery charge
              </div>
              <div className="mt-3 text-base font-bold">
                {p.deliveryMode === "free" ? (
                  <span className="text-lg font-black text-emerald-600">Free delivery</span>
                ) : p.deliveryMode === "flat" || p.deliveryMode === "custom" ? (
                  <div className="flex items-center justify-between">
                    <span>{p.deliveryMode === "flat" ? "Flat" : "Custom"}</span>
                    <span className="font-black text-brand-1">{bdt(p.deliveryFlat)}</span>
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {([
                      ["inside_dhaka", p.deliveryInside],
                      ["sub_dhaka", p.deliverySub],
                      ["outside_dhaka", p.deliveryOutside],
                    ] as const).map(([area, charge]) => (
                      <div
                        key={area}
                        className="flex items-center justify-between border-b border-border/60 pb-2.5 last:border-0 last:pb-0"
                      >
                        <span>{p.deliveryLabels?.[area] ?? area}:</span>
                        <span className="font-black text-brand-1 tabular-nums">{bdt(charge)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reseller tools */}
            <div className="catalog-card mt-4 p-5">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reseller tools</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyBtn text={p.name} title="Title" label="Title copied" />
                <CopyBtn text={detailText} title="Details" label="Details copied" />
                <ImagePickerButton images={p.images} baseName={p.name} />
              </div>
            </div>

            <div className="catalog-hero mt-5 overflow-hidden rounded-2xl p-5 text-white">
              <p className="text-base font-black">এই প্রোডাক্ট বিক্রি করতে চান?</p>
              <p className="mt-1 text-sm text-white/85">রিসেলার হিসেবে সাইনআপ করে নিজের স্টোরে লিস্ট করুন।</p>
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="btn-invert-brand mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold"
              >
                রিসেলার সাইনআপ
              </Link>
            </div>
          </div>
        </div>

        {p.description && (
          <section className="catalog-card mt-10 p-5 sm:p-7 lg:mt-14">
            <h2 className="text-lg font-black">Product details</h2>
            <div className="brand-rule mt-3 h-1 w-16 rounded-full" />
            <div
              className="prose prose-sm mt-4 max-w-none text-sm leading-relaxed text-foreground/90 [&_img]:rounded-xl"
              dangerouslySetInnerHTML={{ __html: p.description }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
