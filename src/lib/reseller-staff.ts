/**
 * Reseller staff — sub-accounts a reseller creates for their own panel.
 *
 * Permissions correspond cleanly to reseller menus and operations.
 * The owner account always has full access to everything.
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

export type PermissionItem = {
  key: string;
  label: string;
  labelBn: string;
  description: string;
};

export type PermissionGroup = {
  group: string;
  groupBn: string;
  items: PermissionItem[];
};

/** Menu-level & functional permission keys, grouped logically like the reseller sidebar. */
export const RESELLER_MENU_PERMISSIONS: PermissionGroup[] = [
  {
    group: "Overview",
    groupBn: "ড্যাশবোর্ড",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        labelBn: "ড্যাশবোর্ড ওভারভিউ",
        description: "ব্যবসায়িক সামারি ও লাইভ পরিসংখ্যান",
      },
    ],
  },
  {
    group: "Products",
    groupBn: "প্রোডাক্ট ম্যানেজমেন্ট",
    items: [
      {
        key: "catalog",
        label: "Catalog",
        labelBn: "প্রোডাক্ট ক্যাটালগ",
        description: "পাইকারি প্রোডাক্ট দেখা ও নিজের স্টোরে অ্যাড করা",
      },
      {
        key: "listings",
        label: "My listings",
        labelBn: "আমার লিস্টিং",
        description: "স্টোরের পণ্যের বিক্রয়মূল্য ও বিবরণ পরিবর্তন",
      },
    ],
  },
  {
    group: "Sales & Orders",
    groupBn: "সেলস ও অর্ডার হ্যান্ডলিং",
    items: [
      {
        key: "orders",
        label: "Orders List",
        labelBn: "অর্ডার তালিকা",
        description: "সকল অর্ডারের স্ট্যাটাস ও হিস্ট্রি দেখা",
      },
      {
        key: "orders_create",
        label: "Create Order",
        labelBn: "নতুন অর্ডার যুক্তকরণ",
        description: "কাস্টমারের হয়ে প্যানেল থেকে নতুন অর্ডার প্লেস করা",
      },
      {
        key: "orders_edit",
        label: "Edit / Manage Orders",
        labelBn: "অর্ডার এডিট ও হ্যান্ডেল",
        description: "ঠিকানা পরিবর্তন, নোট আপডেট ও অর্ডার কনফার্ম/ক্যান্সেল করা",
      },
      {
        key: "rider_followup",
        label: "Rider Followup",
        labelBn: "রাইডার ডেলিভারি ফলোআপ",
        description: "কুরিয়ার ও রাইডার ডেলিভারি স্ট্যাটাস চেক",
      },
      {
        key: "customers",
        label: "Customers",
        labelBn: "কাস্টমার তালিকা",
        description: "গ্রাহকদের নাম, ফোন নম্বর ও হিস্ট্রি",
      },
    ],
  },
  {
    group: "Finance",
    groupBn: "আর্থিক লেনদেন",
    items: [
      {
        key: "transactions",
        label: "Transactions",
        labelBn: "লেনদেন হিস্ট্রি",
        description: "ব্যালেন্স স্টেটমেন্ট ও ট্রানজেকশন লগ",
      },
      {
        key: "payouts",
        label: "Payouts",
        labelBn: "উইথড্রয়াল ও পে-আউট",
        description: "প্রফিট উত্তোলন ও পে-আউট রিকোয়েস্ট",
      },
      {
        key: "commissions",
        label: "Leader commissions",
        labelBn: "লিডার কমিশন",
        description: "রেফারেল ও টিম আর্নিং রিপোর্ট",
      },
    ],
  },
  {
    group: "Growth",
    groupBn: "মার্কেটিং ও গ্রোথ",
    items: [
      {
        key: "marketing",
        label: "Marketing & Pixels",
        labelBn: "মার্কেটিং ও ট্র্যাকিং",
        description: "Facebook Pixel, CAPI, TikTok & Google Analytics",
      },
      {
        key: "tutorials",
        label: "Video tutorials",
        labelBn: "ভিডিও টিউটোরিয়াল",
        description: "গাইডলাইন ও ট্রেনিং ভিডিও",
      },
    ],
  },
  {
    group: "Store",
    groupBn: "স্টোর ডিজাইন ও সেটিংস",
    items: [
      {
        key: "settings",
        label: "General settings",
        labelBn: "জেনারেল সেটিংস",
        description: "স্টোরের নাম, লোগো, হেল্পলাইন ও ডেলিভারি চার্জ",
      },
      {
        key: "payments",
        label: "Payment methods",
        labelBn: "পেমেন্ট মেথড",
        description: "ম্যানুয়াল বিকাশ/নগদ ও অনলাইন গেটওয়ে",
      },
      {
        key: "theme",
        label: "Theme",
        labelBn: "থিম ডিজাইন",
        description: "থিম সিলেক্ট ও কালার কাস্টমাইজেশন",
      },
      {
        key: "menus",
        label: "Header menu",
        labelBn: "মেনু নেভিগেশন",
        description: "স্টোর হেডার ও ক্যাটাগরি মেনু সাজানো",
      },
      {
        key: "domain",
        label: "Domain",
        labelBn: "কাস্টম ডোমেইন",
        description: "নিজের ডোমেইন যুক্ত ও DNS কানেকশন",
      },
      {
        key: "visitors",
        label: "Visitors",
        labelBn: "ভিজিটর অ্যানালিটিক্স",
        description: "লাইভ স্টোর ভিজিটর ট্র্যাকিং",
      },
    ],
  },
  {
    group: "Account",
    groupBn: "অ্যাকাউন্ট ও সহায়তা",
    items: [
      {
        key: "subscription",
        label: "My package",
        labelBn: "সাবস্ক্রিপশন প্যাকেজ",
        description: "মাসিক প্ল্যান ও বিলিং",
      },
      {
        key: "profile",
        label: "My profile",
        labelBn: "প্রোফাইল সেটিংস",
        description: "ব্যক্তিগত তথ্য ও পাসওয়ার্ড",
      },
      {
        key: "support",
        label: "Support",
        labelBn: "হেল্প ও সাপোর্ট",
        description: "হেল্পডেস্ক ও টিকিট সাপোর্ট",
      },
    ],
  },
];

