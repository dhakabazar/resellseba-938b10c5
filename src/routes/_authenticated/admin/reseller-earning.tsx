import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { TransactionReport } from "@/components/transaction-report";

export const Route = createFileRoute("/_authenticated/admin/reseller-earning")({
  component: AdminTransactionReportPage,
  head: () => ({
    meta: [
      { title: "Transaction report — Reseller earnings" },
      {
        name: "description",
        content: "All reseller order settlements, security deposits and withdrawals with running balance.",
      },
      { property: "og:title", content: "Transaction report — Reseller earnings" },
      { property: "og:description", content: "Filter by reseller and date to audit every money movement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminTransactionReportPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction report"
        description="Sob reseller er order profit / loss, deposit o withdraw — reseller ba date filter kore dekhun."
      />
      <TransactionReport admin />
    </div>
  );
}
