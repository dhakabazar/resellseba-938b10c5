import { createFileRoute } from "@tanstack/react-router";
import { CustomDomainStoreLayout } from "@/components/store/custom-domain-shell";
import { ShopPageContent } from "@/components/store/pages/shop-page-content";

type ShopSearch = { q?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): ShopSearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "All Products — Online Store" },
      { name: "description", content: "Browse all available products with cash on delivery across Bangladesh." },
      { property: "og:title", content: "All Products — Online Store" },
      { property: "og:description", content: "Browse all available products." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomDomainShopRoute,
});

function CustomDomainShopRoute() {
  const { q } = Route.useSearch();
  return (
    <CustomDomainStoreLayout path="/shop">
      {() => <ShopPageContent query={q} />}
    </CustomDomainStoreLayout>
  );
}
