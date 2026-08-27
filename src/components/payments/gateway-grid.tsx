import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Loader2, Plug, Settings2, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppModal } from "@/components/ui-kit/AppModal";
import { GATEWAYS, type GatewayFieldSpec, type GatewaySpec } from "@/lib/gateways/registry";
import { testGatewayConnection } from "@/lib/gateways.functions";
import { Label, SecretInput, StatusDot, Switch, field } from "./shared";
import { PaymentLogo, paymentLogo } from "./payment-brand";

/**
 * Automatic (redirect) gateways. Every supported provider is a card in a grid:
 * status + on/off inline, credentials in a focused modal.
 * Credentials live in `payment_gateway_configs`, server side only.
 *
 * The same grid serves two scopes:
 * - admin (`resellerId` omitted) → the platform/global gateways
 * - reseller (`resellerId` set)  → per-store gateways, which may either reuse
 *   the platform gateway or run on the reseller's own merchant credentials.
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
  mode: "own" | "platform";
};

function blank(spec: GatewaySpec, mode: "own" | "platform" = "own"): Row {
  return {
    id: "",
    provider: spec.provider,
    label: spec.label,
    api_key: "",
    api_secret: "",
    merchant_id: "",
    config: {},
    is_active: false,
    mode,
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

const missingFields = (spec: GatewaySpec, row: Row) =>
  row.mode === "platform" ? [] : spec.fields.filter((f) => f.required && !readField(row, f).trim());

async function persist(spec: GatewaySpec, row: Row, is_active: boolean, resellerId: string | null) {
  const usesPlatform = row.mode === "platform";
  const payload = {
    provider: spec.provider,
    label: (row.label || spec.label).trim(),
    api_key: usesPlatform ? null : row.api_key || null,
    api_secret: usesPlatform ? null : row.api_secret || null,
    merchant_id: usesPlatform ? null : row.merchant_id || null,
    config: {
      ...(row.config ?? {}),
      base_url: String(row.config?.base_url ?? "").trim() || null,
    } as never,
    is_active,
    mode: resellerId ? row.mode : "own",
    reseller_id: resellerId,
  };
  return row.id
    ? supabase.from("payment_gateway_configs").update(payload).eq("id", row.id)
    : supabase.from("payment_gateway_configs").insert(payload);
}

export function GatewayGrid({
  onCountChange,
  resellerId = null,
  platformActive,
}: {
  onCountChange?: (active: number) => void;
  /** When set, the grid edits that reseller's own gateway setups. */
  resellerId?: string | null;
  /** Providers the admin keeps active globally (reseller scope only). */
  platformActive?: string[];
}) {
  const isReseller = Boolean(resellerId);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const query = supabase
      .from("payment_gateway_configs")
      .select("id,provider,label,api_key,api_secret,merchant_id,config,is_active,mode");
    const { data, error } = resellerId
      ? await query.eq("reseller_id", resellerId)
      : await query.is("reseller_id", null);
    if (error) toast.error(error.message);
    const next: Record<string, Row> = {};
    for (const spec of GATEWAYS) {
      const found = (data ?? []).find((r) => r.provider === spec.provider);
      next[spec.provider] = found
        ? ({
            ...found,
            mode: ((found as { mode?: string }).mode ?? "own") === "platform" ? "platform" : "own",
            config: (found.config ?? {}) as Record<string, unknown>,
          } as Row)
        : blank(spec, isReseller ? "platform" : "own");
    }
    setRows(next);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resellerId]);

  const active = useMemo(() => Object.values(rows).filter((r) => r.is_active).length, [rows]);
  useEffect(() => onCountChange?.(active), [active, onCountChange]);

  async function toggle(spec: GatewaySpec, next: boolean) {
    const row = rows[spec.provider] ?? blank(spec, isReseller ? "platform" : "own");
    if (next) {
      if (isReseller && row.mode === "platform" && platformActive && !platformActive.includes(spec.provider)) {
        toast.error(`${spec.label} is not enabled by the platform — add your own credentials instead.`);
        setEditing(spec.provider);
        return;
      }
      const missing = missingFields(spec, row);
      if (missing.length) {
        toast.error(`Add credentials first: ${missing.map((f) => f.label).join(", ")}`);
        setEditing(spec.provider);
        return;
      }
    }
    setRows((prev) => ({ ...prev, [spec.provider]: { ...row, is_active: next } }));
    const { error } = await persist(spec, row, next, resellerId);
    if (error) {
      toast.error(error.message);

      void load();
      return;
    }
    toast.success(`${row.label || spec.label} ${next ? "enabled" : "disabled"}`);
    void load();
  }

  return (
    <div className={"space-y-4 " + (loading ? "animate-pulse" : "")}>
      <div className="rounded-xl border bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
        {isReseller ? (
          <>
            For every gateway you choose the source: <b>Platform gateway</b> means the money goes to the platform
            account the admin already configured, and <b>My own credentials</b> means the payment lands in your own
            merchant account. Switch a gateway off and it disappears from your store checkout, even if the platform
            keeps it on.
          </>
        ) : (
          <>
            Fill in the credentials from your merchant panel, then switch the gateway on — only enabled gateways appear
            at checkout. Payments are always re-verified with the provider on the server before an order is marked
            paid, and every callback URL is generated from the live site address, so a domain or server change needs no
            edit here.
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {GATEWAYS.map((spec) => {
          const row = rows[spec.provider] ?? blank(spec, isReseller ? "platform" : "own");
          const missing = missingFields(spec, row);
          const platformOff =
            isReseller && row.mode === "platform" && platformActive ? !platformActive.includes(spec.provider) : false;

          return (
            <div
              key={spec.provider}
              className={"surface-card flex flex-col p-4 " + (row.is_active ? "ring-1 ring-primary/30" : "")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={
                    "grid h-11 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-background " +
                    (row.is_active ? "border-primary/30" : "border-border")
                  }
                >
                  {paymentLogo(spec.provider) ? (
                    <PaymentLogo
                      method={spec.provider}
                      width={96}
                      height={44}
                      fit="cover"
                      alt={`${spec.label} logo`}
                    />
                  ) : (
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{row.label || spec.label}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <StatusDot on={row.is_active} />
                    {row.is_active ? "active" : row.id ? "off" : "not set up"}
                    <span>·</span>
                    {isReseller ? (
                      <span className={row.mode === "platform" ? "text-primary" : "text-success"}>
                        {row.mode === "platform" ? "platform gateway" : "own account"}
                      </span>
                    ) : (
                      <span className="text-success">live</span>
                    )}
                  </div>
                </div>
                <Switch
                  checked={row.is_active}
                  onChange={(v) => void toggle(spec, v)}
                  label={`Toggle ${spec.label}`}
                />
              </div>

              <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{spec.tagline}</p>

              <div className="mt-2 text-[10px] font-medium">
                {platformOff ? (
                  <span className="text-amber-600 dark:text-amber-400">Not enabled by the platform</span>
                ) : row.mode === "platform" ? (
                  <span className="text-success">Uses the platform account</span>
                ) : missing.length ? (
                  <span className="text-amber-600 dark:text-amber-400">{missing.length} credential(s) missing</span>
                ) : (
                  <span className="text-success">Credentials complete</span>
                )}
              </div>


              <div className="mt-auto flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditing(spec.provider)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Configure
                </button>
                {spec.docs && (
                  <a
                    href={spec.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border p-2 hover:bg-muted"
                    aria-label={`${spec.label} documentation`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <GatewayModal
          spec={GATEWAYS.find((g) => g.provider === editing)!}
          row={
            rows[editing] ??
            blank(GATEWAYS.find((g) => g.provider === editing)!, isReseller ? "platform" : "own")
          }
          resellerId={resellerId}
          platformActive={platformActive}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function GatewayModal({
  spec,
  row: initial,
  resellerId,
  platformActive,
  onClose,
  onSaved,
}: {
  spec: GatewaySpec;
  row: Row;
  resellerId: string | null;
  platformActive?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {

  const [row, setRow] = useState<Row>(initial);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const runTest = useServerFn(testGatewayConnection);
  const missing = missingFields(spec, row);


  async function save() {
    if (row.is_active && missing.length) return toast.error(`Fill in: ${missing.map((f) => f.label).join(", ")}`);
    if (row.is_active && resellerId && row.mode === "platform" && platformActive && !platformActive.includes(spec.provider))
      return toast.error(`${spec.label} is not enabled by the platform right now.`);
    setBusy(true);
    const { error } = await persist(spec, row, row.is_active, resellerId);

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${row.label || spec.label} saved`);
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
          config: { ...(row.config ?? {}) } as Record<string, unknown>,
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
    <AppModal
      title={
        <span className="flex items-center gap-2">
          <PaymentLogo method={spec.provider} size={24} />
          <span>{spec.label}</span>
        </span>
      }
      subtitle={spec.tagline}
      size="md"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={testing || missing.length > 0}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Test
            connection
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-semibold hover:bg-muted">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="btn-brand inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {resellerId && (
          <div className="sm:col-span-2">
            <Label>Money goes to</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    value: "platform" as const,
                    title: "Platform gateway",
                    hint: platformActive && !platformActive.includes(spec.provider)
                      ? "The platform has not enabled this gateway yet."
                      : "Uses the account the admin already set up.",
                  },
                  {
                    value: "own" as const,
                    title: "My own credentials",
                    hint: "Customers pay straight into your merchant account.",
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRow({ ...row, mode: opt.value })}
                  className={
                    "rounded-xl border p-3 text-left transition-colors " +
                    (row.mode === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted")
                  }
                >
                  <span className="block text-xs font-semibold">{opt.title}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label>Display label</Label>
            {(row.label ?? "") !== spec.label && (
              <button
                type="button"
                onClick={() => setRow({ ...row, label: spec.label })}
                className="mb-1 text-[10px] font-semibold text-primary hover:underline"
              >
                Use default
              </button>
            )}
          </div>
          <input
            value={row.label ?? ""}
            onChange={(e) => setRow({ ...row, label: e.target.value })}
            className={field}
            placeholder={spec.label}
          />
        </div>
        {row.mode === "own" && (
          <div>
            <Label>API base URL</Label>
            <input
              value={(row.config?.base_url as string | undefined) ?? ""}
              onChange={(e) => setRow({ ...row, config: { ...(row.config ?? {}), base_url: e.target.value } })}
              className={field}
              placeholder={spec.hosts.live}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Leave empty to use the provider's standard live API. Fill it in only if your merchant panel gives a
              different API address.
            </p>
          </div>
        )}

        {row.mode === "own" && (
          <>
            <div className="sm:col-span-2 mt-1 text-[11px] font-semibold">Credentials</div>
            {spec.fields.map((f) => (
              <div key={f.path} className={f.multiline ? "sm:col-span-2" : ""}>
                <Label required={f.required}>{f.label}</Label>
                <SecretInput
                  value={readField(row, f)}
                  onChange={(v) => setRow(writeField(row, f, v))}
                  placeholder={f.placeholder}
                  secret={f.secret}
                  multiline={f.multiline}
                />
                {f.hint && <p className="mt-1 text-[10px] text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </>
        )}



        <label className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border p-3">
          <span>
            <span className="block text-xs font-semibold">Enabled at checkout</span>
            <span className="text-[11px] text-muted-foreground">Needs every required credential filled in.</span>
          </span>
          <Switch
            checked={row.is_active}
            onChange={(v) => setRow({ ...row, is_active: v })}
            label="Enable gateway"
          />
        </label>

        {result && (
          <div
            className={
              "sm:col-span-2 flex items-start gap-2 rounded-xl border p-3 text-[11px] " +
              (result.ok
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive")
            }
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" /> : <XCircle className="mt-0.5 h-3.5 w-3.5" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>
    </AppModal>
  );
}
