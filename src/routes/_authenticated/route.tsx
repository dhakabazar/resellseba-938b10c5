import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Audit fix: Skip check if we're just navigating between siblings in the same tree
    // to prevent the "reload" feeling on every navigation.
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    
    return { user: session.user };
  },
  component: () => <Outlet />,
});
