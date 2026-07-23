import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, MessageSquare, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendTestNotification } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsPage,
});

type Row = {
  id?: string;
  channel: "sms" | "email";
  provider: string;
  is_active: boolean;
  from_name: string;
  from_value: string;
  config: Record<string, string>;
};

const SMS_PROVIDERS = [
  { value: "bulksmsbd", label: "BulkSMSBD", fields: ["api_key", "sender_id"] },
  { value: "sslsms", label: "SSL Wireless", fields: ["api_token", "sid"] },
];
const EMAIL_PROVIDERS = [
  { value: "resend", label: "Resend", fields: ["api_key"] },
];

function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const runTest = useServerFn(sendTestNotification);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data } = await supabase.from("notification_configs").select("*").is("reseller_id", null);
    const map = new Map((data ?? []).map((r: any) => [r.channel, r]));
    const defaults: Row[] = [
      { channel: "sms", provider: "bulksmsbd", is_active: false, from_name: "", from_value: "", config: {} },
      { channel: "email", provider: "resend", is_active: false, from_name: "", from_value: "", config: {} },
    ];
    setRows(defaults.map((d) => {
      const f: any = map.get(d.channel);
      return f ? { id: f.id, channel: d.channel, provider: f.provider, is_active: f.is_active, from_name: f.from_name || "", from_value: f.from_value || "", config: f.config || {} } : d;
    }));
    setLoading(false);
  }

  async function save(r: Row) {
    const payload: any = {
      reseller_id: null, channel: r.channel, provider: r.provider, is_active: r.is_active,
      from_name: r.from_name || null, from_value: r.from_value || null, config: r.config,
    };
    const { error } = r.id
      ? await supabase.from("notification_configs").update(payload).eq("id", r.id)
      : await supabase.from("notification_configs").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); load(); }
  }

  async function test(r: Row) {
    if (!r.id) return toast.error("Save first");
    const to = window.prompt(r.channel === "sms" ? "Test phone number:" : "Test email:");
    if (!to) return;
    try {
      await runTest({ data: { configId: r.id, to } });
      toast.success("Test sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Notifications" description="SMS + email providers for order alerts. Resellers can override in their own settings." />
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r, idx) => {
          const providers = r.channel === "sms" ? SMS_PROVIDERS : EMAIL_PROVIDERS;
          const current = providers.find((p) => p.value === r.provider) || providers[0];
          return (
            <div key={r.channel} className="surface-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
                  {r.channel === "sms" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </div>
                <div className="flex-1 font-semibold capitalize">{r.channel}</div>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={r.is_active} onChange={(e) => {
                    const c = [...rows]; c[idx] = { ...r, is_active: e.target.checked }; setRows(c);
                  }} /> Active
                </label>
              </div>
              <div className="space-y-3">
                <Field label="Provider">
                  <select value={r.provider} onChange={(e) => {
                    const c = [...rows]; c[idx] = { ...r, provider: e.target.value, config: {} }; setRows(c);
                  }} className={inp}>
                    {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From name">
                    <input value={r.from_name} onChange={(e) => { const c=[...rows]; c[idx]={...r,from_name:e.target.value}; setRows(c); }} className={inp} />
                  </Field>
                  <Field label={r.channel === "sms" ? "Sender ID (fallback)" : "From email"}>
                    <input value={r.from_value} onChange={(e) => { const c=[...rows]; c[idx]={...r,from_value:e.target.value}; setRows(c); }} className={inp} />
                  </Field>
                </div>
                {current.fields.map((f) => (
                  <Field key={f} label={f}>
                    <input type={f.includes("key") || f.includes("token") ? "password" : "text"}
                      value={r.config[f] || ""} onChange={(e) => {
                        const c = [...rows]; c[idx] = { ...r, config: { ...r.config, [f]: e.target.value } }; setRows(c);
                      }} className={inp} />
                  </Field>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => save(r)} className="btn-brand rounded-md px-3 py-1.5 text-xs font-medium">Save</button>
                <button onClick={() => test(r)} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Send className="h-3 w-3" /> Send test
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="mb-1 block text-xs font-medium capitalize">{label.replace(/_/g, " ")}</label>{children}</div>);
}
