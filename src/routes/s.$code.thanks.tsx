import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackPurchase } from "@/lib/tracking";
import { useServerFn } from "@tanstack/react-start";
import { trackPurchaseServer } from "@/lib/capi.functions";
import { useStore } from "@/components/store/store-context";
import { cx, Heading, muted, PrimaryButton } from "@/components/store/ui";

export const Route = createFileRoute("/s/$code/thanks")({
  validateSearch: (s: Record<string, unknown>) => ({ n: typeof s.n === "string" ? s.n : "" }),
  component: Thanks,
});

function Thanks() {
  const { code } = Route.useParams();
  const { n } = Route.useSearch();
  const fired = useRef(false);
  const { content } = useStore();
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
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--st-primary)]/15 text-[var(--st-primary)]">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <Heading as="h1" className="mt-5 text-2xl md:text-3xl">
        {content.text("co_success")}
      </Heading>
      <p className={cx("mt-3 text-sm", muted)}>
        Order number: <span className="font-mono font-semibold text-[var(--st-fg)]">{n}</span>
      </p>
      <p className={cx("mt-2 text-sm leading-relaxed", muted)}>{content.text("co_success_note")}</p>
      <div className="mt-7 flex justify-center">
        <Link to="/s/$code" params={{ code }}>
          <PrimaryButton>Continue shopping</PrimaryButton>
        </Link>
      </div>
    </div>
  );

}
