import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plug,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GATEWAYS, type GatewayFieldSpec, type GatewaySpec } from "@/lib/gateways/registry";
import { testGatewayConnection } from "@/lib/gateways.functions";

/**
 * Admin panel for the automatic (redirect) gateways.
 * Every provider in the registry is always visible as a card with its own
 * credential fields, sandbox/live switch and on/off switch. Credentials live in
 * `payment_gateway_configs` and are never rendered on storefronts.
 */

type Row = {
  id: string;
  provider: string;
  label: string | null;
  api_key: string | null;
  api_secret: string | null;
  merchant_id: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
};

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function blank(provider: string): Row {
  const spec = GATEWAYS.find((g) => g.provider === provider);
  return {
    id: "",
    provider,
    label: spec?.label ?? provider,
    api_key: "",
    api_secret: "",
    merchant_id: "",
    config: {},
    is_active: false,
  };
}

function readField(row: Row, spec: GatewayFieldSpec): string {
  if (spec.path.startsWith("config.")) {
    const v = row.config?.[spec.path.slice(7)];
    return typeof v === "string" ? v : "";
  }
  return (row[spec.path as "api_key" | "api_secret" | "merchant_id"] ?? "") as string;
}

function writeField(row: Row, spec: GatewayFieldSpec, value: string): Row {
  if (spec.path.startsWith("config."))
    return { ...row, config: { ...(row.config ?? {}), [spec.path.slice(7)]: value } };
  return { ...row, [spec.path]: value };
}

export function GatewayAdmin({ onCountChange }: { onCountChange?: (active: number) => void }) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_gateway_configs")
      .select("id,provider,label,api_key,api_secret,merchant_id,config,is_active")
      .is("reseller_id", null);
    if (error) toast.error(error.message);
    const next: Record<string, Row> = {};
    for (const spec of GATEWAYS) {
      const found = (data ?? []).find((r) => r.provider === spec.provider);
      next[spec.provider] = found
        ? ({ ...found, config: (found.config ?? {}) as Record<string, unknown> } as Row)
        : blank(spec.provider);
    }
    setRows(next);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const activeCount = useMemo(() => Object.values(rows).filter((r) => r.is_active).length, [rows]);
  useEffect(() => onCountChange?.(activeCount), [activeCount, onCountChange]);

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {GATEWAYS.map((spec) => (
        <GatewayCard
          key={spec.provider}
          spec={spec}
          row={rows[spec.provider] ?? blank(spec.provider)}
          setRow={(next) => setRows((prev) => ({ ...prev, [spec.provider]: next }))}
          onSaved={load}
        />
      ))}
    </div>
  );
}

