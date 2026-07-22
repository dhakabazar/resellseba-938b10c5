import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  component: NewProduct,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function NewProduct() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [buying, setBuying] = useState("");
  const [packaging, setPackaging] = useState("0");
  const [deliveryIn, setDeliveryIn] = useState("60");
  const [deliveryOut, setDeliveryOut] = useState("130");
  const [suggested, setSuggested] = useState("");
  const [minSell, setMinSell] = useState("");
  const [stock, setStock] = useState("0");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("brands")
      .select("id,name")
      .order("name")
      .then(({ data }) => setBrands(data ?? []));
    supabase
      .from("categories")
      .select("id,name")
      .order("name")
      .then(({ data }) => setCats(data ?? []));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: p, error } = await supabase
        .from("products")
        .insert({
          name,
          slug: slugify(name),
          short_description: shortDesc || null,
          description: description || null,
          brand_id: brandId || null,
          category_id: categoryId || null,
          buying_price: Number(buying),
          packaging_cost: Number(packaging),
          delivery_inside: Number(deliveryIn),
          delivery_outside: Number(deliveryOut),
          suggested_price: Number(suggested),
          min_selling_price: Number(minSell),
          stock: Number(stock),
          og_image_url: images[0]?.url ?? null,
          meta_title: metaTitle || null,
          meta_description: metaDesc || null,
          keywords: keywords || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (images.length && p) {
        await supabase.from("product_images").insert(
          images.map((im, i) => ({
            product_id: p.id,
            url: im.url,
            is_primary: i === 0,
            sort_order: i,
          })),
        );
      }
      toast.success("Product created");
      nav({ to: "/admin/products" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="New product" description="Reseller ra ei product theke listing banabe." />
      <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="surface-card p-6">
            <h3 className="mb-4 text-sm font-semibold">Basics</h3>
            <div className="space-y-3">
              <Field label="Product name" required>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Short description">
                <input
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Full description">
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Brand">
                  <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputCls}>
                    <option value="">— None —</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                    <option value="">— None —</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          <div className="surface-card p-6">
            <h3 className="mb-1 text-sm font-semibold">Pricing & delivery</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Buying price + packaging + delivery — ei cost break-down reseller
              dekhbe jate profit clear thake.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Buying price (৳)" required>
                <input required type="number" min={0} value={buying} onChange={(e) => setBuying(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Packaging cost (৳)">
                <input type="number" min={0} value={packaging} onChange={(e) => setPackaging(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Stock">
                <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Delivery inside Dhaka (৳)">
                <input type="number" min={0} value={deliveryIn} onChange={(e) => setDeliveryIn(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Delivery outside Dhaka (৳)">
                <input type="number" min={0} value={deliveryOut} onChange={(e) => setDeliveryOut(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Suggested sell price (৳)" required>
                <input required type="number" min={0} value={suggested} onChange={(e) => setSuggested(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Minimum sell price (৳)" required>
                <input required type="number" min={0} value={minSell} onChange={(e) => setMinSell(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>

          <div className="surface-card p-6">
            <h3 className="mb-1 text-sm font-semibold">SEO</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Reseller ra chaile override korte parbe nijer listing e.
            </p>
            <div className="space-y-3">
              <Field label="Meta title (≤ 60 chars)">
                <input maxLength={60} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Meta description (≤ 160 chars)">
                <textarea maxLength={160} rows={2} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Keywords (comma separated)">
                <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-6">
            <h3 className="mb-3 text-sm font-semibold">Images</h3>
            <ImageUploader
              bucket="product-images"
              folder="master"
              value={images}
              onChange={setImages}
              multiple
            />
          </div>
          <div className="surface-card space-y-2 p-6">
            <button
              disabled={busy}
              className="btn-brand flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save product
            </button>
            <button
              type="button"
              onClick={() => nav({ to: "/admin/products" })}
              className="w-full rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
