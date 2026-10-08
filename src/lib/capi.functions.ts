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
  const { runCapiLocal } = await import("./capi.server");
  try { return await runCapiLocal(name, data); } catch (e) { console.error("[capi]", e); return null; }
}
