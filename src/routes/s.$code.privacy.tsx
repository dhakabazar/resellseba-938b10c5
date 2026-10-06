import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPageContent } from "@/components/store/pages/privacy-page-content";

export const Route = createFileRoute("/s/$code/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Online Store" },
      { name: "description", content: "Privacy and data protection policy for our online store." },
      { property: "og:title", content: "Privacy Policy — Online Store" },
      { property: "og:description", content: "Privacy and data protection policy for our online store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <PrivacyPageContent />;
}
