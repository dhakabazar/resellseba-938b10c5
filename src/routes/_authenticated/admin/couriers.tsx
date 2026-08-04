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

const FIELDS: Record<string, { key: string; label: string; type?: string; hint?: string }[]> = {
  steadfast: [
    { key: "api_key", label: "API Key" },
    { key: "secret_key", label: "Secret Key", type: "password" },
    { key: "base_url", label: "Base URL", hint: "https://portal.packzy.com/api/v1" },
    { key: "webhook_token", label: "Webhook Token", hint: "Any secret string — also used in the webhook URL" },
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
    setRows((data ?? []) as any);
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
              <button onClick={() => save(r)} className="btn-brand mt-4 rounded-md px-3 py-1.5 text-xs font-medium">Save</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