export const ALL_RESELLER_PERMISSIONS = RESELLER_MENU_PERMISSIONS.flatMap((g) => g.items.map((i) => i.key));

/** Route path → permission key. */
export const RESELLER_ROUTE_PERMISSION: Record<string, string> = {
  "/reseller": "dashboard",
  "/reseller/catalog": "catalog",
  "/reseller/listings": "listings",
  "/reseller/orders": "orders",
  "/reseller/rider-followup": "rider_followup",
  "/reseller/customers": "customers",
  "/reseller/transactions": "transactions",
  "/reseller/payouts": "payouts",
  "/reseller/commissions": "commissions",
  "/reseller/marketing": "marketing",
  "/reseller/tutorials": "tutorials",
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

  const can = (key?: string) => {
    if (!key) return true;
    if (!isStaff) return true;

    // Direct permission match
    if (permissions.includes(key)) return true;

    // Order related aliases: if has "orders", allow create/edit/rider by default
    if (key === "orders" && (permissions.includes("orders_create") || permissions.includes("orders_edit"))) {
      return true;
    }
    if (key === "orders_create" && permissions.includes("orders")) {
      return true;
    }
    if (key === "orders_edit" && permissions.includes("orders")) {
      return true;
    }
    if (key === "rider_followup" && permissions.includes("orders")) {
      return true;
    }

    return false;
  };

  return {
    loading,
    user,
    isOwner: !isStaff,
    isStaff,
    staff,
    permissions,
    can,
    canCreateOrder: can("orders_create"),
    canEditOrder: can("orders_edit"),
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
