import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Globe, Loader2, RefreshCw, Save, Server, ShieldCheck, Trash2, Plug, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import {
  getCloudflareConfig,
  saveCloudflareConfig,
  testCloudflareConfig,
  listDomains,
  refreshDomain,
  disconnectDomain,
  getPlatformOrigins,
  savePlatformOrigins,
  type DomainRow,
} from "@/lib/cloudflare.functions";

export const Route = createFileRoute("/_authenticated/admin/domains")({
  component: DomainsAdmin,
});

type Form = {
  mode: "cloudflare" | "dns" | "both";
  server_a_ip: string;
  server_cname: string;
  server_note: string;
  dns_active: boolean;
  api_token: string;
  account_id: string;
  zone_id: string;
  zone_name: string;
  worker_name: string;
  cname_target: string;
  a_record_ip: string;
  auto_worker_domain: boolean;
  is_active: boolean;
};

const EMPTY: Form = {
  mode: "both",
  server_a_ip: "",
  server_cname: "",
  server_note: "",
  dns_active: false,
  api_token: "",
  account_id: "",
  zone_id: "",
  zone_name: "",
  worker_name: "",
  cname_target: "",
  a_record_ip: "",
  auto_worker_domain: false,
  is_active: false,
};

function errorText(err: unknown) {
  if (err instanceof Response) return `Failed (${err.status})`;
  return err instanceof Error ? err.message : "Something went wrong";
}

