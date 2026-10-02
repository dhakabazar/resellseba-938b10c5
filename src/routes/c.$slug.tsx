import { createFileRoute } from "@tanstack/react-router";
import { CustomDomainStoreLayout } from "@/components/store/custom-domain-shell";
import { CategoryPageContent } from "@/routes/s.$code.c.$slug";

export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — Collection` },
      { name: "description", content: `Browse ${params.slug.replace(/-/g, " ")} products with cash on delivery.` },
      { property: "og:title", content: `${params.slug.replace(/-/g, " ")} — Collection` },
      { property: "og:description", content: `Browse ${params.slug.replace(/-/g, " ")} products.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomDomainCategoryRoute,
});

function CustomDomainCategoryRoute() {
  const { slug } = Route.useParams();
  return (
    <CustomDomainStoreLayout path={`/c/${slug}`}>
      {({ code }) => <CategoryPageContent slug={slug} code={code} />}
    </CustomDomainStoreLayout>
  );
}