function GatewayCard({
  spec,
  row,
  setRow,
  onSaved,
}: {
  spec: GatewaySpec;
  row: Row;
  setRow: (next: Row) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const runTest = useServerFn(testGatewayConnection);
  const sandbox = row.config?.is_sandbox !== false;
  const missing = spec.fields.filter((f) => f.required && !readField(row, f).trim());

  function setSandbox(value: boolean) {
    setRow({ ...row, config: { ...(row.config ?? {}), is_sandbox: value } });
  }

  async function save(nextActive = row.is_active) {
    if (nextActive && missing.length) {
      toast.error(`Fill in: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setBusy(true);
    const payload = {
      provider: spec.provider,
      label: row.label || spec.label,
      api_key: row.api_key || null,
      api_secret: row.api_secret || null,
      merchant_id: row.merchant_id || null,
      config: { ...(row.config ?? {}), is_sandbox: sandbox } as never,
      is_active: nextActive,
      reseller_id: null,
    };
    const { error } = row.id
      ? await supabase.from("payment_gateway_configs").update(payload).eq("id", row.id)
      : await supabase.from("payment_gateway_configs").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.label} saved`);
    onSaved();
  }

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const r = await runTest({
        data: {
          provider: spec.provider,
          api_key: row.api_key ?? "",
          api_secret: row.api_secret ?? "",
          merchant_id: row.merchant_id ?? "",
          config: { ...(row.config ?? {}), is_sandbox: sandbox } as Record<string, unknown>,
        },
      });
      setResult(
        r.success
          ? { ok: true, message: "Credentials accepted by the gateway." }
          : { ok: false, message: r.error ?? "Connection failed" },
      );
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Connection failed" });
    }
    setTesting(false);
  }

  return (
    <div className={"surface-card overflow-hidden " + (row.is_active ? "ring-1 ring-primary/30" : "")}>
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <span
          className={
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg " +
            (row.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
          }
        >
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="min-w-[150px] flex-1">
          <div className="text-sm font-semibold">{row.label || spec.label}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>{row.id ? (row.is_active ? "Active" : "Saved · off") : "Not configured"}</span>
            <span>·</span>
            <span className={sandbox ? "text-amber-600 dark:text-amber-400" : "text-success"}>
              {sandbox ? "sandbox" : "live"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void save(!row.is_active);
          }}
          aria-label={row.is_active ? "Deactivate gateway" : "Activate gateway"}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
            (row.is_active ? "bg-primary" : "bg-muted-foreground/30")
          }
        >
          <span
            className={
              "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all " +
              (row.is_active ? "left-[22px]" : "left-0.5")
            }
          />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="max-w-[34ch] text-[11px] leading-relaxed text-muted-foreground">{spec.tagline}</p>
          {spec.docs && (
            <a
              href={spec.docs}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] font-semibold hover:bg-muted"
            >
              <ExternalLink className="h-3 w-3" /> Docs
            </a>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium">Display label</label>
              {(row.label ?? "") !== spec.label && (
                <button
                  type="button"
                  onClick={() => setRow({ ...row, label: spec.label })}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Use default
                </button>
              )}
            </div>
            <input
              value={row.label ?? ""}
              onChange={(e) => setRow({ ...row, label: e.target.value })}
              className={inp}
              placeholder={spec.label}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Shown to customers at checkout. Defaults to {spec.label}.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Environment</label>
            <select value={sandbox ? "sandbox" : "live"} onChange={(e) => setSandbox(e.target.value === "sandbox")} className={inp}>
              <option value="sandbox">Sandbox (testing)</option>
              <option value="live">Live (real money)</option>
            </select>
          </div>
          {spec.fields.map((f) => (
            <div key={f.path} className={f.multiline ? "sm:col-span-2" : ""}>
              <label className="mb-1 block text-xs font-medium">
                {f.label} {f.required && <span className="text-destructive">*</span>}
              </label>
              <CredentialInput
                value={readField(row, f)}
                onChange={(v) => setRow(writeField(row, f, v))}
                placeholder={f.placeholder}
                secret={f.secret}
                multiline={f.multiline}
              />
              {f.hint && <p className="mt-1 text-[10px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>

        {spec.callbacks.some((c) => c.manual) ? (
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 text-[11px] font-semibold">Set these URLs in the {spec.label} panel</div>
            <div className="space-y-1.5">
              {spec.callbacks
                .filter((c) => c.manual)
                .map((c) => (
                  <CallbackRow key={c.path} path={c.path} label={c.label} />
                ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Other callback URLs are sent automatically with each payment request — nothing else to configure. URLs
              always follow the site you are on, so a domain or server change needs no edit here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-[10px] leading-relaxed text-muted-foreground">
            {spec.label} needs no URL setup in its panel — the return/callback URL is generated from the live site
            address and sent with every payment request, so it keeps working after a domain or server change.
          </div>
        )}


        {result && (
          <div
            className={
              "flex items-start gap-2 rounded-lg border p-2.5 text-[11px] " +
              (result.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive")
            }
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" /> : <XCircle className="mt-0.5 h-3.5 w-3.5" />}
            <span>{result.message}</span>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Credentials stay server-side. Customers are redirected back to a verified return URL — payments are always
          re-checked with the gateway before an order is marked paid.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/20 px-4 py-2.5">
        <button
          type="button"
          onClick={() => void test()}
          disabled={testing || missing.length > 0}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Test connection
        </button>
        <button
          onClick={() => void save()}
          disabled={busy}
          className="btn-brand inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
        </button>
      </div>
    </div>
  );
}

function CallbackRow({ path, label }: { path: string; label: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin + path;
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold">{label}</div>
        <code className="block truncate text-[10px] text-muted-foreground">{url}</code>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          toast.success("URL copied");
        }}
        className="rounded p-1 hover:bg-background"
        aria-label="Copy URL"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function CredentialInput({
  value,
  onChange,
  placeholder,
  secret,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  multiline?: boolean;
}) {
  const [show, setShow] = useState(false);
  if (multiline)
    return (
      <div className="relative">
        <textarea
          rows={3}
          value={show || !secret ? value : value.replace(/./g, "•")}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => secret && setShow(true)}
          className={inp + " font-mono text-[11px]"}
          placeholder={placeholder}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label={show ? "Hide value" : "Show value"}
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  if (!secret)
    return <input value={value} onChange={(e) => onChange(e.target.value)} className={inp} placeholder={placeholder} />;
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={show ? "text" : "password"}
        autoComplete="off"
        className={inp + " pr-9"}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label={show ? "Hide value" : "Show value"}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
