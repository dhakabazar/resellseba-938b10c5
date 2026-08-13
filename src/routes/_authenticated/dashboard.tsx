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
    if (loading || !user || done.current) return;
    
    const isSuperAdmin = roles.includes("super_admin");
    const isStaff = roles.includes("staff");
    const isReseller = roles.includes("reseller") || roles.includes("leader");

    done.current = true;
    if (isSuperAdmin || isStaff) {
      // Staff without any permission gets a clear "no access" screen inside the
      // admin layout — never the reseller application form.
      nav({ to: "/admin", replace: true });
    } else if (isReseller) {
      nav({ to: "/reseller", replace: true });
    } else {
      nav({ to: "/onboarding", replace: true });
    }
  }, [roles, permissions, loading, user, nav]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
