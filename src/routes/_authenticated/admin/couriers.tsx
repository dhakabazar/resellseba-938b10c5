import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Truck, Copy, Wallet, RefreshCw, Store } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { steadfastBalance, carrybeeStores } from "@/lib/couriers.functions";
import { Switch } from "@/components/ui/switch";


export const Route = createFileRoute("/_authenticated/admin/couriers")({
  component: CouriersPage,
});

type Row = {
  id: string;
  provider: string;
  display_name: string;
  is_active: boolean;
  config: Record<string, string>;
};

const PROVIDER_ORDER = ["steadfast", "pathao", "carrybee", "manual"];

const FIELDS: Record<string, { key: string; label: string; type?: string; hint?: string }[]> = {
  steadfast: [
    { key: "api_key", label: "API Key" },
    { key: "secret_key", label: "Secret Key" },
  ],
  pathao: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret" },
    { key: "username", label: "Username" },
    { key: "password", label: "Password" },
    { key: "store_id", label: "Default Store ID" },
  ],
  carrybee: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret" },
    { key: "client_context", label: "Client Context" },
    { key: "store_id", label: "Default Pickup Store ID", hint: "Store list theke copy korun" },
  ],

  manual: [],
};



function CouriersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("courier_configs").select("*").order("display_name");
    const sorted = [...((data ?? []) as Row[])].sort((a, b) => {
      const ai = PROVIDER_ORDER.indexOf(a.provider);
      const bi = PROVIDER_ORDER.indexOf(b.provider);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    setRows(sorted);

    setLoading(false);
  }

  async function save(row: Row) {
    const { error } = await supabase
      .from("courier_configs")
      .update({ is_active: row.is_active, config: row.config })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else toast.success(`${row.display_name} saved`);
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Courier providers" description="Credentials save korle admin panel theke direct booking kora jabe." />
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r, idx) => {
          const fields = FIELDS[r.provider] ?? [];
          return (
            <div key={r.id} className="surface-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary"><Truck className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="font-semibold">{r.display_name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.provider}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={(v) => {
                      const copy = [...rows];
                      copy[idx] = { ...r, is_active: v };
                      setRows(copy);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{r.is_active ? "Active" : "Inactive"}</span>
                </div>

              </div>
              {fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No credentials required — manual courier bookings only.</p>
              ) : (
                <div className="grid gap-3">
                  {fields.map((f) => (
                    <div key={f.key}>
                      <label className="mb-1 block text-xs font-medium">{f.label}</label>
                      <input
                        type={f.type || "text"}
                        value={r.config?.[f.key] ?? ""}
                        placeholder={f.hint}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[idx] = { ...r, config: { ...r.config, [f.key]: e.target.value } };
                          setRows(copy);
                        }}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>
              )}
              {r.provider === "steadfast" && (
                <SteadfastExtras
                  token={r.config?.webhook_token ?? ""}
                  onToken={(t) => {
                    const copy = [...rows];
                    copy[idx] = { ...r, config: { ...r.config, webhook_token: t } };
                    setRows(copy);
                  }}
                />
              )}
              {r.provider === "pathao" && (
                <PathaoExtras
                  config={r.config ?? {}}
                  onConfig={(patch) => {
                    const copy = [...rows];
                    copy[idx] = { ...r, config: { ...r.config, ...patch } };
                    setRows(copy);
                  }}
                />
              )}
              {r.provider === "carrybee" && (
                <CarrybeeExtras
                  config={r.config ?? {}}
                  onConfig={(patch) => {
                    const copy = [...rows];
                    copy[idx] = { ...r, config: { ...r.config, ...patch } };
                    setRows(copy);
                  }}
                />
              )}



              <button onClick={() => save(r)} className="btn-brand mt-4 rounded-md px-3 py-1.5 text-xs font-medium">Save</button>

            </div>
          );
        })}
      </div>
    </div>
  );
}

function SteadfastExtras({ token, onToken }: { token: string; onToken: (t: string) => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const getBalance = useServerFn(steadfastBalance);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/courier/steadfast?token=${token || "<generate-token-first>"}`;

  function generate() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const t = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    onToken(t);
    toast.success("Token generated — Save korun");
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <div className="mb-1 text-xs font-medium">Webhook Token</div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={token}
            placeholder="Generate button e click korun"
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 font-mono text-[11px]"
          />
          <button type="button" onClick={generate} className="shrink-0 rounded-md border px-2 py-1.5 text-xs hover:bg-accent">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!token) return;
              navigator.clipboard.writeText(token);
              toast.success("Token copied");
            }}
            className="shrink-0 rounded-md border p-1.5 hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium">Webhook URL (Steadfast panel e set korun)</div>

        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-background px-2 py-1.5 text-[11px]">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("Webhook URL copied");
            }}
            className="rounded-md border p-1.5 hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await getBalance();
              setBalance(r.balance);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Balance fetch failed");
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          Check balance
        </button>
        {balance !== null && <span className="text-xs font-semibold">৳{balance.toFixed(2)}</span>}
      </div>
    </div>
  );
}

function CarrybeeExtras({
  config,
  onConfig,
}: {
  config: Record<string, string>;
  onConfig: (patch: Record<string, string>) => void;
}) {
  const [stores, setStores] = useState<
    { id: string; name: string; isApproved: boolean; isDefaultPickup: boolean }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const loadStores = useServerFn(carrybeeStores);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const secret = config.webhook_secret ?? "";
  const webhookUrl = `${origin}/api/public/courier/carrybee`;

  function generate() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    onConfig({
      webhook_secret: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
    });
    toast.success("Secret generated — Save korun");
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <div className="mb-1 text-xs font-medium">Webhook Secret</div>
        <div className="flex items-center gap-2">
          <input
            value={secret}
            onChange={(e) => onConfig({ webhook_secret: e.target.value })}
            placeholder="Generate korun ba Carrybee panel er secret paste korun"
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 font-mono text-[11px]"
          />
          <button type="button" onClick={generate} className="shrink-0 rounded-md border px-2 py-1.5 text-xs hover:bg-accent">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!secret) return;
              navigator.clipboard.writeText(secret);
              toast.success("Secret copied");
            }}
            className="shrink-0 rounded-md border p-1.5 hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium">Webhook URL (Carrybee → Webhook Integration)</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-background px-2 py-1.5 text-[11px]">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
              toast.success("Webhook URL copied");
            }}
            className="rounded-md border p-1.5 hover:bg-accent"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await loadStores();
              setStores(r.stores);
              if (r.stores.length === 0) toast.info("Kono store nai — Carrybee panel e store create korun");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Store list load hoyni");
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
          Load pickup stores
        </button>
      </div>
      {stores.length > 0 && (
        <div className="divide-y rounded-md border bg-background">
          {stores.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
              <div className="min-w-0">
                <div className="truncate font-medium">{s.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{s.id}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {s.isDefaultPickup && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">default</span>}
                {!s.isApproved && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-600">unapproved</span>}
                <button
                  type="button"
                  onClick={() => {
                    onConfig({ store_id: s.id });
                    toast.success("Store id set — Save korun");
                  }}
                  className="rounded-md border px-2 py-0.5 text-[10px] hover:bg-accent"
                >
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
