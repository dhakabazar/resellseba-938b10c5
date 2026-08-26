import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Hand, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { ManualMethods } from "@/components/payments/manual-methods";
import { GatewayGrid } from "@/components/payments/gateway-grid";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
  head: () => ({
    meta: [
      { title: "Payment methods · Admin" },
      {
        name: "description",
        content:
          "Set up manual wallet and bank methods plus automatic payment gateways used at storefront checkout and for reseller security deposits.",
      },
      { property: "og:title", content: "Payment methods · Admin" },
      {
        property: "og:description",
        content: "Manual wallets and automatic gateways, configured in one clean place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tab = "manual" | "api";

function PaymentsPage() {
  const [tab, setTab] = useState<Tab>("manual");
  const [manualCount, setManualCount] = useState(0);
  const [activeGateways, setActiveGateways] = useState(0);

  return (
    <div>
      <PageHeader
        title="Payment methods"
        description="Two families, kept apart on purpose: manual methods your team verifies by hand, and automatic gateways that confirm payments themselves."
      />

      <div className="mb-5 inline-flex rounded-xl border bg-muted/30 p-1">
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")} count={manualCount}>
          <Hand className="h-3.5 w-3.5" /> Manual
        </TabButton>
        <TabButton active={tab === "api"} onClick={() => setTab("api")} count={activeGateways}>
          <Zap className="h-3.5 w-3.5" /> Automatic
        </TabButton>
      </div>

      <div className={tab === "manual" ? "" : "hidden"}>
        <ManualMethods onCountChange={setManualCount} />
      </div>
      <div className={tab === "api" ? "" : "hidden"}>
        <GatewayGrid onCountChange={setActiveGateways} />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors " +
        (active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
      <span className={"rounded-full px-1.5 text-[10px] " + (active ? "bg-primary/10 text-primary" : "bg-muted")}>
        {count}
      </span>
    </button>
  );
}
