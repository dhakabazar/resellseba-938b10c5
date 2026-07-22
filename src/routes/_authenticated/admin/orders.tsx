import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: () => (
    <div>
      <PageHeader
        title="Orders"
        description="Reseller ra confirm kore forward korle order ekhane asbe. Ekhan theke apni courier booking korben."
      />
      <EmptyState
        title="No forwarded orders yet"
        description="Reseller order confirm & forward korle ekhane list hobe (Phase 3)."
      />
    </div>
  ),
});
