import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { TutorialLibrary } from "@/components/tutorial-library";

export const Route = createFileRoute("/_authenticated/reseller/tutorials")({
  component: ResellerTutorialsPage,
  head: () => ({
    meta: [
      { title: "Video tutorials — Reseller Panel" },
      { name: "description", content: "Topic onujai video tutorial — store setup, order, courier o payout shikhun." },
      { property: "og:title", content: "Video tutorials — Reseller Panel" },
      { property: "og:description", content: "Store setup, order, courier o payout niye video guide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResellerTutorialsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Video tutorials"
        description="Topic onujai sajano video guide — click korlei ekhanei play hobe."
      />
      <TutorialLibrary compact />
    </div>
  );
}
