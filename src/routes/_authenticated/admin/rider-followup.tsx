import { createFileRoute } from "@tanstack/react-router";
import { RiderFollowupPage } from "@/components/rider-followup";

export const Route = createFileRoute("/_authenticated/admin/rider-followup")({
  head: () => ({
    meta: [
      { title: "Rider Followup · Admin" },
      { name: "description", content: "Track every parcel a courier rider is holding and how long it has been waiting." },
      { property: "og:title", content: "Rider Followup · Admin" },
      { property: "og:description", content: "Track every parcel a courier rider is holding and how long it has been waiting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RiderFollowupPage showReseller />,
});
