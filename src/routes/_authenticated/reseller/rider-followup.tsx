import { createFileRoute } from "@tanstack/react-router";
import { RiderFollowupPage } from "@/components/rider-followup";

export const Route = createFileRoute("/_authenticated/reseller/rider-followup")({
  head: () => ({
    meta: [
      { title: "Rider Followup · My orders" },
      { name: "description", content: "See which of your orders are with a delivery rider right now." },
      { property: "og:title", content: "Rider Followup · My orders" },
      { property: "og:description", content: "See which of your orders are with a delivery rider right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RiderFollowupPage showReseller={false} />,
});
