import { createFileRoute } from "@tanstack/react-router";
import { CustomDomainStoreLayout } from "@/components/store/custom-domain-shell";
import { ProductPageContent } from "@/components/store/pages/product-page-content";

export const Route = createFileRoute("/p/$slug")({
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
  component: CustomDomainProductRoute,
});

function CustomDomainProductRoute() {
  const { slug } = Route.useParams();
  return (
    <CustomDomainStoreLayout path={`/p/${slug}`}>
      {({ code }) => <ProductPageContent slug={slug} code={code} />}
    </CustomDomainStoreLayout>
  );
}
