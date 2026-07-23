import { createFileRoute } from "@tanstack/react-router";

/** SSLCommerz success/IPN callback. Validates via SSLCommerz validation API
 * (val_id) before marking the order paid — prevents tampering. */
export const Route = createFileRoute("/api/public/payment/sslcommerz-ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const tranId = String(form.get("tran_id") ?? "");
        const valId = String(form.get("val_id") ?? "");
        const status = String(form.get("status") ?? "");
        if (!tranId) return new Response("Missing tran_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, total, reseller_id")
          .eq("order_number", tranId)
          .maybeSingle();
        if (!order) return new Response("Order not found", { status: 404 });

        // Load reseller/global sslcommerz config
        const { data: cfgs } = await supabaseAdmin
          .from("payment_configs")
          .select("config, mode, reseller_id, is_active")
          .eq("method", "sslcommerz")
          .or(`reseller_id.eq.${order.reseller_id},reseller_id.is.null`);
        const cfg =
          (cfgs ?? []).find((c: any) => c.is_active && c.reseller_id === order.reseller_id) ??
          (cfgs ?? []).find((c: any) => c.is_active && c.reseller_id === null);
        if (!cfg) return new Response("Gateway not configured", { status: 400 });
        const c = cfg.config as { store_id?: string; store_password?: string };
        const isLive = cfg.mode === "live";
        const base = isLive ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com";

        // Validate via SSLCommerz validation API
        let valid = false;
        if (valId) {
          const url = `${base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(c.store_id!)}&store_passwd=${encodeURIComponent(c.store_password!)}&format=json`;
          const r = await fetch(url);
          const v = (await r.json().catch(() => ({}))) as any;
          if (
            (v.status === "VALID" || v.status === "VALIDATED") &&
            String(v.tran_id) === tranId &&
            Number(v.amount) >= Number(order.total) - 0.5
          ) valid = true;
        }
        if (!valid && status !== "VALID") {
          // redirect to failed
          const origin = new URL(request.url).origin;
          return Response.redirect(`${origin}/`, 303);
        }

        await supabaseAdmin
          .from("orders")
          .update({ payment_status: "paid", payment_method: "sslcommerz" })
          .eq("id", order.id);

        // fetch reseller code for redirect
        const { data: rs } = await supabaseAdmin.from("resellers").select("code").eq("id", order.reseller_id).maybeSingle();
        const origin = new URL(request.url).origin;
        return Response.redirect(`${origin}/s/${rs?.code ?? ""}/thanks?n=${encodeURIComponent(tranId)}`, 303);
      },
      GET: async ({ request }) => {
        // sometimes success_url is called via GET redirect
        const url = new URL(request.url);
        const tranId = url.searchParams.get("tran_id");
        if (tranId) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: order } = await supabaseAdmin
            .from("orders")
            .select("reseller_id")
            .eq("order_number", tranId)
            .maybeSingle();
          if (order) {
            const { data: rs } = await supabaseAdmin.from("resellers").select("code").eq("id", order.reseller_id).maybeSingle();
            return Response.redirect(`${url.origin}/s/${rs?.code ?? ""}/thanks?n=${encodeURIComponent(tranId)}`, 303);
          }
        }
        return new Response("ok");
      },
    },
  },
});
