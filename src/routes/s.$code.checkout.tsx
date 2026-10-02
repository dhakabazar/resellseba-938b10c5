import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPageContent } from "@/components/store/pages/checkout-page-content";

type Search = {
  l?: string;
  q?: number;
  pay?: string;
};

export const Route = createFileRoute("/s/$code/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout · Online Store" },
      { name: "description", content: "Fast and easy checkout with cash on delivery across Bangladesh." },
      { property: "og:title", content: "Checkout · Online Store" },
      { property: "og:description", content: "Fast and easy checkout with cash on delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    l: typeof s.l === "string" ? s.l : undefined,
    q: s.q ? Number(s.q) : undefined,
    pay: typeof s.pay === "string" ? s.pay : undefined,
  }),
  component: Checkout,
});

function Checkout() {
  const { code } = Route.useParams();
  const { l: directListing, q: directQty, pay: payFlag } = Route.useSearch();
  return <CheckoutPageContent code={code} directListing={directListing} directQty={directQty} payFlag={payFlag} />;
}
