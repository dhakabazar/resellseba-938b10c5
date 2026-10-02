import { createFileRoute } from "@tanstack/react-router";
import { CustomDomainStoreLayout } from "@/components/store/custom-domain-shell";
import { ThanksPageContent } from "@/routes/s.$code.thanks";

export const Route = createFileRoute("/thanks")({
  head: () => ({
    meta: [
      { title: "Order received · Online Store" },
      { name: "description", content: "Order confirmation and verified payment result." },
      { property: "og:title", content: "Order received · Online Store" },
      { property: "og:description", content: "View your order number and confirmed payment status." },
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
  component: CustomDomainThanksRoute,
});

function CustomDomainThanksRoute() {
  const { n, pay, txn } = Route.useSearch();
  return (
    <CustomDomainStoreLayout path="/thanks">
      {({ code }) => <ThanksPageContent code={code} n={n} pay={pay} txn={txn} />}
    </CustomDomainStoreLayout>
  );
}
