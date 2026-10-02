import { createFileRoute } from "@tanstack/react-router";
import { CustomDomainStoreLayout } from "@/components/store/custom-domain-shell";
import { CheckoutPageContent } from "@/routes/s.$code.checkout";

type Search = { l?: string; q?: number; pay?: string };

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout · Online Store" },
      { name: "description", content: "Complete your order securely." },
      { property: "og:title", content: "Checkout · Online Store" },
      { property: "og:description", content: "Complete your order securely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    l: typeof s.l === "string" ? s.l : undefined,
    q: s.q ? Number(s.q) : undefined,
    pay: typeof s.pay === "string" ? s.pay : undefined,
  }),
  component: CustomDomainCheckoutRoute,
});

function CustomDomainCheckoutRoute() {
  const { l: directListing, q: directQty, pay: payFlag } = Route.useSearch();
  return (
    <CustomDomainStoreLayout path="/checkout">
      {({ code }) => (
        <CheckoutPageContent
          code={code}
          directListing={directListing}
          directQty={directQty}
          payFlag={payFlag}
        />
      )}
    </CustomDomainStoreLayout>
  );
}
