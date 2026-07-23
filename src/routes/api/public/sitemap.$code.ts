import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/sitemap/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
        );
        const { data: r } = await supabase
          .from("resellers")
          .select("id, code, custom_domain")
          .eq("code", params.code)
          .eq("status", "active")
          .maybeSingle();
        if (!r) return new Response("Not found", { status: 404 });

        const { data: listings } = await supabase
          .from("reseller_listings")
          .select("updated_at, products(slug, updated_at)")
          .eq("reseller_id", r.id)
          .eq("is_active", true);

        const base = r.custom_domain ? `https://${r.custom_domain}` : `https://example.com/s/${r.code}`;
        const urls = [
          `<url><loc>${base}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
          ...(listings ?? []).map((l) => {
            const p = (Array.isArray(l.products) ? l.products[0] : l.products) as { slug: string; updated_at: string } | null;
            if (!p) return "";
            const path = r.custom_domain ? `/p/${p.slug}` : `/s/${r.code}/p/${p.slug}`;
            const loc = r.custom_domain ? `https://${r.custom_domain}${path}` : `https://example.com${path}`;
            return `<url><loc>${loc}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`;
          }),
        ].join("");

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          { headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" } },
        );
      },
    },
  },
});
