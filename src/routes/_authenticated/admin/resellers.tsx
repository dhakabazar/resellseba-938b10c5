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
  MailX,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Wallet,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { useServerFn } from "@tanstack/react-start";
import { confirmUserEmail, listResellerEmailStatus, deleteAuthUser } from "@/lib/admin-users.functions";
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
  deposit_required: boolean;
  deposit_required_amount: number;
  frozen_amount: number;
};

type Summary = {
  delivered_profit: number;
  pending_payout: number;
  paid_out: number;
  available: number;
  deposit_balance: number;
  frozen_amount: number;
};

type ResellerSearch = { status?: string };

export const Route = createFileRoute("/_authenticated/admin/resellers")({
  validateSearch: (s: Record<string, unknown>): ResellerSearch => ({
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  component: ResellersPage,
});

const FILTERS = [
  "all",
  "pending",
  "active",
  "suspended",
  "rejected",
  "email_unverified",
] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  pending: "Approval pending",
  active: "Active",
  suspended: "Deactivated",
  rejected: "Rejected",
  email_unverified: "Email unverified",
  all: "All",
};

function ResellersPage() {
  const confirmEmailFn = useServerFn(confirmUserEmail);
  const listEmailStatusFn = useServerFn(listResellerEmailStatus);
  const deleteAuthUserFn = useServerFn(deleteAuthUser);
  const searchParams = Route.useSearch();
  const [items, setItems] = useState<Reseller[]>([]);
  const [emailStatus, setEmailStatus] = useState<Record<string, { email: string | null; verified: boolean }>>({});
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>(
    (FILTERS as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as Filter) : "all",
  );
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [editing, setEditing] = useState<Reseller | null>(null);
  const [depositFor, setDepositFor] = useState<Reseller | null>(null);

  async function load() {
    setLoading(true);
    const [listRes, metricsRes] = await Promise.all([
      supabase
        .from("resellers")
        .select(
          "id,user_id,business_name,code,contact_phone,address,status,commission_rate,leader_id,notes,approved_at,created_at,payout_method,payout_account_name,payout_account_number,payout_bank_name,payout_branch,payout_routing,deposit_required,deposit_required_amount,frozen_amount",
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_reseller_metrics"),
    ]);

    setItems((listRes.data ?? []) as Reseller[]);

    const metrics = (metricsRes.data ?? []) as Array<{
      reseller_id: string;
      orders: number;
      delivered_profit: number;
      pending_payout: number;
      paid_out: number;
      available: number;
      deposit_balance: number;
      frozen_amount: number;
    }>;
    setSummaries(
      Object.fromEntries(
        metrics.map((m) => [
          m.reseller_id,
          {
            delivered_profit: Number(m.delivered_profit ?? 0),
            pending_payout: Number(m.pending_payout ?? 0),
            paid_out: Number(m.paid_out ?? 0),
            available: Number(m.available ?? 0),
            deposit_balance: Number(m.deposit_balance ?? 0),
            frozen_amount: Number(m.frozen_amount ?? 0),
          } as Summary,
        ]),
      ),
    );
    setOrderCounts(Object.fromEntries(metrics.map((m) => [m.reseller_id, Number(m.orders ?? 0)])));
    setLoading(false);
  }


  async function loadEmailStatus() {
    try {
      const list = await listEmailStatusFn();
      const map: Record<string, { email: string | null; verified: boolean }> = {};
      for (const u of list) map[u.user_id] = { email: u.email, verified: u.email_confirmed };
      setEmailStatus(map);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    load();
    loadEmailStatus();
  }, []);

  const filtered = useMemo(() => {
    let out = items;
    if (filter === "email_unverified")
      out = out.filter((r) => !emailStatus[r.user_id]?.verified);
    else if (filter !== "all") out = out.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (q)
      out = out.filter(
        (r) =>
          r.business_name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.contact_phone ?? "").toLowerCase().includes(q) ||
          (emailStatus[r.user_id]?.email ?? "").toLowerCase().includes(q),
      );
    return out;
  }, [items, filter, query, emailStatus]);

  const counts = useMemo(() => {
    return {
      pending: items.filter((r) => r.status === "pending").length,
      active: items.filter((r) => r.status === "active").length,
      suspended: items.filter((r) => r.status === "suspended").length,
      rejected: items.filter((r) => r.status === "rejected").length,
      email_unverified: items.filter((r) => !emailStatus[r.user_id]?.verified).length,
      all: items.length,
    } as Record<Filter, number>;
  }, [items, emailStatus]);

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
    if (status === "active") {
      await supabase
        .from("user_roles")
        .upsert({ user_id: r.user_id, role: "reseller" }, { onConflict: "user_id,role" });
    } else {
      // Not approved → revoke panel access
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", r.user_id)
        .eq("role", "reseller");
    }
    toast.success("Status updated");
    load();
  }


  async function confirmEmail(r: Reseller) {
    try {
      const res = await confirmEmailFn({ data: { userId: r.user_id } });
      if (res.alreadyConfirmed) toast.info("Email already confirmed");
      else toast.success(`Email confirmed for ${res.email ?? r.business_name}`);
      loadEmailStatus();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to confirm email");
    }
  }

  async function remove(r: Reseller) {
    if (
      !confirm(
        `Delete reseller "${r.business_name}"? This also deletes the auth account and may remove related listings/orders.`,
      )
    )
      return;
    const { error } = await supabase.from("resellers").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    try {
      await deleteAuthUserFn({ data: { userId: r.user_id } });
    } catch {
      /* ignore — reseller row already gone */
    }
    toast.success("Deleted");
    load();
    loadEmailStatus();
  }

  function copyStoreLink(r: Reseller) {
    const url = `${window.location.origin}/s/${r.code}`;
    navigator.clipboard.writeText(url);
    toast.success("Store link copied");
  }

  return (
    <div>
      <PageHeader
        title="Reseller Network"
        description="Monitor and manage all storefront applications, email verifications, and partner status."
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
              label: `${FILTER_LABELS[f]} (${counts[f]})`,
            })),
          },
        ]}
        perPage={perPage}
        onPerPage={(n) => {
          setPerPage(n);
          setPage(1);
        }}
      />

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No resellers match this filter." />
      ) : (
        <div className="surface-card divide-y">
          {usePaginated(filtered, page, perPage).map((r) => {
            const s = summaries[r.id];
            const em = emailStatus[r.user_id];
            const emailVerified = !!em?.verified;
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
                      {emailVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <MailCheck className="h-3 w-3" /> Email verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                          <MailX className="h-3 w-3" /> Email unverified
                        </span>
                      )}
                      {r.deposit_required && Number(r.deposit_required_amount) > 0 && (
                        (s?.deposit_balance ?? 0) >= Number(r.deposit_required_amount) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                            <ShieldCheck className="h-3 w-3" /> Deposit ok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Deposit due ৳
                            {(Number(r.deposit_required_amount) - (s?.deposit_balance ?? 0)).toLocaleString()}
                          </span>
                        )
                      )}
                      {Number(r.frozen_amount) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Lock className="h-3 w-3" /> Frozen ৳{Number(r.frozen_amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 break-words text-xs text-muted-foreground">
                      {em?.email ? <span>{em.email} · </span> : null}
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
                            <Check className="mr-2 h-4 w-4" /> Approve access
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStatus(r, "rejected")}>
                            <X className="mr-2 h-4 w-4" /> Reject
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {r.status === "active" && (
                        <DropdownMenuItem onClick={() => setStatus(r, "suspended")}>
                          <ShieldOff className="mr-2 h-4 w-4" /> Deactivate access
                        </DropdownMenuItem>
                      )}
                      {(r.status === "suspended" || r.status === "rejected") && (
                        <DropdownMenuItem onClick={() => setStatus(r, "active")}>
                          <Play className="mr-2 h-4 w-4" /> Activate
                        </DropdownMenuItem>
                      )}
                      {!emailVerified && (
                        <DropdownMenuItem onClick={() => confirmEmail(r)}>
                          <MailCheck className="mr-2 h-4 w-4" /> Confirm email
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditing(r)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDepositFor(r)}>
                        <Wallet className="mr-2 h-4 w-4" /> Deposit & freeze
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

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
                  <Metric label="Orders" value={orderCounts[r.id] ?? 0} plain />
                  <Metric label="Delivered profit" value={s?.delivered_profit} accent />
                  <Metric label="Available" value={s?.available} />
                  <Metric label="Paid out" value={s?.paid_out} />
                  <Metric label="Payout pending" value={s?.pending_payout} muted />
                  <Metric label="Deposit paid" value={s?.deposit_balance} />
                  <Metric
                    label="Deposit due"
                    value={
                      r.deposit_required
                        ? Math.max(Number(r.deposit_required_amount ?? 0) - (s?.deposit_balance ?? 0), 0)
                        : 0
                    }
                    muted={
                      !r.deposit_required ||
                      Math.max(Number(r.deposit_required_amount ?? 0) - (s?.deposit_balance ?? 0), 0) === 0
                    }
                  />
                  <Metric label="Frozen" value={Number(r.frozen_amount ?? 0)} muted />
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

      {depositFor && (
        <DepositModal
          reseller={depositFor}
          onClose={() => setDepositFor(null)}
          onSaved={() => {
            setDepositFor(null);
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
    suspended: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    rejected: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${map[status]}`}>
      {status === "suspended" ? "deactivated" : status}
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="surface-card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:max-h-[88dvh] sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="truncate text-base font-semibold">Edit reseller</h3>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
        <div>
          <label className="mb-1 block text-xs font-medium">Business name</label>
          <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={cls} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">

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
        <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
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
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium">Routing</label>
                  <input value={payoutRouting} onChange={(e) => setPayoutRouting(e.target.value)} className={cls} />
                </div>
              </>
            )}
          </div>
        </div>

        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={busy}
            className="btn-brand inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>

      </form>
    </div>
  );
}

type DepositRow = {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
};

function DepositModal({
  reseller,
  onClose,
  onSaved,
}: {
  reseller: Reseller;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [required, setRequired] = useState(Boolean(reseller.deposit_required));
  const [requiredAmount, setRequiredAmount] = useState(String(reseller.deposit_required_amount ?? 0));
  const [frozen, setFrozen] = useState(String(reseller.frozen_amount ?? 0));
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bkash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteRow, setDeleteRow] = useState<DepositRow | null>(null);

  const balance = rows.reduce((n, r) => n + Number(r.amount), 0);
  const due = required ? Math.max(Number(requiredAmount || 0) - balance, 0) : 0;

  const cls =
    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reseller_deposits")
      .select("id,amount,method,reference,note,created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as DepositRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadRows();
  }, [reseller.id]);

  async function saveRules() {
    setBusy(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        deposit_required: required,
        deposit_required_amount: Number(requiredAmount) || 0,
        frozen_amount: Number(frozen) || 0,
      })
      .eq("id", reseller.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("ডিপোজিট সেটিং সেভ হয়েছে");
    onSaved();
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt) return toast.error("অ্যামাউন্ট দিন (adjustment হলে − ব্যবহার করুন)");
    setBusy(true);
    const { error } = await supabase.from("reseller_deposits").insert({
      reseller_id: reseller.id,
      amount: amt,
      method: method || null,
      reference: reference || null,
      note: note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setAmount("");
    setNote("");
    setReference("");
    toast.success("লেজার এন্ট্রি যোগ হয়েছে");
    loadRows();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Deposit & freeze — {reseller.business_name}</div>
            <p className="text-[11px] text-muted-foreground">
              ডিপোজিট বাকি থাকলে reseller অর্ডার Confirmed করতে পারবে না। ফ্রিজ অ্যামাউন্ট উইথড্র করা যাবে না।
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</div>
              <div className="text-base font-bold">৳{balance.toLocaleString()}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Due</div>
              <div className={"text-base font-bold " + (due > 0 ? "text-destructive" : "text-success")}>
                ৳{due.toLocaleString()}
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Frozen</div>
              <div className="text-base font-bold">৳{(Number(frozen) || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4"
              />
              ডিপোজিট ট্রিগার চালু
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">প্রয়োজনীয় ডিপোজিট (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={requiredAmount}
                  onChange={(e) => setRequiredAmount(e.target.value)}
                  className={cls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">ফ্রিজ অ্যামাউন্ট (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={frozen}
                  onChange={(e) => setFrozen(e.target.value)}
                  className={cls}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveRules}
                disabled={busy}
                className="btn-brand rounded-md px-4 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                সেটিং সেভ
              </button>
            </div>
          </div>

          <form onSubmit={addEntry} className="space-y-3 rounded-md border p-3">
            <div className="text-xs font-semibold">নতুন এন্ট্রি</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">অ্যামাউন্ট (৳) — ফেরত হলে − দিন</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">মেথড</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={cls}>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">রেফারেন্স / TrxID</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">নোট</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> যোগ করুন
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="font-medium">৳{Number(r.amount).toLocaleString()}</td>
                    <td className="capitalize">{r.method ?? "—"}</td>
                    <td className="text-muted-foreground">{r.reference ?? "—"}</td>
                    <td className="text-muted-foreground">{r.note ?? "—"}</td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteRow(r)}
                        className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      কোনো ডিপোজিট এন্ট্রি নেই।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {deleteRow && (
            <ConfirmModal
              isOpen
              variant="danger"
              title="ডিপোজিট এন্ট্রি ডিলিট?"
              description={`৳${Number(deleteRow.amount).toLocaleString()} (${deleteRow.method ?? "—"}) এন্ট্রিটি ডিলিট হলে reseller-এর ডিপোজিট ব্যালান্স কমে যাবে এবং ডিপোজিট বাকি থাকলে order confirm ব্লক হয়ে যাবে।`}
              confirmText="ডিলিট করুন"
              cancelText="বাতিল"
              onClose={() => setDeleteRow(null)}
              onConfirm={async () => {
                const row = deleteRow;
                setDeleteRow(null);
                if (!row) return;
                const { error } = await supabase.from("reseller_deposits").delete().eq("id", row.id);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success("এন্ট্রি ডিলিট হয়েছে");
                loadRows();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
