import { ResellerAvatar } from "@/components/reseller-avatar";
import { Copy, ExternalLink, Phone, Mail, MapPin, IdCard, Lock, ShieldCheck, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export type ResellerProfileData = {
  id: string;
  code: string;
  business_name: string;
  status: string;
  contact_phone: string | null;
  address: string | null;
  nid_number?: string | null;
  commission_rate: number;
  leader_name?: string | null;
  agent_name?: string | null;
  notes?: string | null;
  created_at: string;
  approved_at: string | null;
  payout_method: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_bank_name: string | null;
  payout_branch: string | null;
  payout_routing: string | null;
  deposit_required: boolean;
  deposit_required_amount: number;
  frozen_amount: number;
  avatar_url?: string | null;
  email?: string | null;
  email_verified?: boolean | null;
};

export type ResellerProfileSummary = {
  delivered_profit: number;
  pending_payout: number;
  paid_out: number;
  available: number;
  deposit_balance: number;
  frozen_amount: number;
} | null;

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

function money(v: number | undefined | null) {
  return v == null ? "—" : `৳${Number(v).toLocaleString()}`;
}

function date(v: string | null) {
  return v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function Row({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right text-sm font-medium break-words">
        {value}
        {action}
      </span>
    </div>
  );
}

function IconBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-6 w-6 shrink-0 place-items-center rounded border text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  tone,
  to,
  search,
}: {
  label: string;
  value: string;
  tone?: "success" | "muted";
  to?: string;
  search?: Record<string, string>;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        {to && <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />}
      </div>
      <div
        className={
          "text-sm font-semibold tabular-nums " +
          (tone === "success" ? "text-success" : tone === "muted" ? "text-muted-foreground" : "")
        }
      >
        {value}
      </div>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        search={search as never}
        className="group rounded-lg border bg-muted/30 px-3 py-2 transition hover:border-primary/50 hover:bg-primary/5"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border bg-muted/30 px-3 py-2">{body}</div>;
}

export function ResellerProfile({
  reseller: r,
  summary: s,
  orders,
  admin = false,
}: {
  reseller: ResellerProfileData;
  summary?: ResellerProfileSummary;
  orders?: number;
  /** Admin view: finance cards deep-link into filtered admin lists for this reseller. */
  admin?: boolean;
}) {
  const ordersLink = (tab?: string) =>
    admin ? { to: "/admin/orders", search: { reseller: r.id, ...(tab ? { tab } : {}) } } : {};
  const payoutsLink = (status?: string) =>
    admin ? { to: "/admin/payouts", search: { reseller: r.id, ...(status ? { status } : {}) } } : {};
  const earningLink = () => (admin ? { to: "/admin/transactions", search: { reseller: r.id } } : {});
  const storeUrl = typeof window !== "undefined" ? `${window.location.origin}/s/${r.code}` : `/s/${r.code}`;
  const depositDue = r.deposit_required
    ? Math.max(Number(r.deposit_required_amount ?? 0) - (s?.deposit_balance ?? 0), 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="surface-card p-4">
        <div className="flex flex-wrap items-start gap-4">
          <ResellerAvatar url={r.avatar_url} name={r.business_name} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{r.business_name}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                {r.status === "suspended" ? "deactivated" : r.status}
              </span>
              {r.email_verified != null &&
                (r.email_verified ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                    Email verified
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    Email unverified
                  </span>
                ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
                <IdCard className="h-4 w-4 text-primary" />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Reseller ID</span>
                <span className="font-mono text-sm font-bold tracking-wider text-primary">{r.code}</span>
                <IconBtn title="Copy reseller ID" onClick={() => copy(r.code, "Reseller ID")}>
                  <Copy className="h-3 w-3" />
                </IconBtn>
              </div>
              <a
                href={`/s/${r.code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" /> Visit store
              </a>
              <IconBtn title="Copy store link" onClick={() => copy(storeUrl, "Store link")}>
                <Copy className="h-3 w-3" />
              </IconBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Finance snapshot */}
      <div className="surface-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Finance snapshot</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Orders" value={orders == null ? "—" : orders.toLocaleString()} {...ordersLink("all")} />
          <Stat label="Delivered profit" value={money(s?.delivered_profit)} tone="success" {...earningLink()} />
          <Stat label="Withdrawable" value={money(s?.available)} {...payoutsLink()} />
          <Stat label="Paid out" value={money(s?.paid_out)} {...payoutsLink("paid")} />
          <Stat label="Payout pending" value={money(s?.pending_payout)} tone="muted" {...payoutsLink("pending")} />
          <Stat label="Deposit paid" value={money(s?.deposit_balance)} {...payoutsLink()} />
          <Stat label="Deposit due" value={money(depositDue)} tone={depositDue > 0 ? undefined : "muted"} {...payoutsLink()} />
          <Stat label="Frozen" value={money(Number(r.frozen_amount ?? 0))} tone="muted" {...payoutsLink()} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.deposit_required &&
            (depositDue > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" /> Deposit due {money(depositDue)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                <ShieldCheck className="h-3 w-3" /> Deposit complete
              </span>
            ))}
          {Number(r.frozen_amount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> {money(Number(r.frozen_amount))} frozen — not withdrawable
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Account info */}
        <div className="surface-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Account information</h3>
          <Row label="Business name" value={r.business_name} />
          <Row label="Reseller ID" value={<span className="font-mono">{r.code}</span>} />
          <Row
            label="Email"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {r.email ?? "—"}
              </span>
            }
            action={
              r.email ? (
                <IconBtn title="Copy email" onClick={() => copy(r.email!, "Email")}>
                  <Copy className="h-3 w-3" />
                </IconBtn>
              ) : undefined
            }
          />
          <Row
            label="Phone"
            value={
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {r.contact_phone ?? "—"}
              </span>
            }
            action={
              r.contact_phone ? (
                <IconBtn title="Copy phone" onClick={() => copy(r.contact_phone!, "Phone")}>
                  <Copy className="h-3 w-3" />
                </IconBtn>
              ) : undefined
            }
          />
          <Row
            label="Address"
            value={
              <span className="inline-flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {r.address ?? "—"}
              </span>
            }
          />
          {r.nid_number !== undefined && <Row label="NID" value={r.nid_number ?? "—"} />}
          <Row label="Commission rate" value={`${r.commission_rate}%`} />
          {r.leader_name !== undefined && <Row label="Leader" value={r.leader_name ?? "No leader"} />}
          {r.agent_name !== undefined && <Row label="Commission agent" value={r.agent_name ?? "No agent assigned"} />}
          <Row label="Status" value={<span className="capitalize">{r.status === "suspended" ? "deactivated" : r.status}</span>} />
          <Row label="Security deposit" value={r.deposit_required ? `Required ${money(Number(r.deposit_required_amount ?? 0))}` : "Not required"} />
          <Row label="Frozen amount" value={money(Number(r.frozen_amount ?? 0))} />
          <Row
            label="Store link"
            value={<span className="font-mono text-xs break-all">{storeUrl}</span>}
            action={<IconBtn title="Copy store link" onClick={() => copy(storeUrl, "Store link")}><Copy className="h-3 w-3" /></IconBtn>}
          />
          <Row label="Joined" value={date(r.created_at)} />
          <Row label="Approved" value={date(r.approved_at)} />
          {r.notes ? <Row label="Notes" value={r.notes} /> : null}
        </div>

        {/* Payout info */}
        <div className="surface-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Payout details</h3>
          {r.payout_method ? (
            <>
              <Row label="Method" value={<span className="capitalize">{r.payout_method}</span>} />
              <Row
                label="Account number"
                value={r.payout_account_number ?? "—"}
                action={
                  r.payout_account_number ? (
                    <IconBtn
                      title="Copy account number"
                      onClick={() => copy(r.payout_account_number!, "Account number")}
                    >
                      <Copy className="h-3 w-3" />
                    </IconBtn>
                  ) : undefined
                }
              />
              <Row label="Account name" value={r.payout_account_name ?? "—"} />
              {r.payout_method === "bank" && (
                <>
                  <Row label="Bank" value={r.payout_bank_name ?? "—"} />
                  <Row label="Branch" value={r.payout_branch ?? "—"} />
                  <Row label="Routing" value={r.payout_routing ?? "—"} />
                </>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-destructive">
              Payout method not set yet — withdrawals stay blocked until it is added.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
