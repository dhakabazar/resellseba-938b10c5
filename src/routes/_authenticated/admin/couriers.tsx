import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Truck, Copy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { steadfastBalance } from "@/lib/couriers.functions";

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
    { key: "secret_key", label: "Secret Key", type: "password" },
  ],
  pathao: [
    { key: "client_id", label: "Client ID" },
    { key: "client_secret", label: "Client Secret", type: "password" },
    { key: "username", label: "Username" },
    { key: "password", label: "Password", type: "password" },
    { key: "store_id", label: "Default Store ID" },
  ],
  carrybee: [
    { key: "api_token", label: "API Token", type: "password" },
    { key: "base_url", label: "Base URL" },
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
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={r.is_active}
                    onChange={(e) => {
                      const copy = [...rows];
                      copy[idx] = { ...r, is_active: e.target.checked };
                      setRows(copy);
                    }}
                  />
                  Active
                </label>
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

              <button onClick={() => save(r)} className="btn-brand mt-4 rounded-md px-3 py-1.5 text-xs font-medium">Save</button>

            </div>
          );
        })}
      </div>
    </div>
  );
}

function SteadfastExtras({ token }: { token: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const getBalance = useServerFn(steadfastBalance);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/courier/steadfast?token=${token || "<save-token-first>"}`;

  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-3">
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
        <p className="mt-1 text-[11px] text-muted-foreground">
          Webhook Token save korar por ei URL Steadfast support/panel e diye din — live status update order e chole asbe.
        </p>
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
