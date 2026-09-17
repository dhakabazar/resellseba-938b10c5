import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { pickImage, type ImgRow } from "@/lib/catalog.server";
import { mergeDeliverySettings, resolveDelivery } from "@/lib/delivery";

const PRODUCT_COLS =
  "id, brand_id, category_id, name, slug, product_code, short_description, suggested_price, reseller_price, is_featured, created_at, product_images(url, is_primary, sort_order), product_categories(category_id)";

function mapProduct(p: Record<string, any>) {
  return {
    id: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    code: p.product_code as string,
    short: (p.short_description ?? "") as string,
    price: Number(p.suggested_price ?? 0),
    resellerPrice: Number(p.reseller_price ?? 0),
    categoryId: p.category_id as string | null,
    categoryIds: ((p.product_categories ?? []) as { category_id: string }[]).map((r) => r.category_id).filter(Boolean),
    brandId: p.brand_id as string | null,
    featured: Boolean(p.is_featured),
    image: pickImage(p.product_images),
    images: [...((p.product_images ?? []) as ImgRow[])]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
      .map((i) => i.url),
  };
}

/** Categories + brands only — small payload, loaded once for the filter bar. */
export const getCatalogFilters = createServerFn({ method: "GET" }).handler(async () => {
  const [cats, brands] = await Promise.all([
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
  ]);
  return { categories: cats.data ?? [], brands: brands.data ?? [] };
});

/** Paged public catalog — filtering, searching and paging all happen in the database. */
export const getCatalogPage = createServerFn({ method: "GET" })
  .inputValidator((d: { category?: string; brand?: string; q?: string; page?: number; perPage?: number }) => ({
    category: d.category ? String(d.category) : undefined,
    brand: d.brand ? String(d.brand) : undefined,
    q: d.q ? String(d.q).trim().slice(0, 80) : undefined,
    page: Math.max(1, Number(d.page ?? 1)),
    perPage: Math.min(200, Math.max(1, Number(d.perPage ?? 24))),
  }))
  .handler(async ({ data }) => {
    let productIds: string[] | null = null;

    if (data.category) {
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      if (!cat) return { total: 0, products: [] as ReturnType<typeof mapProduct>[] };
      const { data: links } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", (cat as any).id)
        ;
      productIds = (links ?? []).map((l: any) => l.product_id);
      if (productIds.length === 0) return { total: 0, products: [] as ReturnType<typeof mapProduct>[] };
    }

    let brandId: string | null = null;
    if (data.brand) {
      const { data: b } = await supabase.from("brands").select("id").eq("slug", data.brand).maybeSingle();
      if (!b) return { total: 0, products: [] as ReturnType<typeof mapProduct>[] };
      brandId = (b as any).id as string;
    }

    let query = supabase
      .from("products")
      .select(PRODUCT_COLS, { count: "exact" })
      .eq("is_active", true);

    if (productIds) query = query.in("id", productIds);
    if (brandId) query = query.eq("brand_id", brandId);
    if (data.q) {
      const term = data.q.replace(/[%,]/g, " ");
      query = query.or(`name.ilike.%${term}%,product_code.ilike.%${term}%`);
    }

    const from = (data.page - 1) * data.perPage;
    const { data: rows, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + data.perPage - 1);

    return { total: count ?? 0, products: (rows ?? []).map((r) => mapProduct(r as Record<string, any>)) };
  });

export const getCatalogProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug) }))
  .handler(async ({ data }) => {
    const { data: gs } = await supabase
      .from("global_settings")
      .select("advanced_settings")
      .eq("id", 1)
      .maybeSingle();
    const globalDelivery = mergeDeliverySettings((gs as any)?.advanced_settings?.delivery);

    const { data: row } = await supabase
      .from("products")
      .select(
        "id, brand_id, category_id, name, slug, product_code, short_description, description, suggested_price, reseller_price, keywords, stock, weight_grams, delivery_mode, delivery_inside, delivery_outside, delivery_sub, delivery_flat, categories(name, slug), brands(name, slug), product_images(url, is_primary, sort_order, alt_text), product_categories(category_id)",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();

    if (!row) return null;
    const p = row as Record<string, any>;
    const images = [...((p.product_images ?? []) as ImgRow[])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
    );
    const resolved = resolveDelivery(p as any, globalDelivery);
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
      /** Effective delivery (product override merged over the global rule). */
      deliveryMode: resolved.mode,
      deliverySource: resolved.source,
      deliveryInside: resolved.charges.inside_dhaka,
      deliverySub: resolved.charges.sub_dhaka,
      deliveryOutside: resolved.charges.outside_dhaka,
      deliveryFlat: resolved.mode === "custom" ? resolved.custom : resolved.flat,
      category: p.categories?.name ?? null,
      categorySlug: p.categories?.slug ?? null,
      brand: p.brands?.name ?? null,
      images: images.map((i) => i.url),
    };
  });
