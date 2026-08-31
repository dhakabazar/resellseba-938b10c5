import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-kit";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { getMyReseller } from "@/lib/app-data";
import { useAuth } from "@/lib/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/subscription")({
  component: ResellerSubscriptionPage,
  head: () => ({
    meta: [
      { title: "My monthly package · Reseller panel" },
      {
        name: "description",
        content: "Choose a monthly package — panel only or panel plus storefront — and pay for 1, 6 or 12 months.",
      },
      { property: "og:title", content: "My monthly package" },
      { property: "og:description", content: "Renew or upgrade your reseller package in a few taps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResellerSubscriptionPage() {
  const { user } = useAuth();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const r = await getMyReseller(user.id);
      setResellerId(r?.id ?? null);
      setReady(true);
    })();
  }, [user]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My monthly package"
        description="Pick a package and duration, pay, and keep your panel and store running."
      />
      {!ready ? (
        <div className="grid h-48 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SubscriptionPanel resellerId={resellerId} />
      )}
    </div>
  );
}
