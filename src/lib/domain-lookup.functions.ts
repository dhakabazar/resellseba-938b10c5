import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resolveDomainToStoreCode = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ hostname: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const rawHost = data.hostname.toLowerCase().trim();
    if (
      !rawHost ||
      rawHost === "localhost" ||
      rawHost === "127.0.0.1" ||
      rawHost.endsWith(".lovable.app") ||
      rawHost.endsWith(".lovableproject.com") ||
      rawHost === "ecomsellerbd.com" ||
      (rawHost.endsWith(".ecomsellerbd.com") && rawHost !== "fallback.ecomsellerbd.com")
    ) {
      return null;
    }

    const cleanHost = rawHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const baseHost = cleanHost.replace(/^www\./, "");
    const wwwHost = `www.${baseHost}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Direct query on reseller_domains with admin bypass
    const { data: domainRows, error } = await supabaseAdmin
      .from("reseller_domains")
      .select("reseller_id, resellers!inner(code, status)")
      .or(`hostname.eq.${cleanHost},hostname.eq.${baseHost},hostname.eq.${wwwHost}`)
      .limit(1);

    if (error) {
      console.error("[resolveDomainToStoreCode] Error:", error.message);
    }

    const first = domainRows?.[0];
    const reseller = first?.resellers as unknown as { code?: string; status?: string } | null;

    if (reseller?.code && reseller.status === "active") {
      return reseller.code;
    }

    // 2. Fallback check: maybe the hostname matches a reseller code directly
    const { data: codeMatches } = await supabaseAdmin
      .from("resellers")
      .select("code, status")
      .eq("code", baseHost)
      .eq("status", "active")
      .limit(1);

    if (codeMatches?.[0]?.code) {
      return codeMatches[0].code;
    }

    return null;
  });
