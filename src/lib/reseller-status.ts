/**
 * One source of truth for reseller account status — label, colour and the
 * actions an admin may take. Used by the reseller list, view/edit modals and
 * the reseller-side gate so every surface says the same thing.
 */
export type ResellerStatus = "pending" | "active" | "suspended" | "rejected";

export const RESELLER_STATUS_LABEL: Record<ResellerStatus, string> = {
  pending: "Pending approval",
  active: "Active",
  suspended: "Inactive",
  rejected: "Rejected",
};

export const RESELLER_STATUS_CLASS: Record<ResellerStatus, string> = {
  active: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  suspended: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-destructive/15 text-destructive",
};

export function resellerStatusLabel(status: string | null | undefined): string {
  return RESELLER_STATUS_LABEL[(status ?? "") as ResellerStatus] ?? "Unknown";
}

export function resellerStatusClass(status: string | null | undefined): string {
  return RESELLER_STATUS_CLASS[(status ?? "") as ResellerStatus] ?? "bg-muted text-muted-foreground";
}

/** Panel access is granted only while the account is active. */
export function canAccessResellerPanel(status: string | null | undefined): boolean {
  return status === "active";
}

export type ResellerStatusAction = {
  status: ResellerStatus;
  label: string;
  tone?: "danger";
};

/**
 * Status transitions offered in the 3-dot menu. `autoApprove` only changes the
 * wording of the approve action — an admin can always deactivate or reject.
 */
export function resellerStatusActions(
  current: ResellerStatus,
  autoApprove: boolean,
): ResellerStatusAction[] {
  switch (current) {
    case "pending":
      return [
        { status: "active", label: autoApprove ? "Activate now" : "Approve access" },
        { status: "rejected", label: "Reject application", tone: "danger" },
      ];
    case "active":
      return [
        { status: "suspended", label: "Deactivate access", tone: "danger" },
        { status: "rejected", label: "Reject application", tone: "danger" },
      ];
    case "suspended":
      return [
        { status: "active", label: "Reactivate access" },
        { status: "rejected", label: "Reject application", tone: "danger" },
      ];
    case "rejected":
      return [
        { status: "active", label: "Activate access" },
        { status: "pending", label: "Move back to pending" },
      ];
    default:
      return [];
  }
}
