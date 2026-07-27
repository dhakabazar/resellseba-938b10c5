import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import {
  Check,
  X,
  Loader2,
  Pencil,
  Trash2,
  Pause,
  Play,
  MoreHorizontal,
  BadgeCheck,
  ShieldOff,
  ExternalLink,
  Search,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  approved_at: string | null;
  created_at: string;
};

type Summary = {
  delivered_profit: number;
  pending_payout: number;
  paid_out: number;
  available: number;
};

export const Route = createFileRoute("/_authenticated/admin/resellers")({
  component: ResellersPage,
});

const FILTERS = ["pending", "active", "suspended", "rejected", "unverified", "all"] as const;
type Filter = (typeof FILTERS)[number];

function ResellersPage() {
  const [items, setItems] = useState<Reseller[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Reseller | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("resellers")
      .select(
        "id,user_id,business_name,code,contact_phone,address,status,commission_rate,leader_id,notes,approved_at,created_at",
      )
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Reseller[];
    setItems(rows);
    setLoading(false);

    // Load earnings summary per reseller in parallel
    const results = await Promise.all(
      rows.map(async (r) => {
        const { data: s } = await supabase.rpc("reseller_profit_summary", { _reseller_id: r.id });
        const row = Array.isArray(s) ? s[0] : s;
        return [
          r.id,
          {
            delivered_profit: Number(row?.delivered_profit ?? 0),
            pending_payout: Number(row?.pending_payout ?? 0),
            paid_out: Number(row?.paid_out ?? 0),
            available: Number(row?.available ?? 0),
          } as Summary,
        ] as const;
      }),
    );
    setSummaries(Object.fromEntries(results));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let out = items;
    if (filter === "unverified") out = out.filter((r) => !r.approved_at);
    else if (filter !== "all") out = out.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (q)
      out = out.filter(
        (r) =>
          r.business_name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.contact_phone ?? "").toLowerCase().includes(q),
      );
    return out;
  }, [items, filter, query]);

  const counts = useMemo(() => {
    return {
      pending: items.filter((r) => r.status === "pending").length,
      active: items.filter((r) => r.status === "active").length,
      suspended: items.filter((r) => r.status === "suspended").length,
      rejected: items.filter((r) => r.status === "rejected").length,
      unverified: items.filter((r) => !r.approved_at).length,
      all: items.length,
    } as Record<Filter, number>;
  }, [items]);

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
    toast.success(`${r.business_name} approved & verified`);
    load();
  }

  async function setStatus(r: Reseller, status: Status) {
    const { error } = await supabase.from("resellers").update({ status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    load();
  }

  async function setVerified(r: Reseller, verified: boolean) {
    const { error } = await supabase
      .from("resellers")
      .update({ approved_at: verified ? new Date().toISOString() : null })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(verified ? "Marked verified" : "Verification removed");
    load();
  }

  async function remove(r: Reseller) {
    if (!confirm(`Delete reseller "${r.business_name}"? Er sob listing/order o remove hote pare.`))
      return;
    const { error } = await supabase.from("resellers").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  function copyStoreLink(r: Reseller) {
    const url = `${window.location.origin}/s/${r.code}`;
    navigator.clipboard.writeText(url);
    toast.success("Store link copied");
  }

  return (
    <div>
      <PageHeader
        title="Resellers"
        description="Applications review, commission/leader setup, verify & activate, earning overview."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, code, phone…"
            className="w-64 rounded-md border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs capitalize transition-colors " +
                (filter === f
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "hover:bg-muted")
              }
            >
              {f}
              <span
                className={
                  "rounded-full px-1.5 text-[10px] " +
                  (filter === f ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")
                }
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No resellers match this filter." />
      ) : (
        <div className="surface-card divide-y">
          {filtered.map((r) => {
            const s = summaries[r.id];
            const verified = !!r.approved_at;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
                  {r.business_name.slice(0, 2)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{r.business_name}</span>
                    <StatusBadge status={r.status} />
                    {verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <ShieldOff className="h-3 w-3" /> Unverified
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    #{r.code} · {r.contact_phone ?? "no phone"} · Commission {r.commission_rate}%
                    {r.leader_id ? " · Leader linked" : ""}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right md:grid-cols-4">
                  <Metric label="Delivered profit" value={s?.delivered_profit} accent />
                  <Metric label="Available" value={s?.available} />
                  <Metric label="Paid out" value={s?.paid_out} />
                  <Metric label="Payout pending" value={s?.pending_payout} muted />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger className="grid h-8 w-8 place-items-center rounded-md border hover:bg-muted">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{r.business_name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {r.status === "pending" && (
                      <>
                        <DropdownMenuItem onClick={() => approve(r)}>
                          <Check className="mr-2 h-4 w-4" /> Approve & verify
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatus(r, "rejected")}>
                          <X className="mr-2 h-4 w-4" /> Reject
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {r.status === "active" && (
                      <DropdownMenuItem onClick={() => setStatus(r, "suspended")}>
                        <Pause className="mr-2 h-4 w-4" /> Deactivate
                      </DropdownMenuItem>
                    )}
                    {(r.status === "suspended" || r.status === "rejected") && (
                      <DropdownMenuItem onClick={() => setStatus(r, "active")}>
                        <Play className="mr-2 h-4 w-4" /> Activate
                      </DropdownMenuItem>
                    )}
                    {verified ? (
                      <DropdownMenuItem onClick={() => setVerified(r, false)}>
                        <ShieldOff className="mr-2 h-4 w-4" /> Remove verification
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setVerified(r, true)}>
                        <BadgeCheck className="mr-2 h-4 w-4" /> Mark verified
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setEditing(r)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyStoreLink(r)}>
                      <Copy className="mr-2 h-4 w-4" /> Copy store link
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={`/s/${r.code}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Visit storefront
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => remove(r)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete reseller
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
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

function Metric({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "text-sm font-semibold tabular-nums " +
          (accent ? "text-success" : muted ? "text-muted-foreground" : "")
        }
      >
        {value == null ? "—" : `৳${value.toLocaleString()}`}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    active: "bg-success/15 text-success",
    pending: "bg-warning/20 text-warning-foreground",
    suspended: "bg-muted text-muted-foreground",
    rejected: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${map[status]}`}>
      {status}
    </span>
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
