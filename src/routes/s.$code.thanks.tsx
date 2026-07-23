import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackPurchase } from "@/lib/tracking";
import { useServerFn } from "@tanstack/react-start";
import { trackPurchaseServer } from "@/lib/capi.functions";

export const Route = createFileRoute("/s/$code/thanks")({
  validateSearch: (s: Record<string, unknown>) => ({ n: typeof s.n === "string" ? s.n : "" }),
  component: Thanks,
});

function Thanks() {
  const { code } = Route.useParams();
  const { n } = Route.useSearch();
  const fired = useRef(false);
  const capi = useServerFn(trackPurchaseServer);

  useEffect(() => {
    if (!n || fired.current) return;
    fired.current = true;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,total,order_items(product_id,product_name,reseller_price,quantity)")
        .eq("order_number", n)
        .maybeSingle();
      if (!data) return;
      const eventId = `purchase_${data.id}`;
      trackPurchase({
        orderNumber: n,
        total: Number(data.total),
        items: (data.order_items ?? []).map((i) => ({
          id: i.product_id ?? "",
          name: i.product_name,
          price: Number(i.reseller_price),
          qty: i.quantity,
        })),
        eventId,
      });
      // fire server-side CAPI (deduped by eventId)
      capi({ data: { orderNumber: n, code, eventId } }).catch(() => {});
    })();
  }, [n, code, capi]);


  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/20 text-success">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Order placed!</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Order number: <span className="font-mono font-semibold text-foreground">{n}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Amra apnake shiggro call kore confirm korbo. Dhonnobad!
      </p>
      <Link
        to="/s/$code"
        params={{ code }}
        className="mt-6 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--store-primary, hsl(var(--primary)))" }}
      >
        Continue shopping
      </Link>
    </div>
  );
}
