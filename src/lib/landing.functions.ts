import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  const [pCount, cCount, orders] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered"),
  ]);

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(6);

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, slug, suggested_price, reseller_price, short_description, is_featured, created_at, product_images(url, is_primary, sort_order)",
    )
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  return {
    totalProducts: pCount.count ?? 0,
    totalCategories: cCount.count ?? 0,
    totalSales: orders.count ?? 0,
    categories: categories ?? [],
    products: (products ?? []).map((p) => {
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
    }),
  };
});
