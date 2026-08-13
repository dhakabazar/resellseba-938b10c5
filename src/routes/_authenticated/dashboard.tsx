import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { roles, loading, user } = useAuth();
  const nav = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (loading || !user || done.current) return;
    done.current = true;
    if (roles.includes("super_admin") || roles.includes("staff")) nav({ to: "/admin", replace: true });
    else if (roles.includes("reseller") || roles.includes("leader"))
      nav({ to: "/reseller", replace: true });
    else nav({ to: "/onboarding", replace: true });
  }, [roles, loading, user, nav]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
