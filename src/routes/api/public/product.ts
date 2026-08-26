/**
 * Public product feed — lets another instance of this platform import a product
 * by simply pasting a panel / storefront product link.
 *
 * GET /api/public/product?slug=<product-slug>
 * GET /api/public/product?code=<product-code>
 *
 * Read-only, active products only, no cost/profit fields are exposed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });

export const Route = createFileRoute("/api/public/product")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug")?.trim() || "";
        const code = url.searchParams.get("code")?.trim() || "";
        if (!slug && !code) return json({ error: "slug or code required" }, 400);

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
        );

        let q = supabase
          .from("products")
          .select(
            "id, name, slug, sku, product_code, short_description, description, suggested_price, reseller_price, meta_title, meta_description, og_image_url, is_active, brands(name), categories(name), product_images(url, is_primary, sort_order)",
          )
          .eq("is_active", true)
          .limit(1);
        q = slug ? q.eq("slug", slug) : q.eq("product_code", code.toUpperCase());

        const { data, error } = await q.maybeSingle();
        if (error) return json({ error: "lookup failed" }, 500);
        if (!data) return json({ error: "not found" }, 404);

        const images = [...((data.product_images ?? []) as { url: string; is_primary: boolean | null; sort_order: number | null }[])]
          .sort(
            (a, b) =>
              Number(!!b.is_primary) - Number(!!a.is_primary) ||
              Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
          )
          .map((i) => i.url)
          .filter((u) => typeof u === "string" && u.startsWith("https://"));

        const brand = (Array.isArray(data.brands) ? data.brands[0] : data.brands) as { name: string } | null;
        const category = (Array.isArray(data.categories) ? data.categories[0] : data.categories) as { name: string } | null;

        return json({
          ok: true,
          product: {
            name: data.name,
            slug: data.slug,
            sku: data.sku ?? data.product_code ?? null,
            productCode: data.product_code ?? null,
            shortDescription: data.short_description ?? "",
            description: data.description ?? "",
            price: Number(data.suggested_price ?? data.reseller_price ?? 0) || null,
            currency: "BDT",
            brand: brand?.name ?? null,
            category: category?.name ?? null,
            metaTitle: data.meta_title ?? "",
            metaDescription: data.meta_description ?? "",
            images: images.length ? images : data.og_image_url ? [data.og_image_url] : [],
          },
        });
      },
    },
  },
});
