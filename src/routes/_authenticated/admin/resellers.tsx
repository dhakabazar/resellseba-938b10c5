import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { DataToolbar, Pagination, usePaginated } from "@/components/data-list";
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
  Copy,
  MailCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { confirmUserEmail, listPendingSignups, deleteAuthUser, type PendingSignup } from "@/lib/admin-users.functions";
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
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_bank_name: string | null;
  payout_branch: string | null;
  payout_routing: string | null;
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

const FILTERS = ["incomplete", "pending", "active", "suspended", "rejected", "unverified", "all"] as const;
type Filter = (typeof FILTERS)[number];

type UnifiedRow =
  | { kind: "reseller"; r: Reseller }
  | { kind: "pending"; p: PendingSignup };


function ResellersPage() {
  const confirmEmailFn = useServerFn(confirmUserEmail);
  const listPendingFn = useServerFn(listPendingSignups);
  const deleteAuthUserFn = useServerFn(deleteAuthUser);
  const [pending, setPending] = useState<PendingSignup[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [items, setItems] = useState<Reseller[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [editing, setEditing] = useState<Reseller | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("resellers")
      .select(
        "id,user_id,business_name,code,contact_phone,address,status,commission_rate,leader_id,notes,approved_at,created_at,payout_method,payout_account_name,payout_account_number,payout_bank_name,payout_branch,payout_routing",
      )
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as Reseller[];
    setItems(rows);
    setLoading(false);

    // Load earnings summary + order count per reseller in parallel
    const results = await Promise.all(
      rows.map(async (r) => {
        const [summaryRes, countRes] = await Promise.all([
          supabase.rpc("reseller_profit_summary", { _reseller_id: r.id }),
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("reseller_id", r.id),
        ]);
        const row = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
        return {
          id: r.id,
          summary: {
            delivered_profit: Number(row?.delivered_profit ?? 0),
            pending_payout: Number(row?.pending_payout ?? 0),
            paid_out: Number(row?.paid_out ?? 0),
            available: Number(row?.available ?? 0),
          } as Summary,
          orders: countRes.count ?? 0,
        };
      }),
    );
    setSummaries(Object.fromEntries(results.map((x) => [x.id, x.summary])));
    setOrderCounts(Object.fromEntries(results.map((x) => [x.id, x.orders])));
  }


  async function loadPending() {
    setPendingLoading(true);
    try {
      const rows = await listPendingFn();
      setPending(rows ?? []);
    } catch (e: any) {
      // silent — pending list is auxiliary
    } finally {
      setPendingLoading(false);
    }
  }

  async function confirmPendingEmail(u: PendingSignup) {
    try {
      const res = await confirmEmailFn({ data: { userId: u.user_id } });
      if (res.alreadyConfirmed) toast.info("Email already confirmed");
      else toast.success(`Email confirmed for ${res.email ?? u.email ?? "user"}`);
      loadPending();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to confirm email");
    }
  }

  async function removePending(u: PendingSignup) {
    if (!confirm(`Delete signup "${u.email ?? u.full_name ?? u.user_id}"? Ei user auth theke muche jabe.`)) return;
    try {
      await deleteAuthUserFn({ data: { userId: u.user_id } });
      toast.success("Signup deleted");
      loadPending();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete user");
    }
  }

  useEffect(() => {
    load();
    loadPending();
  }, []);

  const unified = useMemo<UnifiedRow[]>(() => {
    const pendingRows: UnifiedRow[] = pending.map((p) => ({ kind: "pending", p }));
    const resellerRows: UnifiedRow[] = items.map((r) => ({ kind: "reseller", r }));
    return [...pendingRows, ...resellerRows];
  }, [pending, items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unified.filter((row) => {
      // status filter
      if (filter === "incomplete") {
        if (row.kind !== "pending") return false;
      } else if (filter === "unverified") {
        if (row.kind === "pending") {
          if (row.p.email_confirmed) return false;
        } else if (row.r.approved_at) return false;
      } else if (filter !== "all") {
        if (row.kind !== "reseller" || row.r.status !== filter) return false;
      }
      if (!q) return true;
      if (row.kind === "pending") {
        return (
          (row.p.email ?? "").toLowerCase().includes(q) ||
          (row.p.full_name ?? "").toLowerCase().includes(q) ||
          (row.p.phone ?? "").toLowerCase().includes(q)
        );
      }
      return (
        row.r.business_name.toLowerCase().includes(q) ||
        row.r.code.toLowerCase().includes(q) ||
        (row.r.contact_phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [unified, filter, query]);

  const counts = useMemo(() => {
    return {
      incomplete: pending.length,
      pending: items.filter((r) => r.status === "pending").length,
      active: items.filter((r) => r.status === "active").length,
      suspended: items.filter((r) => r.status === "suspended").length,
      rejected: items.filter((r) => r.status === "rejected").length,
      unverified:
        items.filter((r) => !r.approved_at).length +
        pending.filter((p) => !p.email_confirmed).length,
      all: items.length + pending.length,
    } as Record<Filter, number>;
  }, [items, pending]);


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

  async function confirmEmail(r: Reseller) {
    try {
      const res = await confirmEmailFn({ data: { userId: r.user_id } });
      if (res.alreadyConfirmed) toast.info("Email already confirmed");
      else toast.success(`Email confirmed for ${res.email ?? r.business_name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to confirm email");
    }
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
        description="Review applications, set commission/leader, and manage status."
      />

      <DataToolbar
        search={query}
        onSearch={(v) => {
          setQuery(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, code, phone, email…"
        filters={[
          {
            key: "status",
            label: "Status",
            value: filter === "all" ? "" : filter,
            onChange: (v) => {
              setFilter((v || "all") as Filter);
              setPage(1);
            },
            options: FILTERS.filter((f) => f !== "all").map((f) => ({
              value: f,
              label: `${labelFor(f)} (${counts[f]})`,
            })),
          },
        ]}
        perPage={perPage}
        onPerPage={(n) => {
          setPerPage(n);
          setPage(1);
        }}
      />


      {loading || pendingLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No resellers match this filter." />
      ) : (
        <div className="surface-card divide-y">
          {usePaginated(filtered, page, perPage).map((row) => {
            if (row.kind === "pending") {
              const u = row.p;
              return (
                <div key={`p-${u.user_id}`} className="p-4">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-semibold uppercase text-amber-700 dark:text-amber-400">
                      {(u.email ?? "?").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{u.email ?? "(no email)"}</span>
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium capitalize text-amber-700 dark:text-amber-400">
                          Incomplete
                        </span>
                        {u.email_confirmed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <BadgeCheck className="h-3 w-3" /> Email verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <ShieldOff className="h-3 w-3" /> Email unverified
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 break-words text-xs text-muted-foreground">
                        {u.full_name ?? "—"}
                        {u.phone ? ` · ${u.phone}` : ""}
                        {" · signed up "}
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Onboarding baki — reseller login kore profile complete korle full row ashbe.
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="grid h-8 w-8 shrink-0 place-items-center rounded-md border hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>{u.email ?? u.user_id}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {!u.email_confirmed && (
                          <DropdownMenuItem onClick={() => confirmPendingEmail(u)}>
                            <MailCheck className="mr-2 h-4 w-4" /> Confirm email
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => removePending(u)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete signup
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            }

            const r = row.r;
            const s = summaries[r.id];
            const verified = !!r.approved_at;
            return (
              <div key={r.id} className="p-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold uppercase text-primary">
                    {r.business_name.slice(0, 2)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
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
                    <div className="mt-0.5 break-words text-xs text-muted-foreground">
                      #{r.code} · {r.contact_phone ?? "no phone"} · Commission {r.commission_rate}%
                      {r.leader_id ? " · Leader linked" : ""}
                    </div>
                    <div className="mt-0.5 break-words text-xs text-muted-foreground">
                      Payout:{" "}
                      {r.payout_method ? (
                        <span>
                          <span className="font-medium capitalize text-foreground">{r.payout_method}</span>
                          {" · "}
                          {r.payout_account_number ?? "—"}
                          {r.payout_account_name ? ` · ${r.payout_account_name}` : ""}
                          {r.payout_method === "bank" && r.payout_bank_name ? ` · ${r.payout_bank_name}` : ""}
                        </span>
                      ) : (
                        <span className="text-destructive">not set</span>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="grid h-8 w-8 shrink-0 place-items-center rounded-md border hover:bg-muted">
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
                      <DropdownMenuItem onClick={() => confirmEmail(r)}>
                        <MailCheck className="mr-2 h-4 w-4" /> Confirm email
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

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <Metric label="Orders" value={orderCounts[r.id] ?? 0} plain />
                  <Metric label="Delivered profit" value={s?.delivered_profit} accent />
                  <Metric label="Available" value={s?.available} />
                  <Metric label="Paid out" value={s?.paid_out} />
                  <Metric label="Payout pending" value={s?.pending_payout} muted />
                </div>
              </div>
            );
          })}

        </div>
      )}


      {!loading && filtered.length > 0 && (
        <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
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
  plain,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
  muted?: boolean;
  plain?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "text-sm font-semibold tabular-nums " +
          (accent ? "text-success" : muted ? "text-muted-foreground" : "")
        }
      >
        {value == null ? "—" : plain ? value.toLocaleString() : `৳${value.toLocaleString()}`}
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
  const [payoutMethod, setPayoutMethod] = useState<string>(reseller.payout_method ?? "");
  const [payoutAccountName, setPayoutAccountName] = useState(reseller.payout_account_name ?? "");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState(reseller.payout_account_number ?? "");
  const [payoutBankName, setPayoutBankName] = useState(reseller.payout_bank_name ?? "");
  const [payoutBranch, setPayoutBranch] = useState(reseller.payout_branch ?? "");
  const [payoutRouting, setPayoutRouting] = useState(reseller.payout_routing ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const isBank = payoutMethod === "bank";
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
        payout_method: payoutMethod || null,
        payout_account_name: payoutAccountName || null,
        payout_account_number: payoutAccountNumber || null,
        payout_bank_name: isBank ? payoutBankName || null : null,
        payout_branch: isBank ? payoutBranch || null : null,
        payout_routing: isBank ? payoutRouting || null : null,
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

        <div className="border-t pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payout information
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Method</label>
              <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className={cls}>
                <option value="">— Not set —</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="rocket">Rocket</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Account holder</label>
              <input value={payoutAccountName} onChange={(e) => setPayoutAccountName(e.target.value)} className={cls} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium">
                {payoutMethod === "bank" ? "Account number" : "Mobile number"}
              </label>
              <input value={payoutAccountNumber} onChange={(e) => setPayoutAccountNumber(e.target.value)} className={cls} />
            </div>
            {payoutMethod === "bank" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium">Bank</label>
                  <input value={payoutBankName} onChange={(e) => setPayoutBankName(e.target.value)} className={cls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Branch</label>
                  <input value={payoutBranch} onChange={(e) => setPayoutBranch(e.target.value)} className={cls} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium">Routing</label>
                  <input value={payoutRouting} onChange={(e) => setPayoutRouting(e.target.value)} className={cls} />
                </div>
              </>
            )}
          </div>
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
