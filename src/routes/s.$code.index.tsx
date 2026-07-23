import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/s/$code/")({
  component: StoreHome,
});

type Listing = {
  id: string;
  selling_price: number;
  custom_title: string | null;
  is_active: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    short_description: string | null;
    category_id: string | null;
    brand_id: string | null;
    is_active: boolean;
    product_images: { url: string; is_primary: boolean }[];
  } | null;
};

export default function StoreHome() {
  const { code } = Route.useParams();
  const [rid, setRid] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [activeCat, setActiveCat] = useState<string | "all">("all");

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("resellers").select("id").eq("code", code).maybeSingle();
      if (!r) return setLoading(false);
      setRid(r.id);
      const { data } = await supabase
        .from("reseller_listings")
        .select("id, selling_price, custom_title, is_active, product:products(id,name,slug,short_description,category_id,brand_id,is_active, product_images(url,is_primary))")
        .eq("reseller_id", r.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const rows = (data ?? []).filter((l: any) => l.product?.is_active) as unknown as Listing[];
      setListings(rows);
      const catIds = Array.from(new Set(rows.map((l) => l.product?.category_id).filter(Boolean))) as string[];
      if (catIds.length) {
        const { data: c } = await supabase.from("categories").select("id,name").in("id", catIds);
        setCats(c ?? []);
      }
      setLoading(false);
    })();
  }, [code]);

  const filtered = listings.filter((l) => {
    if (!l.product) return false;
    if (activeCat !== "all" && l.product.category_id !== activeCat) return false;
    if (q && !(l.custom_title || l.product.name).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (loading)
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Product search..."
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      {cats.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")}>All</Chip>
          {cats.map((c) => (
            <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="grid place-items-center py-24 text-center text-sm text-muted-foreground">
          Ekhono kono product listing hoy ni.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((l) => {
            const img = l.product?.product_images?.find((i) => i.is_primary)?.url
              ?? l.product?.product_images?.[0]?.url;
            return (
              <Link
                key={l.id}
                to="/s/$code/p/$slug"
                params={{ code, slug: l.product!.slug }}
                className="group overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-square bg-muted">
                  {img ? (
                    <img src={img} alt={l.product!.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="line-clamp-2 text-sm font-medium">
                    {l.custom_title || l.product!.name}
                  </div>
                  <div className="mt-1 text-base font-semibold" style={{ color: "var(--store-primary)" }}>
                    ৳{Number(l.selling_price).toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs transition-colors " +
        (active ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-muted")
      }
    >
      {children}
    </button>
  );
}
