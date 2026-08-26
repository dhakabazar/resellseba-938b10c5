import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { useVerification } from "@/lib/use-verification";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { roles, permissions, loading, user, accessError } = useAuth();
  const { required: needsVerify, loading: verifyLoading } = useVerification();
  const nav = useNavigate();
  const done = useRef(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (loading || verifyLoading || !user || done.current) return;

    if (needsVerify) {
      done.current = true;
      nav({ to: "/verify", replace: true });
      return;
    }

    const isSuperAdmin = roles.includes("super_admin");
    const isStaff = roles.includes("staff");
    const isReseller = roles.includes("reseller") || roles.includes("leader");

    if (isSuperAdmin || isStaff) {
      done.current = true;
      // Staff without any permission gets a clear "no access" screen inside the
      // admin layout — never the reseller application form.
      nav({ to: "/admin", replace: true });
      return;
    }
    if (isReseller) {
      done.current = true;
      nav({ to: "/reseller", replace: true });
      return;
    }

    // No roles came back. That is either a genuinely new user OR a failed
    // lookup — sending an existing reseller to "Become a reseller" is the bug
    // we are guarding against. Confirm against the resellers table first.
    done.current = true;
    void (async () => {
      if (!accessError) {
        const { data, error } = await supabase
          .from("resellers")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!error) {
          if (data?.status === "active") {
            nav({ to: "/reseller", replace: true });
          } else {
            nav({ to: "/onboarding", replace: true });
          }
          return;
        }
      }
      // Lookup failed — never guess. Offer a retry instead.
      done.current = false;
      setStuck(true);
    })();
  }, [roles, permissions, loading, user, nav, needsVerify, verifyLoading, accessError]);

  if (stuck) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="surface-card max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold">অ্যাকাউন্ট লোড করা যায়নি</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            নেটওয়ার্ক সমস্যার কারণে আপনার প্যানেল খুঁজে পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-brand mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" /> আবার চেষ্টা করুন
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
