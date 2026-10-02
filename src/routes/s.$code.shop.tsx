import { createFileRoute } from "@tanstack/react-router";
import { ShopPageContent } from "@/components/store/pages/shop-page-content";

export const Route = createFileRoute("/s/$code/shop")({
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
  component: ShopPage,
});

function ShopPage() {
  return <ShopPageContent />;
}