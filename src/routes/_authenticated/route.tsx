import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // In SPA mode, we can trust the current session state more aggressively
    // to avoid layout shifts and unnecessary redirects.
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    
    return { user: session.user };
  },
  component: () => <Outlet />,
});
