import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";
import { Facebook, Zap, LineChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  component: () => (
    <div>
      <PageHeader
        title="Marketing & ads"
        description="Pixel, Events API, conversion tracking — per reseller-o override kora jabe."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={<Facebook />} title="Facebook Pixel + CAPI" body="Pixel ID, Access Token, Test Event Code. Server-side deduplication chalu thakbe." />
        <Card icon={<Zap />} title="TikTok Events API" body="Pixel ID, Access Token. Purchase / AddToCart / ViewContent auto-fire hobe." />
        <Card icon={<LineChart />} title="Google Analytics 4" body="Measurement ID / API secret diye GA4 events pathano jabe." />
      </div>
    </div>
  ),
});

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="surface-card p-6">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary">{icon}</div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <button className="mt-4 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">Configure</button>
    </div>
  );
}
