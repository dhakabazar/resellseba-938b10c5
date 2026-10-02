import { createFileRoute } from "@tanstack/react-router";
import { ThanksPageContent } from "@/components/store/pages/thanks-page-content";

export const Route = createFileRoute("/s/$code/thanks")({
  head: () => ({
    meta: [
      { title: "Order received · Reseller Store" },
      { name: "description", content: "Order confirmation and verified payment result for reseller store customers." },
      { property: "og:title", content: "Order received · Reseller Store" },
      { property: "og:description", content: "View your order number and confirmed payment status after checkout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): { n: string; pay?: string; txn?: string } => ({
    n: typeof s.n === "string" ? s.n : "",
    ...(typeof s.pay === "string" ? { pay: s.pay } : {}),
    ...(typeof s.txn === "string" ? { txn: s.txn } : {}),
  }),
  component: Thanks,
});

function Thanks() {
  const { code } = Route.useParams();
  const { n, pay, txn } = Route.useSearch();
  return <ThanksPageContent code={code} n={n} pay={pay} txn={txn} />;
}
