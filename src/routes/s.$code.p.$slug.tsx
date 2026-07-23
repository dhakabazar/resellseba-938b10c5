import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minus, Plus, ShoppingCart, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/s/$code/p/$slug")({
  component: ProductPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Store` },
      { name: "description", content: `Order ${params.slug} with cash on delivery.` },
      { property: "og:title", content: params.slug },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ProductPage() {
  const { code, slug } = Route.useParams();
  const nav = useNavigate();
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("resellers").select("id").eq("code", code).eq("status", "active").maybeSingle();
      if (!r) return setLoading(false);
      const { data: p } = await supabase
        .from("products")
        .select("id,name,slug,description,short_description,is_active, product_images(url,is_primary,sort_order)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!p) return setLoading(false);
      const { data: l } = await supabase
        .from("reseller_listings")
        .select("*")
        .eq("reseller_id", r.id)
        .eq("product_id", p.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!l) return setLoading(false);
      setRow({ product: p, listing: l });
      setLoading(false);
    })();
  }, [code, slug]);

  if (loading)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!row)
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        <p className="text-sm text-muted-foreground">Product not available.</p>
        <Link to="/s/$code" params={{ code }} className="mt-4 inline-block text-sm underline">← Back to store</Link>
      </div>
    );

  const { product, listing } = row;
  const images: { url: string }[] = product.product_images ?? [];
  const activeImg = images[imgIdx]?.url;
  const title = listing.custom_title || product.name;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/s/$code" params={{ code }} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3 w-3" /> Back
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border bg-muted">
            {activeImg ? (
              <img src={activeImg} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.map((im, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={"h-16 w-16 flex-none overflow-hidden rounded-md border " + (i === imgIdx ? "ring-2 ring-primary" : "")}>
                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {(listing.custom_description || product.short_description) && (
            <p className="mt-2 text-sm text-muted-foreground">
              {listing.custom_description || product.short_description}
            </p>
          )}
          <div className="mt-4 text-3xl font-bold" style={{ color: "var(--store-primary)" }}>
            ৳{Number(listing.selling_price).toLocaleString()}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="inline-flex items-center rounded-md border">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
              <span className="min-w-[3ch] text-center text-sm">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="p-2 hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <button
              onClick={() => nav({ to: "/s/$code/checkout", params: { code }, search: { l: listing.id, q: qty } })}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium text-white"
              style={{ background: "var(--store-primary)" }}
            >
              <ShoppingCart className="h-4 w-4" /> Order now (Cash on delivery)
            </button>
          </div>

          {product.description && (
            <div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap text-sm">
              {product.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
