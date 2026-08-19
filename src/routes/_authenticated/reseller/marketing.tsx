import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReseller } from "@/lib/app-data";
import { PageHeader } from "@/components/ui-kit";
import { Facebook, Zap, LineChart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reseller/marketing")({
  component: ResellerMarketing,
});

type Platform = "facebook" | "tiktok" | "ga4";
type Row = { id?: string; platform: Platform; is_active: boolean; pixel_id: string; access_token: string; test_event_code: string };
const DEFAULTS: Row[] = [
  { platform: "facebook", is_active: false, pixel_id: "", access_token: "", test_event_code: "" },
  { platform: "tiktok", is_active: false, pixel_id: "", access_token: "", test_event_code: "" },
  { platform: "ga4", is_active: false, pixel_id: "", access_token: "", test_event_code: "" },
];

function ResellerMarketing() {
  const [rows, setRows] = useState<Row[]>(DEFAULTS);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const rs = await getMyReseller(userData.user.id);
    if (!rs) { setLoading(false); return; }
    setResellerId(rs.id);
    const { data } = await supabase.from("marketing_configs").select("*").eq("reseller_id", rs.id);
    const map = new Map((data ?? []).map((r: any) => [r.platform, r]));
    setRows(DEFAULTS.map((d) => {
      const f = map.get(d.platform) as any;
      return f ? { id: f.id, platform: d.platform, is_active: f.is_active, pixel_id: f.pixel_id ?? "", access_token: f.access_token ?? "", test_event_code: f.test_event_code ?? "" } : d;
    }));
    setLoading(false);
  }

  async function save(r: Row) {
    if (!resellerId) return;
    const payload = { platform: r.platform, is_active: r.is_active, pixel_id: r.pixel_id || null, access_token: r.access_token || null, test_event_code: r.test_event_code || null, reseller_id: resellerId };
    const { error } = r.id
      ? await supabase.from("marketing_configs").update(payload).eq("id", r.id)
      : await supabase.from("marketing_configs").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); load(); }
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const meta = {
    facebook: { icon: <Facebook className="h-4 w-4" />, name: "Facebook Pixel + CAPI", pixelLabel: "Pixel ID" },
    tiktok: { icon: <Zap className="h-4 w-4" />, name: "TikTok Events API", pixelLabel: "Pixel ID" },
    ga4: { icon: <LineChart className="h-4 w-4" />, name: "Google Analytics 4", pixelLabel: "Measurement ID" },
  } as const;

  return (
    <div>
      <PageHeader title="Marketing & tracking" description="Add your Pixel and Access Token — customer events go to your ads account." />
      <div className="grid gap-4 lg:grid-cols-3">
        {rows.map((r, idx) => {
          const m = meta[r.platform];
          return (
            <div key={r.platform} className="surface-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">{m.icon}</div>
                <div className="flex-1 font-semibold">{m.name}</div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={r.is_active} onChange={(e) => { const c=[...rows]; c[idx]={...r,is_active:e.target.checked}; setRows(c); }} /> Active
                </label>
              </div>
              <div className="space-y-3">
                <Field label={m.pixelLabel}><input value={r.pixel_id} onChange={(e) => { const c=[...rows]; c[idx]={...r,pixel_id:e.target.value}; setRows(c); }} className={inp} /></Field>
                <Field label="Access Token / API Secret"><input type="password" value={r.access_token} onChange={(e) => { const c=[...rows]; c[idx]={...r,access_token:e.target.value}; setRows(c); }} className={inp} /></Field>
                <Field label="Test Event Code (optional)"><input value={r.test_event_code} onChange={(e) => { const c=[...rows]; c[idx]={...r,test_event_code:e.target.value}; setRows(c); }} className={inp} /></Field>
              </div>
              <button onClick={() => save(r)} className="btn-brand mt-4 rounded-md px-3 py-1.5 text-xs font-medium">Save</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="mb-1 block text-xs font-medium">{label}</label>{children}</div>);
}
