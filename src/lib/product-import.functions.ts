import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ImportedProduct } from "@/lib/product-import.server";

/** Reads a marketplace product page and returns plain, sanitized fields. */
export const importProductFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    if (typeof input?.url !== "string" || input.url.length < 8 || input.url.length > 2000)
      throw new Error("Paste a valid product link.");
    return { url: input.url };
  })
  .handler(async ({ data, context }): Promise<ImportedProduct> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["products.manage", "products.create", "products.edit"]);
    const { scrapeProduct } = await import("@/lib/product-import.server");
    return scrapeProduct(data.url);
  });

/** Downloads one remote image server-side (CORS-safe) and returns verified bytes. */
export const fetchImportImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    if (typeof input?.url !== "string" || input.url.length > 2000) throw new Error("Invalid image link.");
    return { url: input.url };
  })
  .handler(async ({ data, context }): Promise<{ base64: string; mime: string }> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["products.manage", "products.create", "products.edit"]);
    const { fetchRemoteImage } = await import("@/lib/product-import.server");
    return fetchRemoteImage(data.url);
  });
