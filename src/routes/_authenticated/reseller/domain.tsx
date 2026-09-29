import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Globe2, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Copy, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { dnsHostLabel, isApexHostname, groupDomainRows } from "@/lib/hostname-utils";
import {
  listDomains,
  connectDomain,
  refreshDomain,
  setPrimaryDomain,
  disconnectDomainGroup,
  getDnsGuide,
  type DomainRow,
  type DnsGuide,
} from "@/lib/cloudflare.functions";

export const Route = createFileRoute("/_authenticated/reseller/domain")({
  head: () => ({
    meta: [
      { title: "Custom Domain | Ecom Seller BD" },
      { name: "description", content: "Connect and manage your reseller store's custom domain and SSL status." },
      { property: "og:title", content: "Custom Domain | Ecom Seller BD" },
      { property: "og:description", content: "Connect and manage your reseller store's custom domain and SSL status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success("Copied");
      }}
      className="h-7 max-w-full gap-1.5 bg-muted px-2 font-mono text-[11px]"
    >
      <span className="truncate">{value}</span><Copy className="h-3 w-3" />
    </Button>
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
  const removeGroup = useServerFn(disconnectDomainGroup);

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
      const result = await removeGroup({ data: { id: ids[0] } });
      const removedIds = new Set(result.removedIds);
      setRows((rs) => rs.filter((r) => !removedIds.has(r.id)));
      if (result.failures.length > 0) {
        toast.error(`${result.failures.length}টি Cloudflare রেকর্ড সরানো যায়নি — আবার চেষ্টা করুন`);
        await reload();
      } else {
        toast.success("ডোমেইন ও www Cloudflare থেকে সরানো হয়েছে");
        setConfirmGroup(null);
      }
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
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Custom domain" description="নিজের ডোমেইনে স্টোর চালু করুন। মূল ডোমেইন ও www একসাথে পরিচালিত হবে।" />

      {!guide?.active && (
        <div className="mb-5 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Custom domain connection is not enabled yet. Please contact the admin team.
        </div>
      )}

      <form onSubmit={add} className="surface-card mb-6 overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold"><Globe2 className="h-4 w-4 text-primary" /> নতুন ডোমেইন যুক্ত করুন</div>
          <p className="mt-1 text-xs text-muted-foreground">abc.com লিখলে www.abc.com-ও একই সাথে যুক্ত হবে।</p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
        {both && (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-1">
            {([
              { key: "cloudflare", label: "Cloudflare (auto SSL)" },
              { key: "dns", label: "Server DNS" },
            ] as const).map((o) => (
              <Button
                type="button"
                variant="ghost"
                key={o.key}
                onClick={() => setMode(o.key)}
                className={`h-8 text-xs ${
                  mode === o.key ? "bg-background text-primary shadow-sm hover:bg-background" : "text-muted-foreground"
                }`}
              >
                {o.label}
              </Button>
            ))}
          </div>
        )}
       <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
         <div>
           <label className="mb-1.5 block text-xs font-semibold">Domain name</label>
          <input
            required
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
             className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
             placeholder="yourbrand.com"
          />
        </div>
         <Button
          disabled={busy === "add" || !guide?.active}
           className="h-10 px-5"
        >
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Connect
         </Button>
      </div>
       </div>
      </form>

      <div className="grid gap-3">
        {groupDomainRows(rows).map((group) => {
          const primaryRow = group.find((r) => r.is_primary) ?? group[0];
          const allVerified = group.every((r) => r.verified_at);
          const busyKey = group[0].id;
          return (
            <article key={group.map((r) => r.id).join("+")} className="surface-card overflow-hidden">
              <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="break-all">{group[0].hostname.replace(/^www\./, "")}</span>
                    {group.length > 1 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">সাথে www</span>}
                    {primaryRow.is_primary && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">Primary</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{group[0].mode === "dns" ? "Server DNS" : "Cloudflare"}</span><span>·</span>
                    {allVerified ? (
                      <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Live</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warning"><AlertCircle className="h-3 w-3" /> {group.some((r) => r.verified_at) ? "Partially live" : "Pending"}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="button"
                  onClick={() => checkGroup(group)}
                  disabled={busy === busyKey}
                  variant="outline"
                  size="sm"
                >
                  {busy === busyKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check status
                </Button>
                {!primaryRow.is_primary && (
                  <Button type="button" variant="outline" size="sm" onClick={() => makePrimary(group)}>
                    Make primary
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setConfirmGroup(group)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Remove domain"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> DNS records</div>
                <div className="overflow-hidden rounded-md border">
                  <div className="hidden grid-cols-[minmax(130px,1fr)_70px_90px_minmax(170px,1.4fr)] gap-3 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground sm:grid">
                    <span>Domain</span><span>Type</span><span>Host</span><span>Value</span>
                  </div>
                {group.map((r) => {
                  const rec = recordFor(r, guide);
                  return (
                    <div key={r.id} className="grid gap-2 border-b p-3 text-xs last:border-b-0 sm:grid-cols-[minmax(130px,1fr)_70px_90px_minmax(170px,1.4fr)] sm:items-center sm:gap-3">
                      <div className="flex min-w-0 items-center gap-1.5 font-medium">
                        {r.verified_at ? (
                          <CheckCircle2 className="h-3 w-3 text-success" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-warning" />
                        )}
                        <span className="truncate">{r.hostname}</span>
                      </div>
                      <span className="w-fit rounded bg-primary-soft px-1.5 py-0.5 font-mono font-semibold text-primary">{rec.type}</span>
                      <CopyChip value={rec.host} />
                      <div className="min-w-0">
                        {rec.value ? (
                          <CopyChip value={rec.value} />
                        ) : (
                          <span className="italic text-muted-foreground">not set up yet — contact admin</span>
                        )}
                      </div>
                      <div className="col-span-full flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                        <span>{r.verified_at ? "Live" : (r.ownership_status ?? "pending")}</span><span>·</span><span>SSL {r.ssl_status}</span>
                      </div>
                      {r.verification_txt_name && !r.verified_at && (
                        <div className="col-span-full flex flex-wrap items-center gap-1.5 rounded bg-muted/40 p-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">TXT</span>
                          <span className="text-muted-foreground">Host</span>
                          <CopyChip value={r.verification_txt_name} />
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <CopyChip value={r.verification_txt_value ?? ""} />
                        </div>
                      )}
                      {r.last_error && <div className="col-span-full text-[11px] text-destructive">{r.last_error}</div>}
                    </div>
                  );
                })}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  DNS can take 5–60 minutes to update. Then press "Check status"
                  {group[0].mode === "dns" ? " to verify." : " — SSL is issued automatically."}
                </div>
              </div>
            </article>
          );
        })}
        {rows.length === 0 && <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No custom domains yet.</div>}
      </div>

      <ConfirmModal
        isOpen={!!confirmGroup}
        title="Remove this domain?"
        description="মূল ডোমেইন ও www—দুটিই Cloudflare থেকে সরানো হবে এবং স্টোর এই ঠিকানায় বন্ধ হবে।"
        detail={confirmGroup?.map((r) => r.hostname).join(", ")}
        confirmText="Remove"
        isLoading={!!confirmGroup && busy === confirmGroup[0].id}
        onClose={() => setConfirmGroup(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}
