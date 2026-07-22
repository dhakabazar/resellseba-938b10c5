import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/reseller/payouts")({
  component: () => (
    <div>
      <PageHeader
        title="Payouts"
        description="Delivered order er profit ekhane jomma hobe. Admin bKash/Nagad e payout korbe."
      />
      <EmptyState title="No payouts yet" description="Delivery confirm holei automatic profit ledger e add hobe." />
    </div>
  ),
});
