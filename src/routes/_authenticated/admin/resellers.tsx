import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResellerAvatar } from "@/components/reseller-avatar";
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
  SmartphoneNfc,
  
  ShieldCheck,
  AlertTriangle,
  Lock,
  Wallet,
  Plus,
  UserCircle,
  IdCard,
  Eye,
  Receipt,
  PackageSearch,
  Phone,
  PhoneCall,
  MessageCircle,
  KeyRound,
  LogIn,
  ChevronDown,
  Search,
  StickyNote,


} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui-kit/ConfirmModal";
import { useServerFn } from "@tanstack/react-start";
import { confirmUserEmail, listResellerEmailStatus, deleteAuthUser } from "@/lib/admin-users.functions";
import { impersonateReseller, resetResellerPassword } from "@/lib/reseller-access.functions";
import { startImpersonation } from "@/lib/impersonation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResellerProfile, type ResellerProfileData } from "@/components/ResellerProfile";
import { DepositLedger } from "@/components/deposit-ledger";
import { confirmAction } from "@/lib/confirm";
import { PasswordResetModal } from "@/components/password-reset-modal";
import { useAdvancedSettings } from "@/lib/advanced-settings";
import { VerifyBadges, verifyPending, type VerifyFlags } from "@/components/verify-badges";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/use-auth";
import {
  resellerStatusActions,
  resellerStatusClass,
  resellerStatusLabel,
  type ResellerStatus,
} from "@/lib/reseller-status";

type Status = ResellerStatus;


type Reseller = {
  id: string;
  user_id: string;
  avatar_url?: string | null;
  business_name: string;
  code: string;
  contact_phone: string | null;
  address: string | null;
  nid_number: string | null;
  status: Status;
  commission_rate: number;
  leader_id: string | null;
  agent_id: string | null;
  notes: string | null;
  notes_by?: string | null;
  notes_at?: string | null;
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
  pending: resellerStatusLabel("pending"),
  active: resellerStatusLabel("active"),
  suspended: resellerStatusLabel("suspended"),
  rejected: resellerStatusLabel("rejected"),
  email_unverified: "Unverified",
  all: "All",
};

/** Security deposit state filter for the reseller list. */
type DepositFilter = "all" | "paid" | "due" | "not_required";

const DEPOSIT_FILTERS = ["all", "paid", "due", "not_required"] as const;

const DEPOSIT_FILTER_LABELS: Record<DepositFilter, string> = {
  all: "All deposits",
  paid: "Deposit paid",
  due: "Deposit due",
  not_required: "No deposit rule",
};

/** "paid" | "due" | "not_required" for one reseller. */
function depositStateOf(
  r: { deposit_required: boolean; deposit_required_amount: number },
  balance: number,
): DepositFilter {
  const need = Number(r.deposit_required_amount ?? 0);
  const bal = Number(balance ?? 0);
  // Anyone who actually paid counts as paid, even without a deposit rule.
  if (need > 0 && r.deposit_required) return bal >= need ? "paid" : "due";
  if (bal > 0) return "paid";
  return "not_required";

}





/** Horizontal row of button filters (like the order status tabs). */
function FilterButtonRow({
  options,
  active,
  onSelect,
}: {
  options: Array<{ value: string; label: string; count: number }>;
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isActive = active === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            <span className="truncate">{o.label}</span>
            <span className={`text-[11px] ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact dropdown-button filter (label + current value + count). */
function FilterMenu({
  label,
  activeLabel,
  options,
  onSelect,
}: {
  label: string;
  activeLabel: string;
  options: Array<{ value: string; label: string; active: boolean }>;
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted">
        <span className="text-muted-foreground">{label}:</span>
        <span className="max-w-[14rem] truncate">{activeLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={o.active ? "font-semibold text-primary" : ""}
          >
            {o.active ? <Check className="mr-2 h-4 w-4" /> : <span className="mr-2 h-4 w-4" />}
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Dropdown-style filter with an inline search input (useful for long lists). */
function SearchableFilterMenu({
  label,
  activeLabel,
  options,
  onSelect,
  searchPlaceholder = "Search…",
}: {
  label: string;
  activeLabel: string;
  options: Array<{ value: string; label: string; active: boolean }>;
  onSelect: (value: string) => void;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      search.trim() === ""
        ? options
        : options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted">
        <span className="text-muted-foreground">{label}:</span>
        <span className="max-w-[14rem] truncate">{activeLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </div>
        <div className="modal-scroll max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">No results</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition hover:bg-muted ${
                  o.active ? "font-semibold text-primary" : ""
                }`}
              >
                {o.active ? <Check className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type BulkAction =
  | "activate"
  | "suspend"
  | "verify_email"
  | "verify_phone"
  | "clear_phone"
  | "delete";

/** Selection header with the bulk actions the current role is allowed to run. */
function BulkBar({
  total,
  selectedIds,
  onSelectAll,
  onClear,
  busy,
  can,
  onAction,
  agents,
  onAssignAgent,
}: {
  total: number;
  selectedIds: string[];
  onSelectAll: (on: boolean) => void;
  onClear: () => void;
  busy: boolean;
  can: (permission: string) => boolean;
  onAction: (action: BulkAction) => void;
  agents: Array<{ id: string; display_name: string }>;
  onAssignAgent: (agentId: string | null) => void;
}) {
  const count = selectedIds.length;
  const allSelected = count > 0 && count >= total;
  const canAssign = can("resellers.edit") || can("agents.manage");
  const actions = ([
    { key: "activate", label: "Activate", permission: "resellers.edit" },
    { key: "suspend", label: "Deactivate", permission: "resellers.edit" },
    { key: "verify_email", label: "Mark email verified", permission: "resellers.verify" },
    { key: "verify_phone", label: "Mark mobile verified", permission: "resellers.verify" },
    { key: "clear_phone", label: "Clear mobile verification", permission: "resellers.verify" },
    { key: "delete", label: "Delete selected", permission: "resellers.delete", danger: true },
  ] as Array<{ key: BulkAction; label: string; permission: string; danger?: boolean }>).filter((a) => can(a.permission));


  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="h-4 w-4 accent-[hsl(var(--primary))]"
        />
        Select all ({total})
      </label>
      {count > 0 ? (
        <>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {count} selected
          </span>
          {actions.length === 0 ? (
            <span className="text-xs text-muted-foreground">No bulk permission for your role</span>
          ) : (
            actions.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={busy}
                onClick={() => onAction(a.key)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                  a.danger
                    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {a.label}
              </button>
            ))
          )}
          {canAssign && (
            <select
              value=""
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                onAssignAgent(v === "none" ? null : v);
                e.target.value = "";
              }}
              title="Assign agent to selected resellers"
              className="rounded-md border bg-background px-2 py-1 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Assign agent…</option>
              <option value="none">Unassign agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          )}

          <button type="button" onClick={onClear} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Clear selection
          </button>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Select resellers to run bulk actions</span>
      )}
    </div>
  );
}

