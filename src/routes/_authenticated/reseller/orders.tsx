import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/reseller/orders")({
  component: () => (
    <div>
      <PageHeader
        title="Orders"
        description="Customer order asle ekhane dekhben. Confirm kore admin ke forward korle courier booking hobe."
      />
      <EmptyState title="No orders yet" description="Storefront live howar por customer order gulo ekhane asbe." />
    </div>
  ),
});
