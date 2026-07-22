import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { Truck } from "lucide-react";

const providers = [
  { name: "Steadfast", desc: "Nation-wide COD delivery — API key & secret dorkar." },
  { name: "Pathao", desc: "Fast Dhaka & major cities delivery — Client ID/Secret." },
  { name: "Carrybee", desc: "Nationwide COD — API token." },
  { name: "RedX", desc: "Nation-wide — API key." },
];

export const Route = createFileRoute("/_authenticated/admin/couriers")({
  component: () => (
    <div>
      <PageHeader
        title="Courier providers"
        description="Bangladeshi courier gulor credentials ekhane save korben. Api key gulo secure vault e store hobe."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <div key={p.name} className="surface-card p-6">
            <div className="mb-2 flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                <Truck className="h-4 w-4" />
              </div>
              <div className="font-semibold">{p.name}</div>
              <span className="ml-auto rounded-full bg-warning/20 px-2 py-0.5 text-xs text-warning-foreground">
                Not connected
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{p.desc}</p>
            <button className="mt-4 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              Configure
            </button>
          </div>
        ))}
      </div>
    </div>
  ),
});
