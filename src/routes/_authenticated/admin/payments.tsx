import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
});

const METHODS = [
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "rocket", label: "Rocket" },
  { value: "sslcommerz", label: "SSLCommerz" },
  { value: "eps", label: "EPS / AamarPay" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

type Row = {
  id: string;
  method: string;
  label: string;
  mode: "manual" | "api";
  is_active: boolean;
  instructions: string | null;
  config: any;
};

function PaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Partial<Row>>({ method: "bkash", mode: "manual", label: "" });

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data } = await supabase.from("payment_configs").select("*").is("reseller_id", null).order("created_at");
    setRows((data ?? []) as any);
    setLoading(false);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.label || !draft.method) return;
    setBusy(true);
    const { error } = await supabase.from("payment_configs").insert({
      method: draft.method,
      label: draft.label,
      mode: draft.mode || "manual",
      is_active: true,
      instructions: null,
      config: {},
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setDraft({ method: "bkash", mode: "manual", label: "" });
      load();
    }
  }

  async function update(r: Row) {
    const { error } = await supabase.from("payment_configs").update({
      label: r.label,
      mode: r.mode,
      is_active: r.is_active,
      instructions: r.instructions,
      config: r.config,
    }).eq("id", r.id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }

  async function remove(id: string) {
    if (!confirm("Delete this method?")) return;
    await supabase.from("payment_configs").delete().eq("id", id);
    load();
  }

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <PageHeader title="Payment methods" description="bKash / Nagad personal + API, SSLCommerz, EPS — ekhane add korun. Reseller ra nijer setting-e override korte parbe." />
      <form onSubmit={add} className="surface-card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-medium">Method</label>
          <select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })} className={inp}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium">Label</label>
          <input required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className={inp} placeholder="e.g. bKash Personal (01700...)" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Mode</label>
          <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as any })} className={inp}>
            <option value="manual">Manual</option>
            <option value="api">API</option>
          </select>
        </div>
        <button disabled={busy} className="btn-brand inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium"><Plus className="h-3.5 w-3.5" /> Add</button>
      </form>

      <div className="grid gap-3">
        {rows.map((r, idx) => (
          <div key={r.id} className="surface-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary-soft text-primary"><Wallet className="h-4 w-4" /></div>
              <div className="flex-1">
                <input value={r.label} onChange={(e) => {
                  const copy = [...rows]; copy[idx] = { ...r, label: e.target.value }; setRows(copy);
                }} className="w-full rounded-md border bg-background px-2 py-1 text-sm font-semibold" />
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.method} · {r.mode}</div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs">
                <input type="checkbox" checked={r.is_active} onChange={(e) => {
                  const copy = [...rows]; copy[idx] = { ...r, is_active: e.target.checked }; setRows(copy);
                }} /> Active
              </label>
              <button onClick={() => remove(r.id)} className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Customer instructions</label>
                <textarea rows={3} className={inp} value={r.instructions ?? ""} onChange={(e) => {
                  const copy = [...rows]; copy[idx] = { ...r, instructions: e.target.value }; setRows(copy);
                }} placeholder="e.g. Send Money to 01700XXXXXXX (Personal). Reference: order number." />
              </div>
              {r.mode === "api" && (
                <div>
                  <label className="mb-1 block text-xs font-medium">API config (JSON)</label>
                  <textarea rows={3} className={inp} value={JSON.stringify(r.config, null, 2)} onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      const copy = [...rows]; copy[idx] = { ...r, config: parsed }; setRows(copy);
                    } catch { /* ignore invalid intermediate */ }
                  }} />
                </div>
              )}
            </div>
            <button onClick={() => update(r)} className="btn-brand mt-3 rounded-md px-3 py-1.5 text-xs font-medium">Save</button>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No payment methods yet.</div>}
      </div>
    </div>
  );
}

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
