import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reseller/domain")({
  component: () => (
    <div>
      <PageHeader
        title="Custom domain"
        description="Nijer domain connect korun — Cloudflare SaaS diye SSL automatic hobe (Phase 2)."
      />
      <div className="surface-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
          <Globe className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-semibold">Coming soon</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Domain add korun, TXT verification korun, ar apnar store customdomain e live
          hoye jabe. Cloudflare-managed SSL free.
        </p>
      </div>
    </div>
  ),
});
