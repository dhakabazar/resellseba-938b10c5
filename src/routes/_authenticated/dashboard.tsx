import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { roles, loading, user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (roles.includes("super_admin")) nav({ to: "/admin" });
    else if (roles.includes("reseller") || roles.includes("leader"))
      nav({ to: "/reseller" });
    else nav({ to: "/onboarding" });
  }, [roles, loading, user, nav]);

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
