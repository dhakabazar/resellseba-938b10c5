import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { Wallet } from "lucide-react";

const methods = [
  { name: "bKash Personal", tag: "Manual", desc: "Personal number diye COD — customer manually send korbe." },
  { name: "bKash Merchant API", tag: "API", desc: "Automated tokenized checkout." },
  { name: "Nagad Personal", tag: "Manual", desc: "Personal number based." },
  { name: "Nagad API", tag: "API", desc: "Automated Nagad payment gateway." },
  { name: "Rocket Personal", tag: "Manual", desc: "Rocket personal number." },
  { name: "SSLCommerz", tag: "Gateway", desc: "All cards + MFS in one." },
  { name: "AamarPay / EPS", tag: "Gateway", desc: "Local aggregators." },
];

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: () => (
    <div>
      <PageHeader
        title="Payment methods"
        description="Personal MFS numbers, merchant APIs, aggregators — reseller ba admin level e configure kora jabe."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {methods.map((m) => (
          <div key={m.name} className="surface-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">{m.name}</div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.tag}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  ),
});
