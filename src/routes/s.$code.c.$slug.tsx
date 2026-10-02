import { createFileRoute } from "@tanstack/react-router";
import { CategoryPageContent } from "@/components/store/pages/category-page-content";

export const Route = createFileRoute("/s/$code/c/$slug")({
  component: CategoryPage,
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
});

function CategoryPage() {
  const { code, slug } = Route.useParams();
  return <CategoryPageContent slug={slug} code={code} />;
}