function ResellersPage() {
  const nav = useNavigate();
  const { can, isSuperAdmin } = usePermissions();
  const { user } = useAuth();
  /** `resellers.view_own` limits the list to resellers assigned to this staff agent. */
  const ownOnly = !isSuperAdmin && can("resellers.view_own") && !can("resellers.view_all") && !can("resellers.manage");
  const canViewAll = !ownOnly && (isSuperAdmin || can("resellers.view_all") || can("resellers.view") || can("resellers.manage"));
  const scopeOwn = ownOnly;
  const confirmEmailFn = useServerFn(confirmUserEmail);
  const listEmailStatusFn = useServerFn(listResellerEmailStatus);
  const deleteAuthUserFn = useServerFn(deleteAuthUser);
  const resetPasswordFn = useServerFn(resetResellerPassword);
  const impersonateFn = useServerFn(impersonateReseller);
  const searchParams = Route.useSearch();
  const [items, setItems] = useState<Reseller[]>([]);
  const [emailStatus, setEmailStatus] = useState<Record<string, { email: string | null; verified: boolean }>>({});
  /** profiles.email_verified_at / phone_verified_at keyed by user_id */
  const [profileVerify, setProfileVerify] = useState<Record<string, { email: boolean; phone: boolean }>>({});
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
  const [profileFor, setProfileFor] = useState<Reseller | null>(null);
  const [resetFor, setResetFor] = useState<Reseller | null>(null);
  const [noteFor, setNoteFor] = useState<Reseller | null>(null);
  const [noteAuthors, setNoteAuthors] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<Array<{ id: string; display_name: string }>>([]);
  const [agentFilter, setAgentFilter] = useState("");
  const [depositFilter, setDepositFilter] = useState<DepositFilter>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const { settings: advanced } = useAdvancedSettings();
  const autoApprove = advanced.resellerAutoApprove;


  async function load() {
    setLoading(true);
    const [listRes, metricsRes, agentsRes] = await Promise.all([
      supabase
        .from("resellers")
        .select(
          "id,user_id,avatar_url,business_name,code,contact_phone,address,nid_number,status,commission_rate,leader_id,agent_id,notes,notes_by,notes_at,approved_at,created_at,payout_method,payout_account_name,payout_account_number,payout_bank_name,payout_branch,payout_routing,deposit_required,deposit_required_amount,frozen_amount",
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_reseller_metrics"),
      supabase.from("agents").select("id,display_name,user_id").order("display_name"),
    ]);

    const agentRows = (agentsRes.data ?? []) as Array<{ id: string; display_name: string; user_id: string }>;
    setAgents(agentRows.map((a) => ({ id: a.id, display_name: a.display_name })));

    let rows = (listRes.data ?? []) as Reseller[];
    if (scopeOwn) {
      const mine = new Set(agentRows.filter((a) => a.user_id === user?.id).map((a) => a.id));
      rows = rows.filter((r) => r.agent_id && mine.has(r.agent_id));
    }
    setItems(rows);

    // App-level verification lives on profiles (auth email confirm is separate).
    const ids = rows.map((r) => r.user_id);
    if (ids.length) {
      const { data: profRows } = await supabase
        .from("profiles")
        .select("id,email_verified_at,phone_verified_at")
        .in("id", ids);
      setProfileVerify(
        Object.fromEntries(
          (profRows ?? []).map((p: any) => [
            p.id,
            { email: Boolean(p.email_verified_at), phone: Boolean(p.phone_verified_at) },
          ]),
        ),
      );
    }

    // Who wrote each internal note (staff profiles).
    const authorIds = Array.from(new Set(rows.map((r) => r.notes_by).filter(Boolean))) as string[];
    if (authorIds.length) {
      const { data: authorRows } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", authorIds);
      setNoteAuthors(
        Object.fromEntries(
          (authorRows ?? []).map((p: any) => [p.id, (p.full_name as string | null) || "Staff"]),
        ),
      );
    } else {
      setNoteAuthors({});
    }

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

  /**
   * Refresh a single reseller row in place — no full page reload, so the
   * current page, filters, scroll position and selection stay untouched.
   */
  async function refreshOne(id: string, opts: { metrics?: boolean } = {}) {
    const { data } = await supabase
      .from("resellers")
      .select(
        "id,user_id,avatar_url,business_name,code,contact_phone,address,nid_number,status,commission_rate,leader_id,agent_id,notes,notes_by,notes_at,approved_at,created_at,payout_method,payout_account_name,payout_account_number,payout_bank_name,payout_branch,payout_routing,deposit_required,deposit_required_amount,frozen_amount",
      )
      .eq("id", id)
      .maybeSingle();
    const row = data as Reseller | null;
    if (!row) {
      // Row is gone (deleted or moved out of scope) — drop it locally.
      setItems((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    setItems((prev) => prev.map((r) => (r.id === id ? row : r)));

    if (row.notes_by && !noteAuthors[row.notes_by]) {
      const { data: author } = await supabase
        .from("profiles")
        .select("id,full_name")
        .eq("id", row.notes_by)
        .maybeSingle();
      if (author)
        setNoteAuthors((prev) => ({
          ...prev,
          [(author as any).id]: ((author as any).full_name as string | null) || "Staff",
        }));
    }

    if (opts.metrics) {
      const { data: metricRows } = await supabase.rpc("admin_reseller_metrics");
      const m = ((metricRows ?? []) as any[]).find((x) => x.reseller_id === id);
      if (m) {
        setSummaries((prev) => ({
          ...prev,
          [id]: {
            delivered_profit: Number(m.delivered_profit ?? 0),
            pending_payout: Number(m.pending_payout ?? 0),
            paid_out: Number(m.paid_out ?? 0),
            available: Number(m.available ?? 0),
            deposit_balance: Number(m.deposit_balance ?? 0),
            frozen_amount: Number(m.frozen_amount ?? 0),
          } as Summary,
        }));
        setOrderCounts((prev) => ({ ...prev, [id]: Number(m.orders ?? 0) }));
      }
    }
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
    // reload once the permission scope / signed-in user is known
  }, [scopeOwn, user?.id]);

  useEffect(() => {
    const s = searchParams.status;
    if (s && (FILTERS as readonly string[]).includes(s)) {
      setFilter(s as Filter);
      setPage(1);
    }
  }, [searchParams.status]);

  /** Verification truth for one reseller: profiles first, auth confirm as fallback. */
  const verifyFor = (r: Reseller): VerifyFlags => ({
    emailVerified: Boolean(profileVerify[r.user_id]?.email || emailStatus[r.user_id]?.verified),
    phoneVerified: Boolean(profileVerify[r.user_id]?.phone),
    hasPhone: Boolean(r.contact_phone),
    requireEmail: advanced.verifyEnabled && advanced.verifyEmail,
    requirePhone: advanced.verifyEnabled && advanced.verifySms,
  });

  const filtered = useMemo(() => {
    let out = items;
    if (filter === "email_unverified")
      out = out.filter((r) => {
        const f = verifyFor(r);
        return verifyPending(f) || !f.emailVerified;
      });
    else if (filter !== "all") out = out.filter((r) => r.status === filter);
    if (agentFilter) out = out.filter((r) => (agentFilter === "none" ? !r.agent_id : r.agent_id === agentFilter));
    if (depositFilter !== "all")
      out = out.filter((r) => depositStateOf(r, summaries[r.id]?.deposit_balance ?? 0) === depositFilter);
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
  }, [items, filter, query, emailStatus, profileVerify, advanced, agentFilter, depositFilter, summaries]);

  /** Everything the counters use respects the selected agent. */
  const agentScoped = useMemo(
    () =>
      agentFilter
        ? items.filter((r) => (agentFilter === "none" ? !r.agent_id : r.agent_id === agentFilter))
        : items,
    [items, agentFilter],
  );

  const depositCounts = useMemo(() => {
    const out: Record<DepositFilter, number> = { all: agentScoped.length, paid: 0, due: 0, not_required: 0 };
    for (const r of agentScoped) out[depositStateOf(r, summaries[r.id]?.deposit_balance ?? 0)] += 1;
    return out;
  }, [agentScoped, summaries]);

  const depositDueTotal = useMemo(
    () =>
      agentScoped.reduce((sum, r) => {
        const bal = summaries[r.id]?.deposit_balance ?? 0;
        if (depositStateOf(r, bal) !== "due") return sum;
        return sum + Math.max(Number(r.deposit_required_amount ?? 0) - bal, 0);
      }, 0),
    [agentScoped, summaries],
  );


  const counts = useMemo(() => {
    return {
      pending: agentScoped.filter((r) => r.status === "pending").length,
      active: agentScoped.filter((r) => r.status === "active").length,
      suspended: agentScoped.filter((r) => r.status === "suspended").length,
      rejected: agentScoped.filter((r) => r.status === "rejected").length,
      email_unverified: agentScoped.filter((r) => {
        const f = verifyFor(r);
        return verifyPending(f) || !f.emailVerified;
      }).length,
      all: agentScoped.length,
    } as Record<Filter, number>;
  }, [agentScoped, emailStatus, profileVerify, advanced]);


  /**
   * Single entry point for every status change. Panel access (role + store
   * settings) is synced by the database, so the UI only writes the status.
   */
  async function setStatus(r: Reseller, status: Status) {
    if (status === r.status) return;
    if (status !== "active") {
      const ok = await confirmAction({
        title: status === "rejected" ? "Reject reseller" : "Deactivate reseller",
        description: "They lose access to the reseller panel until you activate them again.",
        detail: r.business_name,
        confirmText: status === "rejected" ? "Reject" : "Deactivate",
      });
      if (!ok) return;
    }
    const patch: { status: Status; approved_at?: string } = { status };
    if (status === "active" && !r.approved_at) patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from("resellers").update(patch).eq("id", r.id);
    if (error) return toast.error(error.message);

    toast.success(
      status === "active"
        ? `${r.business_name} is now active`
        : `Status set to ${resellerStatusLabel(status)}`,
    );
    refreshOne(r.id);
  }



  async function applyPasswordReset(r: Reseller, password: string) {
    try {
      await resetPasswordFn({ data: { userId: r.user_id, password } });
      toast.success(`Password updated for ${r.business_name}`);
      setResetFor(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reset password");
    }
  }


  async function loginAsReseller(r: Reseller) {
    try {
      const res = await impersonateFn({ data: { userId: r.user_id } });
      await startImpersonation({
        email: res.email,
        password: res.password,
        label: r.business_name,
        returnTo: window.location.pathname + window.location.search,
      });
      nav({ to: "/reseller", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not log in as reseller");
    }
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



  /** Manual mobile verification (no OTP) — admin vouches for the number. */
  async function setPhoneVerified(r: Reseller, verified: boolean): Promise<boolean> {
    const { error } = await supabase.rpc("admin_set_phone_verified", {
      _user_id: r.user_id,
      _verified: verified,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    setProfileVerify((prev) => ({
      ...prev,
      [r.user_id]: { email: Boolean(prev[r.user_id]?.email), phone: verified },
    }));
    toast.success(verified ? "Mobile marked verified" : "Mobile verification cleared");
    return true;
  }



  async function remove(r: Reseller) {
    if (
      !(await confirmAction({
        title: "Delete reseller",
        description:
          "This also deletes the login account and may remove related listings/orders.",
        detail: r.business_name,
        confirmText: "Delete reseller",
      }))
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
    setItems((prev) => prev.filter((x) => x.id !== r.id));
  }

  /** Assign (or clear) the commission agent for every selected reseller. */
  async function bulkAssignAgent(agentId: string | null) {
    const rows = filtered.filter((r) => selected[r.id]);
    if (rows.length === 0) return;
    if (!can("resellers.edit") && !can("agents.manage"))
      return toast.error("Your role cannot perform this action");

    const name = agentId ? agents.find((a) => a.id === agentId)?.display_name ?? "agent" : null;
    const ok = await confirmAction({
      title: name ? `Assign ${name}` : "Remove agent assignment",
      description: `This applies to ${rows.length} reseller${rows.length > 1 ? "s" : ""}.`,
      detail: `${rows.length} selected`,
      confirmText: "Apply",
    });
    if (!ok) return;

    setBulkBusy(true);
    const { error } = await supabase
      .from("resellers")
      .update({ agent_id: agentId })
      .in("id", rows.map((r) => r.id));
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    setSelected({});
    toast.success(name ? `${rows.length} assigned to ${name}` : `${rows.length} unassigned`);
    await load();
  }


  const selectedIds = useMemo(
    () => filtered.filter((r) => selected[r.id]).map((r) => r.id),
    [filtered, selected],
  );

  /** Run one bulk action over the current selection, permission-checked. */
  async function runBulk(action: BulkAction) {
    const rows = filtered.filter((r) => selected[r.id]);
    if (rows.length === 0) return;

    const need =
      action === "delete"
        ? "resellers.delete"
        : action === "activate" || action === "suspend"
          ? "resellers.edit"
          : "resellers.verify";
    if (!can(need)) return toast.error("Your role cannot perform this action");

    const titles: Record<BulkAction, string> = {
      activate: "Activate selected resellers",
      suspend: "Deactivate selected resellers",
      verify_email: "Mark email verified",
      verify_phone: "Mark mobile verified",
      clear_phone: "Clear mobile verification",
      delete: "Delete selected resellers",
    };
    const ok = await confirmAction({
      title: titles[action],
      description:
        action === "delete"
          ? "This also deletes their login accounts and may remove related listings/orders."
          : `This applies to ${rows.length} reseller${rows.length > 1 ? "s" : ""}.`,
      detail: `${rows.length} selected`,
      confirmText: action === "delete" ? "Delete" : "Apply",
    });
    if (!ok) return;

    setBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const r of rows) {
      try {
        if (action === "activate" || action === "suspend") {
          const status: Status = action === "activate" ? "active" : "suspended";
          const patch: { status: Status; approved_at?: string } = { status };
          if (status === "active" && !r.approved_at) patch.approved_at = new Date().toISOString();
          const { error } = await supabase.from("resellers").update(patch).eq("id", r.id);
          if (error) throw new Error(error.message);
        } else if (action === "verify_email") {
          await confirmEmailFn({ data: { userId: r.user_id } });
        } else if (action === "verify_phone" || action === "clear_phone") {
          const { error } = await supabase.rpc("admin_set_phone_verified", {
            _user_id: r.user_id,
            _verified: action === "verify_phone",
          });
          if (error) throw new Error(error.message);
        } else if (action === "delete") {
          const { error } = await supabase.from("resellers").delete().eq("id", r.id);
          if (error) throw new Error(error.message);
          try {
            await deleteAuthUserFn({ data: { userId: r.user_id } });
          } catch {
            /* reseller row already gone */
          }
        }
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    setSelected({});
    if (done) toast.success(`${done} reseller${done > 1 ? "s" : ""} updated`);
    if (failed) toast.error(`${failed} failed`);
    await load();
    await loadEmailStatus();
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




      {/* One merged filter set: status + deposit share a single active selection */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterButtonRow
          active={depositFilter !== "all" ? `deposit:${depositFilter}` : `status:${filter}`}
          options={[
            ...FILTERS.map((f) => ({
              value: `status:${f}`,
              label: f === "all" ? "All" : FILTER_LABELS[f],
              count: counts[f],
            })),
            ...DEPOSIT_FILTERS.filter((f) => f !== "all").map((f) => ({
              value: `deposit:${f}`,
              label: DEPOSIT_FILTER_LABELS[f],
              count: depositCounts[f],
            })),
          ]}
          onSelect={(v) => {
            const [kind, value] = v.split(":");
            if (kind === "deposit") {
              setDepositFilter(value as DepositFilter);
              setFilter("all");
            } else {
              setFilter(value as Filter);
              setDepositFilter("all");
            }
            setPage(1);
          }}
        />
      </div>



      <DataToolbar
        search={query}
        onSearch={(v) => {
          setQuery(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, code, phone, email…"
        middle={
          !canViewAll ? null : (
          <SearchableFilterMenu
            label="Agent"
            activeLabel={
              agentFilter === ""
                ? "All agents"
                : agentFilter === "none"
                  ? "No agent assigned"
                  : agents.find((a) => a.id === agentFilter)?.display_name ?? "All agents"
            }
            options={[
              { value: "", label: "All agents", active: agentFilter === "" },
              { value: "none", label: "No agent assigned", active: agentFilter === "none" },
              ...agents.map((a) => ({
                value: a.id,
                label: a.display_name,
                active: agentFilter === a.id,
              })),
            ]}
            onSelect={(v) => {
              setAgentFilter(v);
              setPage(1);
            }}
            searchPlaceholder="Search agent…"
          />
          )
        }
        perPage={perPage}
        onPerPage={(n) => {
          setPerPage(n);
          setPage(1);
        }}
        right={
          depositDueTotal > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Total due ৳{depositDueTotal.toLocaleString()}
            </span>
          ) : null
        }
      />



      {!loading && filtered.length > 0 && (
        <BulkBar
          total={filtered.length}
          selectedIds={selectedIds}
          onSelectAll={(on) => setSelected(on ? Object.fromEntries(filtered.map((r) => [r.id, true])) : {})}
          onClear={() => setSelected({})}
          busy={bulkBusy}
          can={can}
          onAction={runBulk}
          agents={agents}
          onAssignAgent={bulkAssignAgent}

        />
      )}


      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here" description="No resellers match this filter." />
      ) : (
        <div className="space-y-3">
          {usePaginated(filtered, page, perPage).map((r) => {
            const s = summaries[r.id];
            const em = emailStatus[r.user_id];
            const vf = verifyFor(r);
            const emailVerified = vf.emailVerified;
            const phone = (r.contact_phone ?? "").trim();
            const waPhone = phone.replace(/[^0-9]/g, "").replace(/^0/, "880");
            return (
              <div key={r.id} className="surface-card p-4 shadow-sm transition hover:shadow-md">
                <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[r.id])}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                    }
                    aria-label={`Select ${r.business_name}`}
                    className="mt-3 h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  <ResellerAvatar url={r.avatar_url} name={r.business_name} size={40} />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{r.business_name}</span>
                      <StatusBadge status={r.status} />
                      <VerifyBadges {...vf} />
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5">
                        <IdCard className="h-3 w-3 text-primary" />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">ID</span>
                        <span className="font-mono text-[11px] font-bold tracking-wider text-primary">{r.code}</span>
                        <button
                          type="button"
                          title="Copy reseller ID"
                          onClick={() => {
                            navigator.clipboard.writeText(r.code);
                            toast.success("Reseller ID copied");
                          }}
                          className="text-muted-foreground transition hover:text-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </span>
                      {phone ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-[11px] font-medium">{phone}</span>
                          <button
                            type="button"
                            title="Copy phone"
                            onClick={() => {
                              navigator.clipboard.writeText(phone);
                              toast.success("Phone copied");
                            }}
                            className="text-muted-foreground transition hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <a href={`tel:${phone}`} title="Call" className="text-muted-foreground transition hover:text-primary">
                            <PhoneCall className="h-3 w-3" />
                          </a>
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            title="WhatsApp"
                            className="text-muted-foreground transition hover:text-success"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </a>
                        </span>
                      ) : (
                        <span className="rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground">
                          no phone
                        </span>
                      )}
                      {r.notes ? (
                        <button
                          type="button"
                          onClick={() => setNoteFor(r)}
                          title={`${r.notes}${r.notes_by ? `\n— ${noteAuthors[r.notes_by] ?? "Staff"}` : ""}`}
                          className="inline-flex max-w-[260px] items-center gap-1 rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-warning transition hover:bg-warning/25"
                        >
                          <StickyNote className="h-3 w-3 shrink-0" />
                          <span className="truncate text-[11px] font-medium">{r.notes}</span>
                          {r.notes_by && (
                            <span className="shrink-0 text-[10px] opacity-80">
                              · {noteAuthors[r.notes_by] ?? "Staff"}
                            </span>
                          )}
                        </button>
                      ) : can("resellers.edit") ? (
                        <button
                          type="button"
                          onClick={() => setNoteFor(r)}
                          title="Add internal note"
                          className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
                        >
                          <StickyNote className="h-3 w-3" /> Add note
                        </button>
                      ) : null}
                      {r.agent_id && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5"
                          title="Assigned agent"
                        >
                          <UserCircle className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-medium text-primary">
                            {agents.find((a) => a.id === r.agent_id)?.display_name ?? "Unknown"}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      to="/admin/transactions"
                      search={{ reseller: r.id } as never}
                      title="Transaction report"
                      aria-label={`Transaction report for ${r.business_name}`}
                      className="grid h-8 w-8 place-items-center rounded-md border transition hover:bg-muted"
                    >
                      <Receipt className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/admin/orders"
                      search={{ reseller: r.id, tab: "all" } as never}
                      title="Order list"
                      aria-label={`Orders for ${r.business_name}`}
                      className="grid h-8 w-8 place-items-center rounded-md border transition hover:bg-muted"
                    >
                      <PackageSearch className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      title="View profile"
                      onClick={() => setProfileFor(r)}
                      className="grid h-8 w-8 place-items-center rounded-md border transition hover:bg-muted"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="grid h-8 w-8 shrink-0 place-items-center rounded-md border hover:bg-muted">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>{r.business_name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {can("resellers.edit") && resellerStatusActions(r.status, autoApprove).map((a) => (
                        <DropdownMenuItem
                          key={a.status}
                          onClick={() => setStatus(r, a.status)}
                          className={a.tone === "danger" ? "text-destructive focus:text-destructive" : ""}
                        >
                          {a.status === "active" ? (
                            <Play className="mr-2 h-4 w-4" />
                          ) : a.status === "rejected" ? (
                            <X className="mr-2 h-4 w-4" />
                          ) : a.status === "suspended" ? (
                            <ShieldOff className="mr-2 h-4 w-4" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          {a.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />

                      {!emailVerified && can("resellers.verify") && (
                        <DropdownMenuItem onClick={() => confirmEmail(r)}>
                          <MailCheck className="mr-2 h-4 w-4" /> Confirm email
                        </DropdownMenuItem>
                      )}
                      {can("resellers.verify") && (
                      <DropdownMenuItem onClick={() => void setPhoneVerified(r, !vf.phoneVerified)}>
                        {vf.phoneVerified ? (
                          <>
                            <SmartphoneNfc className="mr-2 h-4 w-4" /> Clear mobile verification
                          </>
                        ) : (
                          <>
                            <SmartphoneNfc className="mr-2 h-4 w-4" /> Mark mobile verified
                          </>
                        )}
                      </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setProfileFor(r)}>
                        <UserCircle className="mr-2 h-4 w-4" /> View profile
                      </DropdownMenuItem>
                      {can("resellers.edit") && (
                      <DropdownMenuItem onClick={() => setEditing(r)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit details
                      </DropdownMenuItem>
                      )}
                      {can("resellers.deposit") && (
                      <DropdownMenuItem onClick={() => setDepositFor(r)}>
                        <Wallet className="mr-2 h-4 w-4" /> Deposit & freeze
                      </DropdownMenuItem>
                      )}
                      {can("resellers.password") && (
                      <DropdownMenuItem onClick={() => setResetFor(r)}>
                        <KeyRound className="mr-2 h-4 w-4" /> Reset password
                      </DropdownMenuItem>
                      )}
                      {can("resellers.impersonate") && (
                      <DropdownMenuItem onClick={() => void loginAsReseller(r)}>
                        <LogIn className="mr-2 h-4 w-4" /> Login as reseller
                      </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => copyStoreLink(r)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy store link
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={`/s/${r.code}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Visit storefront
                        </a>
                      </DropdownMenuItem>
                      {can("resellers.delete") && (<><DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => remove(r)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete reseller
                      </DropdownMenuItem></>)}
                    </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
          agents={agents}
          email={emailStatus[editing.user_id]}
          verify={verifyFor(editing)}
          onSetPhoneVerified={(v) => setPhoneVerified(editing, v)}
          others={items.filter((i) => i.id !== editing.id && i.status === "active")}
          onClose={() => setEditing(null)}
          onSaved={() => {
            const id = editing.id;
            setEditing(null);
            refreshOne(id);
          }}
        />
      )}

      {profileFor && (
        <ProfileModal
          reseller={profileFor}
          summary={summaries[profileFor.id] ?? null}
          orders={orderCounts[profileFor.id]}
          email={emailStatus[profileFor.user_id]}
          verify={verifyFor(profileFor)}
          agentName={agents.find((a) => a.id === profileFor.agent_id)?.display_name ?? null}
          leaderName={
            profileFor.leader_id
              ? (() => {
                  const l = items.find((i) => i.id === profileFor.leader_id);
                  return l ? `${l.business_name} (#${l.code})` : "Leader linked";
                })()
              : null
          }
          noteAuthorName={profileFor.notes_by ? (noteAuthors[profileFor.notes_by] ?? "Staff") : null}
          onClose={() => setProfileFor(null)}
        />
      )}

      {noteFor && (
        <NoteModal
          reseller={noteFor}
          authorName={noteFor.notes_by ? (noteAuthors[noteFor.notes_by] ?? "Staff") : null}
          canEdit={can("resellers.edit")}
          onClose={() => setNoteFor(null)}
          onSaved={() => {
            const id = noteFor.id;
            setNoteFor(null);
            refreshOne(id);
          }}
        />
      )}


      {resetFor && (
        <PasswordResetModal
          label={resetFor.business_name}
          onClose={() => setResetFor(null)}
          onReset={(pw) => applyPasswordReset(resetFor, pw)}
        />
      )}

      {depositFor && (
        <DepositModal
          reseller={depositFor}
          onClose={() => setDepositFor(null)}
          onSaved={() => {
            const id = depositFor.id;
            setDepositFor(null);
            refreshOne(id, { metrics: true });
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
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${resellerStatusClass(status)}`}>
      {resellerStatusLabel(status)}
    </span>
  );
}


function ReadOnlyBit({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"truncate text-xs font-medium capitalize " + (mono ? "font-mono uppercase" : "")} title={value}>
        {value}
      </div>
    </div>
  );
}

function EditModal({
  reseller,
  agents,
  others,
  email,
  verify,
  onSetPhoneVerified,
  onClose,
  onSaved,
}: {
  reseller: Reseller;
  email?: { email: string | null; verified: boolean };
  verify?: VerifyFlags;
  agents: Array<{ id: string; display_name: string }>;
  others: Reseller[];
  onSetPhoneVerified: (verified: boolean) => Promise<boolean>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [businessName, setBusinessName] = useState(reseller.business_name);
  const [code, setCode] = useState(reseller.code);
  const [phone, setPhone] = useState(reseller.contact_phone ?? "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(verify?.phoneVerified));
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [address, setAddress] = useState(reseller.address ?? "");
  const [commission, setCommission] = useState(String(reseller.commission_rate));
  const [leaderId, setLeaderId] = useState(reseller.leader_id ?? "");
  const [agentId, setAgentId] = useState(reseller.agent_id ?? "");
  const [nid, setNid] = useState(reseller.nid_number ?? "");
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
        nid_number: nid || null,
        commission_rate: Number(commission),
        leader_id: leaderId || null,
        agent_id: agentId || null,
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
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
          <ReadOnlyBit label="Reseller ID" value={reseller.code} mono />
          <ReadOnlyBit label="Login email" value={email?.email ?? "—"} />
          <ReadOnlyBit
            label="Status"
            value={resellerStatusLabel(reseller.status)}
          />
          <ReadOnlyBit
            label="Joined"
            value={new Date(reseller.created_at).toLocaleDateString(undefined, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
          <ReadOnlyBit
            label="Security deposit"
            value={
              reseller.deposit_required && Number(reseller.deposit_required_amount) > 0
                ? `৳${Number(reseller.deposit_required_amount).toLocaleString()}`
                : "Not required"
            }
          />
          <ReadOnlyBit label="Frozen" value={`৳${Number(reseller.frozen_amount ?? 0).toLocaleString()}`} />
          <ReadOnlyBit label="Approved" value={reseller.approved_at ? new Date(reseller.approved_at).toLocaleDateString() : "—"} />
        </div>
        {verify && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">Verification</div>
            <VerifyBadges {...verify} phoneVerified={phoneVerified} />
            <button
              type="button"
              disabled={phoneBusy}
              onClick={async () => {
                setPhoneBusy(true);
                const next = !phoneVerified;
                const ok = await onSetPhoneVerified(next);
                if (ok) setPhoneVerified(next);
                setPhoneBusy(false);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-60"
            >
              <SmartphoneNfc className="h-3.5 w-3.5" />
              {phoneVerified ? "Clear mobile verification" : "Mark mobile verified"}
            </button>
          </div>
        )}
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
          <label className="mb-1 block text-xs font-medium">Commission agent (optional)</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={cls}>
            <option value="">— None —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            The agent follows up with this reseller and sees their orders in the agent report.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={cls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">NID number</label>
            <input value={nid} onChange={(e) => setNid(e.target.value)} className={cls} />
          </div>
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

  const balance = rows.reduce((n, r) => n + Number(r.amount), 0);
  const due = required ? Math.max(Number(requiredAmount || 0) - balance, 0) : 0;

  const cls =
    "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  async function loadRows() {
    const { data, error } = await supabase
      .from("reseller_deposits")
      .select("id,amount,method,reference,note,created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as DepositRow[]);
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
    toast.success("Deposit settings saved");
    onSaved();
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt) return toast.error("Enter amount (use − for adjustment)");
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
    toast.success("Ledger entry added");
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
              If a deposit is due the reseller cannot confirm orders. Frozen amount cannot be withdrawn.
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
              Enable deposit trigger
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Required deposit (৳)</label>
                <input
                  type="number"
                  min={0}
                  value={requiredAmount}
                  onChange={(e) => setRequiredAmount(e.target.value)}
                  className={cls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Freeze amount (৳)</label>
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
                Save settings
              </button>
            </div>
          </div>

          <form onSubmit={addEntry} className="space-y-3 rounded-md border p-3">
            <div className="text-xs font-semibold">New entry</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Amount (৳) — use − for refund</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Method</label>
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
                <label className="mb-1 block text-xs font-medium">Reference / TrxID</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} className={cls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Note</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={cls} />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add entry
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="text-xs font-semibold">Deposit transactions</div>
            <DepositLedger compact resellerId={reseller.id} onChanged={loadRows} />
          </div>

        </div>
      </div>
    </div>
  );
}

function ProfileModal({
  reseller,
  summary,
  orders,
  email,
  verify,
  leaderName,
  agentName,
  noteAuthorName,
  onClose,
}: {
  reseller: Reseller;
  summary: Summary | null;
  orders?: number;
  email?: { email: string | null; verified: boolean };
  verify?: VerifyFlags;
  leaderName: string | null;
  agentName: string | null;
  noteAuthorName?: string | null;
  onClose: () => void;
}) {
  const data: ResellerProfileData = {
    ...reseller,
    notes_by_name: noteAuthorName ?? null,
    notes_at: reseller.notes_at ?? null,
    commission_rate: Number(reseller.commission_rate),
    deposit_required_amount: Number(reseller.deposit_required_amount),
    frozen_amount: Number(reseller.frozen_amount),
    leader_name: leaderName,
    agent_name: agentName,
    email: email?.email ?? null,
    email_verified: verify ? verify.emailVerified : email ? email.verified : null,
    phone_verified: verify?.phoneVerified ?? null,
    require_email_verify: verify?.requireEmail,
    require_phone_verify: verify?.requirePhone,
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-b-none sm:max-h-[88dvh] sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="truncate text-base font-semibold">Reseller profile</h3>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-4 sm:px-6">
          <ResellerProfile reseller={data} summary={summary} orders={orders} admin />
        </div>
      </div>
    </div>
  );
}

function NoteModal({
  reseller,
  authorName,
  canEdit,
  onClose,
  onSaved,
}: {
  reseller: Reseller;
  authorName?: string | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(reseller.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("resellers")
      .update({ notes: text.trim() || null })
      .eq("id", reseller.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Internal note saved");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-card flex max-h-[92dvh] w-full max-w-lg flex-col rounded-b-none sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">Internal note</h3>
            <p className="truncate text-xs text-muted-foreground">{reseller.business_name} · #{reseller.code}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {canEdit ? (
            <textarea
              autoFocus
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write an internal note about this reseller…"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          ) : (
            <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
              {reseller.notes || "No note yet."}
            </p>
          )}
          {(authorName || reseller.notes_at) && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserCircle className="h-3.5 w-3.5" />
              Last note by {authorName ?? "Staff"}
              {reseller.notes_at ? ` · ${new Date(reseller.notes_at).toLocaleString()}` : ""}
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex justify-end gap-2 border-t px-4 py-3">
            <button type="button" onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
