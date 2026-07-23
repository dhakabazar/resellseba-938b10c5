import { createFileRoute } from "@tanstack/react-router";

/** bKash callback: executes the pending paymentID and marks order paid. */
export const Route = createFileRoute("/api/public/payment/bkash-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orderNumber = url.searchParams.get("order") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const paymentID = url.searchParams.get("paymentID") ?? "";
        const bkashStatus = url.searchParams.get("status") ?? "";
        const origin = url.origin;
        const back = (ok: boolean) =>
          Response.redirect(
            ok
              ? `${origin}/s/${code}/thanks?n=${encodeURIComponent(orderNumber)}`
              : `${origin}/s/${code}/checkout`,
            303,
          );
        if (!orderNumber || bkashStatus !== "success" || !paymentID) return back(false);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, total, reseller_id")
          .eq("order_number", orderNumber)
          .maybeSingle();
        if (!order) return back(false);

        const { data: cfgs } = await supabaseAdmin
          .from("payment_configs")
          .select("config, mode, reseller_id, is_active")
          .eq("method", "bkash")
          .or(`reseller_id.eq.${order.reseller_id},reseller_id.is.null`);
        const cfg =
          (cfgs ?? []).find((c: any) => c.is_active && c.reseller_id === order.reseller_id) ??
          (cfgs ?? []).find((c: any) => c.is_active && c.reseller_id === null);
        if (!cfg) return back(false);
        const c = cfg.config as { app_key?: string; app_secret?: string; username?: string; password?: string };
        const isLive = cfg.mode === "live";
        const base = isLive
          ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
          : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";

        // grant token
        const tokRes = await fetch(`${base}/tokenized/checkout/token/grant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            username: c.username!,
            password: c.password!,
          },
          body: JSON.stringify({ app_key: c.app_key, app_secret: c.app_secret }),
        });
        const tokBody = (await tokRes.json().catch(() => ({}))) as any;
        if (!tokBody.id_token) return back(false);

        const exRes = await fetch(`${base}/tokenized/checkout/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
            authorization: tokBody.id_token,
            "x-app-key": c.app_key!,
          },
          body: JSON.stringify({ paymentID }),
        });
        const exBody = (await exRes.json().catch(() => ({}))) as any;
        const ok =
          exBody.transactionStatus === "Completed" &&
          Number(exBody.amount) >= Number(order.total) - 0.5;
        if (!ok) return back(false);

        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "paid",
            payment_method: "bkash",
            admin_note: `bkash_trxid:${exBody.trxID ?? paymentID}`,
          })
          .eq("id", order.id);

        return back(true);
      },
    },
  },
});
