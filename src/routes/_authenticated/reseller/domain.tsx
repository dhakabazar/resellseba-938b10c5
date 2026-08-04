import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { Globe, Loader2, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reseller/domain")({
  component: DomainPage,
});

type Row = { id: string; hostname: string; is_primary: boolean; ssl_status: string; verified_at: string | null };

function DomainPage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hostname, setHostname] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase.from("resellers").select("id").eq("user_id", user.id).maybeSingle();
      if (!r) return setLoading(false);
      setRid(r.id);
      const { data } = await supabase.from("reseller_domains").select("*").eq("reseller_id", r.id).order("created_at");
      setRows((data ?? []) as any);
      setLoading(false);
    })();
  }, [user]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!rid) return;
    const host = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return toast.error("Enter a valid domain (e.g. shop.example.com)");
    setBusy(true);
    const { error } = await supabase.from("reseller_domains").insert({
      reseller_id: rid, hostname: host, is_primary: rows.length === 0, ssl_status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setHostname("");
    const { data } = await supabase.from("reseller_domains").select("*").eq("reseller_id", rid).order("created_at");
    setRows((data ?? []) as any);
  }

  async function makePrimary(id: string) {
    if (!rid) return;
    await supabase.from("reseller_domains").update({ is_primary: false }).eq("reseller_id", rid);
    await supabase.from("reseller_domains").update({ is_primary: true }).eq("id", id);
    const { data } = await supabase.from("reseller_domains").select("*").eq("reseller_id", rid).order("created_at");
    setRows((data ?? []) as any);
  }

  async function remove(id: string) {
    if (!confirm("Remove this domain?")) return;
    await supabase.from("reseller_domains").delete().eq("id", id);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Custom domain" description="Connect your own domain (e.g. shop.brand.com). Free SSL via Cloudflare after DNS setup." />

      <form onSubmit={add} className="surface-card mb-5 flex flex-wrap items-end gap-2 p-4">
        <div className="flex-1 min-w-[220px]">
          <label className="mb-1 block text-xs font-medium">Hostname</label>
          <input required value={hostname} onChange={(e) => setHostname(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="shop.yourbrand.com" />
        </div>
        <button disabled={busy} className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"><Plus className="h-4 w-4" /> Add</button>
      </form>

      <div className="surface-card mb-5 p-5 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold"><Globe className="h-4 w-4 text-primary" /> DNS setup instructions</div>
        <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
          <li>Go to your domain provider (GoDaddy, Namecheap, etc.) DNS settings.</li>
          <li>Add a <code className="rounded bg-muted px-1 text-xs">CNAME</code> record — Name: <code className="rounded bg-muted px-1 text-xs">shop</code> (or your subdomain), Value: <code className="rounded bg-muted px-1 text-xs">resellhub-proxy.cloudflareaccess.com</code></li>
          <li>For a root domain, add an <code className="rounded bg-muted px-1 text-xs">A</code> record with the Cloudflare SaaS IP (provided by admin).</li>
          <li>DNS can take 5–60 minutes to propagate. SSL is issued automatically after.</li>
        </ol>
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="surface-card flex items-center gap-3 p-4">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary"><Globe className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 font-medium">
                {r.hostname}
                {r.is_primary && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">Primary</span>}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {r.verified_at ? <><CheckCircle2 className="h-3 w-3 text-success" /> Verified · SSL {r.ssl_status}</>
                  : <><AlertCircle className="h-3 w-3 text-warning" /> Pending verification</>}
              </div>
            </div>
            {!r.is_primary && (
              <button onClick={() => makePrimary(r.id)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Make primary</button>
            )}
            <button onClick={() => remove(r.id)} className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No custom domains yet.</div>}
      </div>
    </div>
  );
}
