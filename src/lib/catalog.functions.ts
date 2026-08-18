import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { pickImage, type ImgRow } from "@/lib/catalog.server";

/** Public master catalog — active products only, no cost/profit leak beyond reseller price. */
export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const [cats, brands, prods] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("brands")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, name, slug, product_code, short_description, suggested_price, reseller_price, category_id, brand_id, is_featured, created_at, product_images(url, is_primary, sort_order)",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const products = (prods.data ?? []).map((p) => {
    const row = p as Record<string, any>;
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      code: row.product_code as string,
      short: (row.short_description ?? "") as string,
      price: Number(row.suggested_price ?? 0),
      resellerPrice: Number(row.reseller_price ?? 0),
      categoryId: row.category_id as string | null,
      brandId: row.brand_id as string | null,
      featured: Boolean(row.is_featured),
      image: pickImage(row.product_images),
      images: [...((row.product_images ?? []) as ImgRow[])]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
        .map((i) => i.url),
    };
  });

  return {
    categories: (cats.data ?? []).map((c) => ({
      ...c,
      count: products.filter((p) => p.categoryId === c.id).length,
    })),
    brands: brands.data ?? [],
    products,
  };
});

export const getCatalogProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug) }))
  .handler(async ({ data }) => {
    const { data: row } = await supabase
      .from("products")
      .select(
        "id, name, slug, product_code, short_description, description, suggested_price, reseller_price, keywords, stock, weight_grams, delivery_mode, delivery_inside, delivery_outside, delivery_flat, categories(name, slug), brands(name, slug), product_images(url, is_primary, sort_order, alt_text)",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!row) return null;
    const p = row as Record<string, any>;
    const images = [...((p.product_images ?? []) as ImgRow[])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
    );
    return {
      id: p.id as string,
      name: p.name as string,
      slug: p.slug as string,
      code: p.product_code as string,
      short: (p.short_description ?? "") as string,
      description: (p.description ?? "") as string,
      price: Number(p.suggested_price ?? 0),
      resellerPrice: Number(p.reseller_price ?? 0),
      stock: Number(p.stock ?? 0),
      weight: p.weight_grams as number | null,
      deliveryMode: p.delivery_mode as string,
      deliveryInside: Number(p.delivery_inside ?? 0),
      deliveryOutside: Number(p.delivery_outside ?? 0),
      deliveryFlat: Number(p.delivery_flat ?? 0),
      category: p.categories?.name ?? null,
      categorySlug: p.categories?.slug ?? null,
      brand: p.brands?.name ?? null,
      images: images.map((i) => i.url),
    };
  });
