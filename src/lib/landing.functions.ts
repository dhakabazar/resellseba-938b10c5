import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const PRODUCT_SELECT =
  "id, name, slug, suggested_price, reseller_price, short_description, is_featured, created_at, product_images(url, is_primary, sort_order)";

function mapProduct(p: unknown) {
  const row = p as Record<string, any>;
  const imgs = [...((row.product_images ?? []) as { url: string; is_primary: boolean; sort_order: number }[])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    main_image: imgs[0]?.url ?? null,
    price: Number(row.suggested_price ?? 0),
    base_price: Number(row.reseller_price ?? 0),
    description: (row.short_description ?? "") as string,
  };
}

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  const [pCount, cCount, orders] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["delivered", "partial"]),
  ]);

  const [{ data: allCategories }, { data: activeProducts }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("products").select("category_id").eq("is_active", true),
  ]);

  // Count active products per category, keep only non-empty categories
  const perCategory = new Map<string, number>();
  for (const row of (activeProducts ?? []) as { category_id: string | null }[]) {
    if (!row.category_id) continue;
    perCategory.set(row.category_id, (perCategory.get(row.category_id) ?? 0) + 1);
  }
  const categories = ((allCategories ?? []) as { id: string; name: string; slug: string; image_url: string | null }[])
    .filter((c) => (perCategory.get(c.id) ?? 0) > 0)
    .map((c) => ({ ...c, product_count: perCategory.get(c.id) ?? 0 }));

  // Featured products picked by admin
  const { data: featured } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  let products = (featured ?? []).map(mapProduct);

  // Fallback: most selling products
  if (products.length === 0) {
    const { data: items } = await supabase.from("order_items").select("product_id, quantity").limit(5000);
    const sold = new Map<string, number>();
    for (const it of (items ?? []) as { product_id: string | null; quantity: number }[]) {
      if (!it.product_id) continue;
      sold.set(it.product_id, (sold.get(it.product_id) ?? 0) + Number(it.quantity ?? 0));
    }
    const topIds = [...sold.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id);

    if (topIds.length > 0) {
      const { data: top } = await supabase.from("products").select(PRODUCT_SELECT).eq("is_active", true).in("id", topIds);
      products = (top ?? [])
        .map(mapProduct)
        .sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0));
    }

    // Still empty (no sales yet) → latest products
    if (products.length === 0) {
      const { data: latest } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      products = (latest ?? []).map(mapProduct);
    }
  }

  return {
    totalProducts: pCount.count ?? 0,
    totalCategories: cCount.count ?? 0,
    totalSales: orders.count ?? 0,
    categories,
    products,
  };
});