function DomainsAdmin() {
  const loadConfig = useServerFn(getCloudflareConfig);
  const saveConfig = useServerFn(saveCloudflareConfig);
  const testConfig = useServerFn(testCloudflareConfig);
  const load = useServerFn(listDomains);
  const refresh = useServerFn(refreshDomain);
  const remove = useServerFn(disconnectDomain);

  const [form, setForm] = useState<Form>(EMPTY);
  const [tokenHint, setTokenHint] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DomainRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, d] = await Promise.all([loadConfig({}), load({ data: { all: true } })]);
        setForm({ ...EMPTY, ...c, api_token: "" });
        setTokenHint(c.tokenHint);
        setHasToken(c.hasToken);
        setRows(d);
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    try {
      const c = await saveConfig({ data: { ...form } });
      setForm({ ...EMPTY, ...c, api_token: "" });
      setTokenHint(c.tokenHint);
      setHasToken(c.hasToken);
      toast.success("Cloudflare credentials saved");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const r = await testConfig({});
      toast.success(
        `Token OK${r.zone ? ` · Zone: ${r.zone}` : ""}${r.account ? ` · Account: ${r.account}` : ""}`,
      );
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function onRefresh(row: DomainRow) {
    setBusy(row.id);
    try {
      const updated = await refresh({ data: { id: row.id } });
      setRows((rs) => rs.map((r) => (r.id === updated.id ? { ...updated, reseller_name: r.reseller_name, reseller_code: r.reseller_code } : r)));
      toast.success(`${updated.hostname}: ${updated.ownership_status ?? "pending"} · SSL ${updated.ssl_status}`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    if (!confirm) return;
    setBusy(confirm.id);
    try {
      await remove({ data: { id: confirm.id } });
      setRows((rs) => rs.filter((r) => r.id !== confirm.id));
      toast.success("Domain disconnected from Cloudflare");
      setConfirm(null);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const field = (key: keyof Form, label: string, placeholder: string, type = "text") => (
    <label className="flex min-w-[200px] flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={String(form[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Custom domains"
        description="Choose how reseller domains are served — Cloudflare API automation, plain server DNS, or both — and manage every connected domain."
      />

      <PlatformOriginsCard />


      <form onSubmit={onSave} className="space-y-6">
        <div className="surface-card space-y-3 p-5">
          <div className="text-sm font-semibold">Which setup do resellers use?</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              { key: "cloudflare", title: "Cloudflare only", note: "Hostnames + SSL created through the Cloudflare API." },
              { key: "dns", title: "Server DNS only", note: "Reseller points A/CNAME at your server. No API needed." },
              { key: "both", title: "Both", note: "Reseller picks the method that fits their domain." },
            ] as const).map((o) => (
              <button
                type="button"
                key={o.key}
                onClick={() => setForm((f) => ({ ...f, mode: o.key }))}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  form.mode === o.key ? "border-primary bg-primary-soft" : "hover:bg-muted"
                }`}
              >
                <div className="font-medium">{o.title}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{o.note}</div>
              </button>
            ))}
          </div>
        </div>

        {form.mode !== "cloudflare" && (
          <div className="surface-card space-y-4 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Server className="h-4 w-4 text-primary" /> Server DNS setup
            </div>
            <div className="flex flex-wrap gap-3">
              {field("server_a_ip", "Server IP (A record)", "203.0.113.10")}
              {field("server_cname", "Server CNAME target", "stores.yourplatform.com")}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Instruction note for resellers (optional)</span>
              <textarea
                rows={2}
                value={form.server_note}
                placeholder="After DNS points here, contact support so SSL can be issued on the server."
                onChange={(e) => setForm((f) => ({ ...f, server_note: e.target.value }))}
                className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.dns_active}
                onChange={(e) => setForm((f) => ({ ...f, dns_active: e.target.checked }))}
                className="h-4 w-4 rounded border"
              />
              Server DNS mode active
            </label>
          </div>
        )}

        {form.mode !== "dns" && (
        <div className="surface-card space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" /> Cloudflare credentials
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            API token {hasToken && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">saved: {tokenHint}</span>}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={form.api_token}
            placeholder={hasToken ? "Leave blank to keep the saved token" : "Cloudflare API token"}
            onChange={(e) => setForm((f) => ({ ...f, api_token: e.target.value }))}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-[11px] text-muted-foreground">
            Needs: Zone → SSL and Certificates (Edit), Zone → Zone (Read), Account → Workers Scripts (Edit).
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          {field("account_id", "Account ID", "cf account id")}
          {field("zone_id", "Zone ID", "cf zone id")}
        </div>
        <div className="flex flex-wrap gap-3">
          {field("zone_name", "Zone name", "yourplatform.com")}
          {field("worker_name", "Worker script name", "resellhub-worker")}
        </div>
        <div className="flex flex-wrap gap-3">
          {field("cname_target", "CNAME target for resellers", "proxy.yourplatform.com")}
          {field("a_record_ip", "A record IP (root domains)", "203.0.113.10")}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="h-4 w-4 rounded border"
            />
            Integration active
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.auto_worker_domain}
              onChange={(e) => setForm((f) => ({ ...f, auto_worker_domain: e.target.checked }))}
              className="h-4 w-4 rounded border"
            />
            Auto-attach worker domain (same zone only)
          </label>
        </div>

        </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button disabled={busy === "save"} className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium">
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          {form.mode !== "dns" && (
          <button
            type="button"
            onClick={onTest}
            disabled={busy === "test"}
            className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Test connection
          </button>
          )}
        </div>
      </form>

      <div className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold">
        <Globe className="h-4 w-4 text-primary" /> Connected domains ({rows.length})
      </div>

      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="surface-card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <div className="flex items-center gap-2 font-medium">
                {r.hostname}
                {r.is_primary && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">Primary</span>}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {r.mode === "dns" ? "Server DNS" : "Cloudflare"}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {r.reseller_name ?? "—"} {r.reseller_code ? `· ${r.reseller_code}` : ""}
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {r.verified_at ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3 w-3" /> Active · SSL {r.ssl_status}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertCircle className="h-3 w-3" /> {r.ownership_status ?? "pending"} · SSL {r.ssl_status}
                  </span>
                )}
              </div>
              {r.last_error && <div className="mt-1 text-[11px] text-destructive">{r.last_error}</div>}
            </div>
            <button
              onClick={() => onRefresh(r)}
              disabled={busy === r.id}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check status
            </button>
            <button
              onClick={() => setConfirm(r)}
              className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Disconnect domain"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No reseller domain connected yet.</div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirm}
        title="Disconnect domain?"
        description="The hostname will be removed and the store will stop serving on it."
        detail={confirm?.hostname}
        confirmText="Disconnect"
        isLoading={busy === confirm?.id}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
      />
    </div>
  );
}

/**
 * The platform's own live domains. Payment gateways return to the origin that
 * holds the privileged key, and the shopper/reseller is then sent back to the
 * exact site they started on — only hosts listed here (plus connected reseller
 * domains and the hosting URL) are accepted, so nothing can hijack a redirect.
 */
function PlatformOriginsCard() {
  const loadOrigins = useServerFn(getPlatformOrigins);
  const saveOrigins = useServerFn(savePlatformOrigins);
  const [hosts, setHosts] = useState("");
  const [callback, setCallback] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOrigins({})
      .then((s) => {
        setHosts((s.allowed_origins ?? []).join("\n"));
        setCallback(s.callback_base_url ?? "");
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    setSaving(true);
    try {
      const out = await saveOrigins({
        data: {
          allowed_origins: hosts.split(/[\s,]+/).filter(Boolean),
          callback_base_url: callback,
        },
      });
      setHosts(out.allowed_origins.join("\n"));
      setCallback(out.callback_base_url);
      toast.success("Payment redirect domains saved");
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-card mb-6 space-y-3 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-primary" /> Payment redirect domains
      </div>
      <p className="text-xs text-muted-foreground">
        Ekhane platform er nijer live domain gulo lekho (ek line e ek ta). Ei domain theke payment
        korle payment success ba cancel — dutotei user oi domain e-i firbe, onno kothao jabe na.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Platform domains</span>
          <textarea
            rows={4}
            value={hosts}
            onChange={(e) => setHosts(e.target.value)}
            placeholder={"yourbrand.com\nshop.yourbrand.com"}
            disabled={!ready}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Payment callback address (gateway return URL base)
          </span>
          <input
            value={callback}
            onChange={(e) => setCallback(e.target.value)}
            placeholder="https://your-app-host"
            disabled={!ready}
            className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !ready}
        className="btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save domains
      </button>
    </section>
  );
}
