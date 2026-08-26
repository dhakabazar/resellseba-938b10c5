import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { DepositLedger } from "@/components/deposit-ledger";
import { DepositRequestsAdmin } from "@/components/deposit-requests-admin";

export const Route = createFileRoute("/_authenticated/admin/deposit-transactions")({
  component: DepositTransactionsPage,
  head: () => ({
    meta: [
      { title: "Deposit transactions · Finance" },
      {
        name: "description",
        content: "Every reseller security deposit, refund and adjustment with edit and delete controls.",
      },
      { property: "og:title", content: "Deposit transactions · Finance" },
      { property: "og:description", content: "Audit and manage all reseller deposit entries in one ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DepositTransactionsPage() {
  return (
    <div>
      <PageHeader
        title="Deposit transactions"
        description="Every reseller deposit, refund and adjustment. Edit or delete an entry — balance and due update instantly."
      />
      <div className="surface-card mb-5 p-6">
        <div className="mb-1 text-sm font-semibold">Reseller submissions</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Deposits resellers paid through a manual payment method. Approving one adds it to their deposit balance.
        </p>
        <DepositRequestsAdmin />
      </div>

      <div className="surface-card p-6">
        <DepositLedger />
      </div>
    </div>
  );
}
