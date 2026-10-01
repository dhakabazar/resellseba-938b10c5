import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { Button } from "@/components/ui/button";
import {
  Globe2,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Info,
  Clock,
  Lock,
} from "lucide-react";
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

function CopyableField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-xs italic text-muted-foreground">Admin not configured</span>;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label || "Value"} কপি করা হয়েছে!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="কপি করতে ক্লিক করুন"
      className="group inline-flex max-w-full items-center justify-between gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-xs text-foreground transition-all hover:border-primary/40 hover:bg-muted focus:outline-none"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      )}
    </button>
  );
}

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
      await reload();
      setHostname("");
      toast.success("ডোমেইন যুক্ত হয়েছে — এখন নিচের DNS রেকর্ডগুলো সেট করুন");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

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
      if (failed > 0) toast.error(`${failed}টি রেকর্ড চেক করা যায়নি`);
      else {
        const isLive = group.every((r) => updated.get(r.id)?.verified_at);
        toast.success(isLive ? "অভিনন্দন! ডোমেইন সফলভাবে সক্রিয় হয়েছে" : "স্ট্যাটাস আপডেট হয়েছে — DNS কার্যকর হতে কিছু সময় লাগতে পারে");
      }
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
        toast.error(`${result.failures.length}টি রেকর্ড সরানো যায়নি — আবার চেষ্টা করুন`);
        await reload();
      } else {
        toast.success("ডোমেইন সফলভাবে মুছে ফেলা হয়েছে");
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
      <div className="grid place-items-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );

  const both = !!guide?.cfReady && !!guide?.dnsReady;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Custom Domain"
        description="আপনার রিসেলার স্টোরের জন্য কাস্টম ডোমেইন যুক্ত করুন ও SSL স্ট্যাটাস ম্যানেজ করুন।"
      />

      {!guide?.active && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground">
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
          <span>কাস্টম ডোমেইন ফিচারটি বর্তমানে অ্যাডমিন কর্তৃক সক্রিয় করা হয়নি। বিস্তারিত জানতে অ্যাডমিন টিমের সাথে যোগাযোগ করুন।</span>
        </div>
      )}

      {/* Add Domain Form Card */}
      <form onSubmit={add} className="surface-card overflow-hidden rounded-xl border border-border/80 shadow-sm">
        <div className="border-b bg-muted/20 px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Globe2 className="h-5 w-5 text-primary" />
            <span>নতুন ডোমেইন যুক্ত করুন</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            শুধু মূল ডোমেইন (যেমন: <strong className="font-semibold text-foreground">yourbrand.com</strong>) লিখুন। 
            সিস্টেম স্বয়ংক্রিয়ভাবে <strong className="font-semibold text-foreground">www.yourbrand.com</strong> সহ পেয়ার করে কানেক্ট করবে।
          </p>
        </div>

        <div className="space-y-4 p-5">
          {both && (
            <div className="flex max-w-xs gap-1 rounded-lg bg-muted/60 p-1">
              {([
                { key: "cloudflare", label: "Cloudflare (Auto SSL)" },
                { key: "dns", label: "Server DNS" },
              ] as const).map((o) => (
                <button
                  type="button"
                  key={o.key}
                  onClick={() => setMode(o.key)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                    mode === o.key
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">ডোমেইন নাম</label>
              <div className="relative">
                <input
                  required
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border/80 bg-background px-3.5 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="yourbrand.com"
                />
              </div>
            </div>
            <Button
              disabled={busy === "add" || !guide?.active || !hostname.trim()}
              className="h-10 gap-2 px-6 font-medium shadow-sm"
            >
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>ডোমেইন যোগ করুন</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Connected Domains List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">সংযুক্ত ডোমেইন তালিকা</h2>
          <span className="text-xs text-muted-foreground">{groupDomainRows(rows).length}টি ডোমেইন সেটআপ</span>
        </div>

        {groupDomainRows(rows).map((group) => {
          const apexRow = group.find((r) => isApexHostname(r.hostname)) || group[0];
          const primaryRow = group.find((r) => r.is_primary) ?? apexRow;
          const allVerified = group.every((r) => !!r.verified_at);
          const busyKey = group[0].id;
          const baseDomain = group[0].hostname.replace(/^www\./, "");
          
          // Single TXT record extracted from root apex
          const txtHost = apexRow?.verification_txt_name || group.find((r) => r.verification_txt_name)?.verification_txt_name;
          const txtVal = apexRow?.verification_txt_value || group.find((r) => r.verification_txt_value)?.verification_txt_value;
          const hasPendingTxt = !allVerified && !!txtHost && !!txtVal;

          return (
            <article
              key={group.map((r) => r.id).join("+")}
              className="surface-card overflow-hidden rounded-xl border border-border/80 shadow-sm transition-all hover:border-border"
            >
              {/* Header Section */}
              <div className="flex flex-col gap-4 border-b bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3.5">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${
                    allVerified ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
                    <Globe2 className="h-6 w-6" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-foreground">{baseDomain}</span>
                      <span className="rounded bg-muted/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        + www.{baseDomain}
                      </span>
                      {primaryRow.is_primary && (
                        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                          Primary Store
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {allVerified ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Live & Protected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> DNS / Verification Pending
                        </span>
                      )}
                      <span className="text-muted-foreground/40">•</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" /> SSL: {group.every((r) => r.ssl_status === "active") ? "Active" : "Auto-provisioning"}
                      </span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="text-muted-foreground">{group[0].mode === "dns" ? "Server DNS" : "Cloudflare"}</span>
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => checkGroup(group)}
                    disabled={busy === busyKey}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    {busy === busyKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span>Check status</span>
                  </Button>

                  {!primaryRow.is_primary && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => makePrimary(group)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Make primary
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmGroup(group)}
                    className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="ডোমেইন রিমুভ করুন"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* DNS Records Body */}
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>প্রয়োজনীয় DNS রেকর্ডসমূহ (আপনার ডোমেইন প্রোভাইডারে সেট করুন)</span>
                  </div>
                </div>

                {/* Clean Unified Records Table */}
                <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
                  {/* Table Header */}
                  <div className="grid grid-cols-[80px_100px_minmax(180px,1fr)_100px] items-center gap-3 border-b bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Type</span>
                    <span>Host / Name</span>
                    <span>Value / Points To</span>
                    <span className="text-right">Status</span>
                  </div>

                  {/* Rows for A Record (@) and CNAME Record (www) */}
                  {group.map((r) => {
                    const rec = recordFor(r, guide);
                    const isApex = isApexHostname(r.hostname);
                    const isRowLive = !!r.verified_at;

                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-[80px_100px_minmax(180px,1fr)_100px] items-center gap-3 border-b border-border/50 px-4 py-3 text-xs last:border-b-0 hover:bg-muted/20 transition-colors"
                      >
                        <div>
                          <span className="inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                            {rec.type}
                          </span>
                        </div>

                        <div>
                          <CopyableField value={rec.host} label="Host" />
                          <div className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
                            {isApex ? baseDomain : `www.${baseDomain}`}
                          </div>
                        </div>

                        <div className="min-w-0 pr-2">
                          <CopyableField value={rec.value} label="Target Value" />
                        </div>

                        <div className="text-right">
                          {isRowLive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Live
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Single 1-TXT Record Box (Only shown if pending verification) */}
                {hasPendingTxt && (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                        TXT
                      </span>
                      <span>ওনারশিপ ভেরিফিকেশন রেকর্ড (১টি TXT রেকর্ড - ঐচ্ছিক)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      সাধারণত উপরের A ও CNAME রেকর্ড সেট করলেই ডোমেইন অটো-ভেরিফাই হয়ে যায়। যদি ভেরিফিকেশনে বিলম্ব হয়, তবে আপনার DNS প্যানেলে নিচের <strong>১টি TXT রেকর্ড</strong> যোগ করুন:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">Host:</span>
                        <CopyableField value={txtHost!} label="TXT Host" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-muted-foreground">Value:</span>
                        <CopyableField value={txtVal!} label="TXT Value" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Instruction Banner */}
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <p>
                    DNS রেকর্ড যোগ করার পর কার্যকর হতে সাধারণত ৫ থেকে ৩০ মিনিট সময় লাগতে পারে। রেকর্ডগুলো সেট করা সম্পন্ন হলে উপরে <strong>"Check status"</strong> বাটনে চাপুন।
                  </p>
                </div>
              </div>
            </article>
          );
        })}

        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/80 p-12 text-center">
            <Globe2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">কোনো কাস্টম ডোমেইন যুক্ত করা হয়নি</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              আপনার স্টোরের জন্য নিজের ব্র্যান্ড ডোমেইন যুক্ত করতে উপরের ফর্মটি পূরণ করুন।
            </p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmGroup}
        title="ডোমেইন মুছে ফেলতে চান?"
        description="মূল ডোমেইন এবং www উভয় রেকর্ডই Cloudflare ও সিস্টেম থেকে সরানো হবে। এতে কাস্টম ডোমেইনে স্টোর ভিজিট বন্ধ হয়ে যাবে।"
        detail={confirmGroup?.map((r) => r.hostname).join(", ")}
        confirmText="ডিলিট করুন"
        isLoading={!!confirmGroup && busy === confirmGroup[0].id}
        onClose={() => setConfirmGroup(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}

