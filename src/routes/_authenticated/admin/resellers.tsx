import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Check, X, Loader2, Pencil, Trash2, Pause, Play } from "lucide-react";
import { toast } from "sonner";

type Status = "pending" | "active" | "suspended" | "rejected";

type Reseller = {
  id: string;
  user_id: string;
  business_name: string;
  code: string;
  contact_phone: string | null;
  address: string | null;
  status: Status;
  commission_rate: number;
  leader_id: string | null;
  notes: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/resellers")({
  component: ResellersPage,
});

function ResellersPage() {
  const [items, setItems] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("pending");
  const [editing, setEditing] = useState<Reseller | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("resellers")
      .select(
        "id,user_id,business_name,code,contact_phone,address,status,commission_rate,leader_id,notes,created_at",
      )
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setItems((data ?? []) as Reseller[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [filter]);

  async function approve(r: Reseller) {
    const { error } = await supabase
      .from("resellers")
      .update({ status: "active", approved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await supabase
      .from("user_roles")
      .upsert({ user_id: r.user_id, role: "reseller" }, { onConflict: "user_id,role" });
    await supabase
      .from("reseller_settings")
      .upsert({ reseller_id: r.id, store_name: r.business_name }, { onConflict: "reseller_id" });
    toast.success(`${r.business_name} approved`);
    load();
  }

  async function setStatus(r: Reseller, status: Status) {
    const { error } = await supabase.from("resellers").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    load();
  }

  async function remove(r: Reseller) {
    if (!confirm(`Delete reseller "${r.business_name}"? Er sob listing/order o remove hote pare.`)) return;
    const { error } = await supabase.from("resellers").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div>
      <PageHeader
        title="Resellers"
        description="Applications review korun, commission/leader set korun, status manage korun."
      />
      <div className="mb-4 inline-flex overflow-hidden rounded-md border">
        {(["pending", "active", "suspended", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here" description="No resellers match this filter." />
      ) : (
        <div className="surface-card divide-y">
          {items.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.business_name}</div>
                <div className="text-xs text-muted-foreground">
                  #{r.code} · {r.contact_phone ?? "no phone"} · Commission {r.commission_rate}%
                  {r.leader_id ? " · Leader linked" : ""}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                  r.status === "active"
                    ? "bg-success/15 text-success-foreground"
                    : r.status === "pending"
                      ? "bg-warning/20 text-warning-foreground"
                      : r.status === "suspended"
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/15 text-destructive"
                }`}
              >
                {r.status}
              </span>
              <div className="flex flex-wrap gap-2">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => approve(r)}
                      className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      onClick={() => setStatus(r, "rejected")}
                      className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </>
                )}
                {r.status === "active" && (
                  <button
                    onClick={() => setStatus(r, "suspended")}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
                  >
                    <Pause className="h-3 w-3" /> Suspend
                  </button>
                )}
                {(r.status === "suspended" || r.status === "rejected") && (
                  <button
                    onClick={() => setStatus(r, "active")}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
                  >
                    <Play className="h-3 w-3" /> Reactivate
                  </button>
                )}
                <button
                  onClick={() => setEditing(r)}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => remove(r)}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          reseller={editing}
          others={items.filter((i) => i.id !== editing.id && i.status === "active")}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  reseller,
  others,
  onClose,
  onSaved,
}: {
  reseller: Reseller;
  others: Reseller[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessName, setBusinessName] = useState(reseller.business_name);
  const [code, setCode] = useState(reseller.code);
  const [phone, setPhone] = useState(reseller.contact_phone ?? "");
  const [address, setAddress] = useState(reseller.address ?? "");
  const [commission, setCommission] = useState(String(reseller.commission_rate));
  const [leaderId, setLeaderId] = useState(reseller.leader_id ?? "");
  const [notes, setNotes] = useState(reseller.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        business_name: businessName,
        code: code.trim(),
        contact_phone: phone || null,
        address: address || null,
        commission_rate: Number(commission),
        leader_id: leaderId || null,
        notes: notes || null,
      })
      .eq("id", reseller.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  const cls =
    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="surface-card w-full max-w-lg space-y-3 p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Edit reseller</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Business name</label>
          <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={cls} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Store code</label>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Commission %</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className={cls}
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Leader (optional)</label>
            <select value={leaderId} onChange={(e) => setLeaderId(e.target.value)} className={cls}>
              <option value="">— None —</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.business_name} (#{o.code})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={cls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Internal notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}
