import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { roles, permissions, loading, user } = useAuth();
  const nav = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    console.log("DashboardRouter: State", { roles, permissions, loading, userId: user?.id });
    if (loading || !user || done.current) return;
    
    const isSuperAdmin = roles.includes("super_admin");
    const isStaff = roles.includes("staff");
    const isReseller = roles.includes("reseller") || roles.includes("leader");

    console.log("DashboardRouter: Role check", { isSuperAdmin, isStaff, isReseller });

    if (isSuperAdmin || (isStaff && permissions.length > 0)) {
      console.log("DashboardRouter: Navigating to /admin");
      done.current = true;
      nav({ to: "/admin", replace: true });
    } else if (isReseller) {
      console.log("DashboardRouter: Navigating to /reseller");
      done.current = true;
      nav({ to: "/reseller", replace: true });
    } else if (isStaff && permissions.length === 0) {
      console.log("DashboardRouter: Staff with no perms, to onboarding");
      done.current = true;
      nav({ to: "/onboarding", replace: true });
    } else {
      console.log("DashboardRouter: Fallback to onboarding");
      done.current = true;
      nav({ to: "/onboarding", replace: true });
    }
  }, [roles, permissions, loading, user, nav]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
