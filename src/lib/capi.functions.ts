import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pageViewInput, viewContentInput, initiateCheckoutInput, purchaseInput } from "./capi-schemas";

export const trackPageViewServer = createServerFn({ method: "POST" })
  .inputValidator((d) => pageViewInput.parse(d))
  .handler(async ({ data }) => runCapi("trackPageViewServer", data) as ReturnType<typeof import("./capi.server").trackPageViewServerImpl>);

export const trackViewContentServer = createServerFn({ method: "POST" })
  .inputValidator((d) => viewContentInput.parse(d))
  .handler(async ({ data }) => runCapi("trackViewContentServer", data) as ReturnType<typeof import("./capi.server").trackViewContentServerImpl>);

export const trackInitiateCheckoutServer = createServerFn({ method: "POST" })
  .inputValidator((d) => initiateCheckoutInput.parse(d))
  .handler(async ({ data }) => runCapi("trackInitiateCheckoutServer", data) as ReturnType<typeof import("./capi.server").trackInitiateCheckoutServerImpl>);

export const trackPurchaseServer = createServerFn({ method: "POST" })
  .inputValidator((d) => purchaseInput.parse(d))
  .handler(async ({ data }) => runCapi("trackPurchaseServer", data) as ReturnType<typeof import("./capi.server").trackPurchaseServerImpl>);

export const getStoreMarketingPixelsServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => runCapi("getStoreMarketingPixelsServer", data) as ReturnType<typeof import("./capi.server").getStoreMarketingPixelsServerImpl>);

export const getPublicOrderDetailsServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderNumber: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => runCapi("getPublicOrderDetailsServer", data) as ReturnType<typeof import("./capi.server").getPublicOrderDetailsServerImpl>);

async function runCapi(name: string, data: any): Promise<any> {
  const { hasPrivilegedDb, platformOrigin } = await import("@/lib/gateways/bridge.server");
  if (hasPrivilegedDb()) {
    const { runCapiLocal } = await import("./capi.server");
    return runCapiLocal(name, data);
  }
  const { getRequest } = await import("@tanstack/react-start/server");
  let here = "";
  try { here = new URL(getRequest().url).origin; } catch { /* ignore */ }
  let base = await platformOrigin("");
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
  if (!base || base === here) {
    console.error("[capi] no privileged key and no platform origin configured");
    return null;
  }
  try {
    const res = await fetch(`${base}/api/public/capi`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, data }),
    });
    if (!res.ok) {
      console.error("[capi] forward failed", res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("[capi] forward error", e);
    return null;
  }
}
