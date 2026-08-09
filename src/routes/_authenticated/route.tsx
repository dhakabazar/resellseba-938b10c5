import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Optimization: Check for existing session in localStorage first if in browser
    // to avoid unnecessary Supabase network calls on every internal navigation.
    if (typeof window !== "undefined") {
      const storageKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (!storageKey || !localStorage.getItem(storageKey)) {
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
