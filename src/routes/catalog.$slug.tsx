import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getCatalogProduct } from "@/lib/catalog.functions";
import { CopyBtn } from "@/components/catalog/shell";
import { ImagePickerButton } from "@/components/catalog/image-picker";
import { useResellerTools } from "@/components/store/reseller-tools";
import { bdt } from "@/lib/finance-report";
import { ArrowLeft, Loader2, Truck } from "lucide-react";

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

  const detailText = [
    p.name,
    p.short,
    p.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    `Price: ${bdt(p.price)}`,
    `Code: #${p.code}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        to="/catalog"
        search={p.categorySlug ? { category: p.categorySlug } : {}}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Catalog
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="surface-card aspect-square overflow-hidden">
            {p.images[idx] ? (
              <img src={p.images[idx]} alt={p.name} className="h-full w-full object-cover" />
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
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === idx ? "border-primary" : "border-transparent"}`}
                >
                  <img src={u} alt={`${p.name} ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyBtn text={p.name} title="Title" label="Title copied" />
            <CopyBtn text={detailText} title="Details" label="Details copied" />
            <ImagePickerButton images={p.images} baseName={p.name} />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-muted px-2.5 py-1">#{p.code}</span>
            {p.category && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{p.category}</span>}
            {p.brand && <span className="rounded-full bg-accent/15 px-2.5 py-1">{p.brand}</span>}
            <span className={`rounded-full px-2.5 py-1 ${p.stock > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
              {p.stock > 0 ? `Stock ${p.stock}` : "Stock out"}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h1>
          {p.short && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.short}</p>}

          <div className="surface-card mt-6 flex flex-wrap items-end gap-6 p-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suggested resell price</div>
              <div className="text-3xl font-black text-primary">{bdt(p.price)}</div>
            </div>
            {p.weight ? (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Weight</div>
                <div className="text-base font-bold">{p.weight} g</div>
              </div>
            ) : null}
          </div>

          <div className="surface-card mt-4 p-5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Truck className="h-4 w-4 text-primary" /> Delivery charge
            </div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {p.deliveryMode === "free" ? (
                <span className="font-semibold text-emerald-600">Free delivery</span>
              ) : p.deliveryMode === "flat" ? (
                <span>Flat: {bdt(p.deliveryFlat)}</span>
              ) : (
                <>
                  <span>Inside Dhaka: {bdt(p.deliveryInside)}</span>
                  <span>Outside Dhaka: {bdt(p.deliveryOutside)}</span>
                </>
              )}
            </div>
          </div>

          {p.description && (
            <div className="mt-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Description</h2>
              <div
                className="prose prose-sm mt-3 max-w-none text-sm leading-relaxed text-foreground/90 [&_img]:rounded-lg"
                dangerouslySetInnerHTML={{ __html: p.description }}
              />
            </div>
          )}

          <div className="surface-card mt-8 p-5 text-sm">
            <p className="font-semibold">এই প্রোডাক্ট বিক্রি করতে চান?</p>
            <p className="mt-1 text-muted-foreground">রিসেলার হিসেবে সাইনআপ করে নিজের স্টোরে লিস্ট করুন।</p>
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className="btn-brand mt-4 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              রিসেলার সাইনআপ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
