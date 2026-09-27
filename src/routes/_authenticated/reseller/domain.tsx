import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { Globe, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  listDomains,
  connectDomain,
  refreshDomain,
  setPrimaryDomain,
  disconnectDomain,
  getDnsGuide,
  type DomainRow,
  type DnsGuide,
} from "@/lib/cloudflare.functions";

export const Route = createFileRoute("/_authenticated/reseller/domain")({
  component: DomainPage,
});

function errorText(err: unknown) {
  if (err instanceof Response) return `অনুরোধটি ব্যর্থ হয়েছে (${err.status})`;
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  // Server-side field validation comes back as raw JSON — show something readable instead.
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.some((i: any) => Array.isArray(i?.path) && i.path.includes("id")))
        return "ডোমেইনটি খুঁজে পাওয়া যায়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।";
      return "দেওয়া তথ্যটি সঠিক নয় — আবার চেক করুন।";
    } catch {
      /* fall through */
    }
  }
  return trimmed || "কিছু একটা সমস্যা হয়েছে";
}


function CopyChip({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success("Copied");
      }}
      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono hover:bg-muted/70"
    >
      {value} <Copy className="h-3 w-3" />
    </button>
  );
}

function DomainPage() {
  const load = useServerFn(listDomains);
  const guideFn = useServerFn(getDnsGuide);
  const connect = useServerFn(connectDomain);
  const refresh = useServerFn(refreshDomain);
  const makePrimaryFn = useServerFn(setPrimaryDomain);
  const remove = useServerFn(disconnectDomain);

  const [rows, setRows] = useState<DomainRow[]>([]);
  const [guide, setGuide] = useState<DnsGuide | null>(null);
  const [hostname, setHostname] = useState("");
  const [mode, setMode] = useState<"cloudflare" | "dns">("cloudflare");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DomainRow | null>(null);

  async function reload() {
    const fresh = await load({ data: {} });
    setRows(fresh.filter((r) => !!r.id));
  }

  useEffect(() => {
    (async () => {
      try {
        const [d, g] = await Promise.all([load({ data: {} }), guideFn({})]);
        setRows(d.filter((r) => !!r.id));
        setGuide(g);
        setMode(g.cfReady ? "cloudflare" : g.dnsReady ? "dns" : "cloudflare");
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Every row action needs a saved domain id; without it the request cannot be made. */
  function ensureId(row: DomainRow | null): string | null {
    if (row?.id) return row.id;
    toast.error("ডোমেইনটি এখনো সেভ হয়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।");
    void reload().catch(() => {});
    return null;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    try {
      await connect({ data: { hostname, mode } });
      await reload();
      setHostname("");
      toast.success("ডোমেইন যুক্ত হয়েছে — এখন নিচের DNS রেকর্ডগুলো যোগ করুন");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function check(row: DomainRow) {
    const id = ensureId(row);
    if (!id) return;
    setBusy(id);
    try {
      const updated = await refresh({ data: { id } });
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(updated.verified_at ? "ডোমেইন লাইভ হয়েছে" : `এখনো ${updated.ownership_status ?? "pending"} · SSL ${updated.ssl_status}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function makePrimary(row: DomainRow) {
    const id = ensureId(row);
    if (!id) return;
    setBusy(id);
    try {
      await makePrimaryFn({ data: { id } });
      setRows((rs) => rs.map((r) => ({ ...r, is_primary: r.id === id })));
      toast.success("প্রাইমারি ডোমেইন আপডেট হয়েছে");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    const id = ensureId(confirm);
    if (!id) {
      setConfirm(null);
      return;
    }
    setBusy(id);
    try {
      await remove({ data: { id } });
      setRows((rs) => rs.filter((r) => r.id !== id));
      toast.success("ডোমেইন সরানো হয়েছে");
      setConfirm(null);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }


  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const cname = guide?.cnameTarget || guide?.zoneName || "";
  const both = !!guide?.cfReady && !!guide?.dnsReady;

  return (
    <div>
      <PageHeader title="Custom domain" description="Connect your own domain (e.g. shop.brand.com). Free SSL is issued automatically after DNS points to us." />

      {!guide?.active && (
        <div className="mb-5 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Custom domain connection is not enabled yet. Please contact the admin team.
        </div>
      )}

      <form onSubmit={add} className="surface-card mb-5 space-y-3 p-4">
        {both && (
          <div className="flex flex-wrap gap-2">
            {([
              { key: "cloudflare", label: "Cloudflare (auto SSL)" },
              { key: "dns", label: "Server DNS" },
            ] as const).map((o) => (
              <button
                type="button"
                key={o.key}
                onClick={() => setMode(o.key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  mode === o.key ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium">Hostname</label>
          <input
            required
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="shop.yourbrand.com"
          />
        </div>
        <button
          disabled={busy === "add" || !guide?.active}
          className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Connect
        </button>
      </div>
      </form>

      <div className="surface-card mb-5 p-5 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4 text-primary" /> DNS setup instructions
        </div>
        {mode === "cloudflare" ? (
          <ol className="ml-4 list-decimal space-y-1.5 text-muted-foreground">
            <li>Open your domain provider&apos;s DNS settings (GoDaddy, Namecheap, Cloudflare…).</li>
            <li>
              Subdomain: add a <code className="rounded bg-muted px-1 text-xs">CNAME</code> record pointing to{" "}
              {cname ? <CopyChip value={cname} /> : <span className="italic">target will appear once admin sets it up</span>}
            </li>
            {guide?.aRecordIp && (
              <li>
                Root domain: add an <code className="rounded bg-muted px-1 text-xs">A</code> record to <CopyChip value={guide.aRecordIp} />
              </li>
            )}
            <li>DNS can take 5–60 minutes. Then press “Check status” — SSL is issued automatically.</li>
          </ol>
        ) : (
          <ol className="ml-4 list-decimal space-y-1.5 text-muted-foreground">
            <li>Open your domain provider&apos;s DNS settings.</li>
            {guide?.serverIp && (
              <li>
                Root domain: add an <code className="rounded bg-muted px-1 text-xs">A</code> record to <CopyChip value={guide.serverIp} />
              </li>
            )}
            {guide?.serverCname && (
              <li>
                Subdomain: add a <code className="rounded bg-muted px-1 text-xs">CNAME</code> record to{" "}
                <CopyChip value={guide.serverCname} />
              </li>
            )}
            <li>Keep the record un-proxied (grey cloud) if your provider is Cloudflare.</li>
            <li>DNS can take 5–60 minutes. Then press “Check status” — we verify the record live.</li>
            {guide?.serverNote && <li className="text-foreground">{guide.serverNote}</li>}
          </ol>
        )}
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="surface-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {r.hostname}
                  {r.is_primary && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">Primary</span>}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {r.mode === "dns" ? "Server DNS" : "Cloudflare"}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {r.verified_at ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-success" /> Live · SSL {r.ssl_status}
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3 text-warning" /> {r.ownership_status ?? "pending"} · SSL {r.ssl_status}
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => check(r)}
                disabled={busy === r.id}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
              >
                {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check status
              </button>
              {!r.is_primary && (
                <button onClick={() => makePrimary(r)} className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                  Make primary
                </button>
              )}
              <button
                onClick={() => setConfirm(r)}
                className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Remove domain"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {r.verification_txt_name && !r.verified_at && (
              <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
                Ownership check pending. Add TXT record <CopyChip value={r.verification_txt_name} /> with value{" "}
                <CopyChip value={r.verification_txt_value ?? ""} />
              </div>
            )}
            {r.last_error && <div className="mt-2 text-[11px] text-destructive">{r.last_error}</div>}
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No custom domains yet.</div>}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        title="Remove this domain?"
        description="Your store will stop working on this domain and the SSL certificate will be deleted."
        detail={confirm?.hostname}
        confirmText="Remove"
        isLoading={busy === confirm?.id}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
