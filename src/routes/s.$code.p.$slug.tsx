import { createFileRoute } from "@tanstack/react-router";
import { ProductPageContent } from "@/components/store/pages/product-page-content";

export const Route = createFileRoute("/s/$code/p/$slug")({
  component: ProductPage,
  head: ({ params }) => {
    const label = params.slug.replace(/-/g, " ");
    return {
      meta: [
        { title: `${label} — Online Store` },
        { name: "description", content: `Order ${label} online with cash on delivery across Bangladesh.` },
        { property: "og:title", content: label },
        { property: "og:description", content: `Order ${label} with cash on delivery.` },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
});

function ProductPage() {
  const { code, slug } = Route.useParams();
  return <ProductPageContent slug={slug} code={code} />;
}
