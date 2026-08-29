import { useMemo } from "react";
import { useAuth } from "@/lib/use-auth";

/**
 * Permission naming is `<domain>.<action>`.
 *
 * A `<domain>.manage` grant is an umbrella: it implies every other action in
 * that domain (view / create / edit / delete / …). The database expands the
 * same way (see `my_permissions()` / `has_permission()`), this helper mirrors
 * it so the UI never shows a control the server would reject.
 */
export function expandPermissions(granted: string[]): Set<string> {
  const out = new Set(granted);
  return out;
}

function domainOf(permission: string) {
  return permission.split(".")[0] ?? permission;
}

export interface PermissionApi {
  /** true when the signed-in user may perform this action. */
  can: (permission: string) => boolean;
  /** true when ANY of the permissions is granted. */
  canAny: (permissions: string[]) => boolean;
  /** true when EVERY permission is granted. */
  canAll: (permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  ready: boolean;
}

/** Single source of truth for "is this action allowed?" in admin UI. */
export function usePermissions(): PermissionApi {
  const { roles, permissions, loading } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return useMemo(() => {
    const set = expandPermissions(permissions);
    const can = (permission: string) => {
      if (isSuperAdmin) return true;
      if (set.has(permission)) return true;
      // umbrella fallback for permission sets fetched before the DB expansion
      return set.has(`${domainOf(permission)}.manage`);
    };
    return {
      can,
      canAny: (list: string[]) => list.some(can),
      canAll: (list: string[]) => list.every(can),
      isSuperAdmin,
      ready: !loading,
    };
  }, [permissions, isSuperAdmin, loading]);
}
