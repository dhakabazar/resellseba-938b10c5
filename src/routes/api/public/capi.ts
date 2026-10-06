import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Platform-origin endpoint for server-side Pixel/CAPI events. Custom domains
// (Cloudflare) lack the privileged key and forward here. Same inputs and
// outputs as the public server functions; no credentials are returned.
const Body = z.object({
  name: z.enum([
    "trackPageViewServer",
    "trackViewContentServer",
    "trackInitiateCheckoutServer",
    "trackPurchaseServer",
    "getStoreMarketingPixelsServer",
    "getPublicOrderDetailsServer",
  ]),
  data: z.record(z.string(), z.unknown()),
});

export const Route = createFileRoute("/api/public/capi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { hasPrivilegedDb } = await import("@/lib/gateways/bridge.server");
        if (!hasPrivilegedDb()) return new Response("Not available", { status: 503 });
        const { runCapiLocal } = await import("@/lib/capi.server");
        try {
          const result = await runCapiLocal(parsed.data.name, parsed.data.data);
          return new Response(JSON.stringify(result ?? null), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (e) {
          console.error("[capi route]", e);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
