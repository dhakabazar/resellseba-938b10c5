import { createFileRoute } from "@tanstack/react-router";
import { CustomDomainStoreLayout } from "@/components/store/custom-domain-shell";
import { ShopPageContent } from "@/routes/s.$code.shop";

export const Route = createFileRoute("/shop")({
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
  return (
    <CustomDomainStoreLayout path="/shop">
      {() => <ShopPageContent />}
    </CustomDomainStoreLayout>
  );
}
