import { createFileRoute } from "@tanstack/react-router";
import { TransactionReport } from "@/components/transaction-report";

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  validateSearch: (s: Record<string, unknown>): { reseller?: string } => ({
    reseller: typeof s.reseller === "string" && s.reseller ? s.reseller : undefined,
  }),
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
  const { reseller } = Route.useSearch();
  return (
    <div className="space-y-5">
      <TransactionReport admin initialReseller={reseller ?? null} />
    </div>
  );
}
