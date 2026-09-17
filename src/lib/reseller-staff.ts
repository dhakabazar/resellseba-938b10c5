/**
 * Reseller staff — sub-accounts a reseller creates for their own panel.
 *
 * Permissions are intentionally simple: one key per reseller menu entry.
 * The owner account always has everything.
 */
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getPanelBootstrapPayload } from "@/lib/panel-bootstrap";

export type ResellerStaffRow = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  permissions: string[];
  active: boolean;
  created_at: string;
};

/** Menu-level permission keys, grouped exactly like the reseller sidebar. */
export const RESELLER_MENU_PERMISSIONS: { group: string; items: { key: string; label: string }[] }[] = [
  { group: "Overview", items: [{ key: "dashboard", label: "Dashboard" }] },
  {
    group: "Products",
    items: [
      { key: "catalog", label: "Catalog" },
      { key: "listings", label: "My listings" },
    ],
  },
  {
    group: "Sales",
    items: [
      { key: "orders", label: "Orders" },
      { key: "customers", label: "Customers" },
    ],
  },
  {
    group: "Finance",
    items: [
      { key: "transactions", label: "Transactions" },
      { key: "payouts", label: "Payouts" },
      { key: "commissions", label: "Leader commissions" },
    ],
  },
  { group: "Growth", items: [{ key: "marketing", label: "Marketing" }] },
  {
    group: "Store",
    items: [
      { key: "settings", label: "General settings" },
      { key: "payments", label: "Payment methods" },
      { key: "theme", label: "Theme" },
      { key: "menus", label: "Header menu" },
      { key: "domain", label: "Domain" },
      { key: "visitors", label: "Visitors" },
    ],
  },
  {
    group: "Account",
    items: [
      { key: "subscription", label: "My package" },
      { key: "profile", label: "My profile" },
      { key: "support", label: "Support" },
    ],
  },
];

export const ALL_RESELLER_PERMISSIONS = RESELLER_MENU_PERMISSIONS.flatMap((g) => g.items.map((i) => i.key));

/** Route path → permission key. Staff pages and the owner-only staff page. */
export const RESELLER_ROUTE_PERMISSION: Record<string, string> = {
  "/reseller": "dashboard",
  "/reseller/catalog": "catalog",
  "/reseller/listings": "listings",
  "/reseller/orders": "orders",
  "/reseller/rider-followup": "orders",
  "/reseller/customers": "customers",
  "/reseller/transactions": "transactions",
  "/reseller/payouts": "payouts",
  "/reseller/commissions": "commissions",
  "/reseller/marketing": "marketing",
  "/reseller/settings": "settings",
  "/reseller/payments": "payments",
  "/reseller/theme": "theme",
  "/reseller/menus": "menus",
  "/reseller/domain": "domain",
  "/reseller/visitors": "visitors",
  "/reseller/subscription": "subscription",
  "/reseller/profile": "profile",
  "/reseller/support": "support",
};

export type ResellerStaffMembership = {
  id: string;
  reseller_id: string;
  full_name: string | null;
  permissions: string[];
  active: boolean;
};

/**
 * Access state for the signed-in reseller-side user.
 * `owner` = the reseller account itself (full access).
 */
export function useResellerAccess() {
  const { user, loading } = useAuth();
  const staff = (getPanelBootstrapPayload() as { reseller_staff?: ResellerStaffMembership | null } | null)
    ?.reseller_staff ?? null;
  const isStaff = Boolean(staff);
  const permissions = isStaff ? (staff?.permissions ?? []) : ALL_RESELLER_PERMISSIONS;
  return {
    loading,
    user,
    isOwner: !isStaff,
    isStaff,
    staff,
    permissions,
    can: (key?: string) => (!key ? true : !isStaff || permissions.includes(key)),
  };
}

export async function listResellerStaff(): Promise<ResellerStaffRow[]> {
  const { data, error } = await supabase.rpc("reseller_staff_list");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    email: r.email ?? null,
    full_name: r.full_name ?? null,
    permissions: (r.permissions ?? []) as string[],
    active: !!r.active,
    created_at: r.created_at,
  }));
}

export async function createResellerStaff(input: {
  email: string;
  password: string;
  fullName: string;
  permissions: string[];
}) {
  const { error } = await supabase.rpc("reseller_staff_create", {
    _email: input.email,
    _password: input.password,
    _full_name: input.fullName,
    _permissions: input.permissions,
  });
  if (error) throw new Error(error.message);
}

export async function updateResellerStaff(input: {
  id: string;
  fullName?: string | null;
  permissions?: string[] | null;
  active?: boolean | null;
  password?: string | null;
}) {
  const { error } = await supabase.rpc("reseller_staff_update", {
    _id: input.id,
    _full_name: input.fullName ?? null,
    _permissions: input.permissions ?? null,
    _active: input.active ?? null,
    _password: input.password ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function deleteResellerStaff(id: string) {
  const { error } = await supabase.rpc("reseller_staff_delete", { _id: id });
  if (error) throw new Error(error.message);
}
