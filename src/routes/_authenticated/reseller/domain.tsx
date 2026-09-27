import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { Globe, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { dnsHostLabel, isApexHostname, groupDomainRows } from "@/lib/hostname-utils";
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

/** The single DNS record this row needs — type/host/value, ready to copy. */
function recordFor(row: DomainRow, guide: DnsGuide | null): { type: "A" | "CNAME"; host: string; value: string } {
  const host = dnsHostLabel(row.hostname);
  const apex = isApexHostname(row.hostname);
  if (row.mode === "dns") {
    if (apex && guide?.serverIp) return { type: "A", host, value: guide.serverIp };
    return { type: "CNAME", host, value: guide?.serverCname || row.dns_target || "" };
  }
  if (apex && guide?.aRecordIp) return { type: "A", host, value: guide.aRecordIp };
  return { type: "CNAME", host, value: row.dns_target || guide?.cnameTarget || "" };
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
  const [confirmGroup, setConfirmGroup] = useState<DomainRow[] | null>(null);

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
  function ensureIds(group: DomainRow[]): string[] | null {
    const ids = group.map((r) => r.id).filter(Boolean);
    if (ids.length === group.length) return ids;
    toast.error("ডোমেইনটি এখনো সেভ হয়নি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।");
    void reload().catch(() => {});
    return null;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    try {
      await connect({ data: { hostname, mode } });
      // Re-fetch (not just append) — connecting an apex domain also auto-adds
      // its "www." counterpart, so the list can gain more than one new row.
      await reload();
      setHostname("");
      toast.success("ডোমেইন যুক্ত হয়েছে — এখন নিচের DNS রেকর্ডগুলো যোগ করুন");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  /** Checks every hostname in the group (apex + its www) in one go. */
  async function checkGroup(group: DomainRow[]) {
    const ids = ensureIds(group);
    if (!ids) return;
    const busyKey = group[0].id;
    setBusy(busyKey);
    try {
      const settled = await Promise.allSettled(ids.map((id) => refresh({ data: { id } })));
      const updated = new Map<string, DomainRow>();
      settled.forEach((s) => {
        if (s.status === "fulfilled") updated.set(s.value.id, s.value);
      });
      setRows((rs) => rs.map((r) => updated.get(r.id) ?? r));
      const failed = settled.filter((s) => s.status === "rejected").length;
      if (failed > 0) toast.error(`${failed} টা রেকর্ড চেক করা যায়নি`);
      else toast.success(group.every((r) => updated.get(r.id)?.verified_at) ? "ডোমেইন লাইভ হয়েছে" : "স্ট্যাটাস আপডেট হয়েছে");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function makePrimary(group: DomainRow[]) {
    const ids = ensureIds(group);
    if (!ids) return;
    const id = ids[0];
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
    if (!confirmGroup) return;
    const ids = ensureIds(confirmGroup);
    if (!ids) {
      setConfirmGroup(null);
      return;
    }
    const busyKey = confirmGroup[0].id;
    setBusy(busyKey);
    try {
      const settled = await Promise.allSettled(ids.map((id) => remove({ data: { id } })));
      const removedIds = new Set(ids.filter((_, i) => settled[i].status === "fulfilled"));
      setRows((rs) => rs.filter((r) => !removedIds.has(r.id)));
      const failed = settled.filter((s) => s.status === "rejected").length;
      if (failed > 0) toast.error(`${failed} টা রেকর্ড সরানো যায়নি`);
      else toast.success("ডোমেইন সরানো হয়েছে");
      setConfirmGroup(null);
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

      <div className="grid gap-3">
        {groupDomainRows(rows).map((group) => {
          const primaryRow = group.find((r) => r.is_primary) ?? group[0];
          const allVerified = group.every((r) => r.verified_at);
          const busyKey = group[0].id;
          return (
            <div key={group.map((r) => r.id).join("+")} className="surface-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {group[0].hostname}
                    {group.length > 1 && <span className="text-xs font-normal text-muted-foreground">+ www</span>}
                    {primaryRow.is_primary && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">Primary</span>}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {group[0].mode === "dns" ? "Server DNS" : "Cloudflare"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {allVerified ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" /> Live
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 text-warning" /> {group.some((r) => r.verified_at) ? "Partially live" : "Pending"}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => checkGroup(group)}
                  disabled={busy === busyKey}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
                >
                  {busy === busyKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check status
                </button>
                {!primaryRow.is_primary && (
                  <button onClick={() => makePrimary(group)} className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                    Make primary
                  </button>
                )}
                <button
                  onClick={() => setConfirmGroup(group)}
                  className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Remove domain"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {group.map((r) => {
                  const rec = recordFor(r, guide);
                  return (
                    <div key={r.id} className="rounded-md border bg-muted/30 p-3 text-xs">
                      <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground/80">
                        {r.hostname}
                        {r.verified_at ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-warning" />
                        )}
                        <span className="font-normal text-muted-foreground">
                          {r.verified_at ? "Live" : (r.ownership_status ?? "pending")} · SSL {r.ssl_status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-primary-soft px-1.5 py-0.5 font-mono font-semibold text-primary">{rec.type}</span>
                        <span className="text-muted-foreground">Host</span>
                        <CopyChip value={rec.host} />
                        <span className="text-muted-foreground">→ Value</span>
                        {rec.value ? (
                          <CopyChip value={rec.value} />
                        ) : (
                          <span className="italic text-muted-foreground">not set up yet — contact admin</span>
                        )}
                      </div>
                      {r.verification_txt_name && !r.verified_at && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t pt-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">TXT</span>
                          <span className="text-muted-foreground">Host</span>
                          <CopyChip value={r.verification_txt_name} />
                          <span className="text-muted-foreground">→ Value</span>
                          <CopyChip value={r.verification_txt_value ?? ""} />
                        </div>
                      )}
                      {r.last_error && <div className="mt-1.5 text-[11px] text-destructive">{r.last_error}</div>}
                    </div>
                  );
                })}
                <div className="text-[11px] text-muted-foreground">
                  DNS can take 5–60 minutes to update. Then press "Check status"
                  {group[0].mode === "dns" ? " to verify." : " — SSL is issued automatically."}
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No custom domains yet.</div>}
      </div>

      <ConfirmModal
        isOpen={!!confirmGroup}
        title="Remove this domain?"
        description="Your store will stop working on this domain and the SSL certificate will be deleted."
        detail={confirmGroup?.map((r) => r.hostname).join(", ")}
        confirmText="Remove"
        isLoading={!!confirmGroup && busy === confirmGroup[0].id}
        onClose={() => setConfirmGroup(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
