import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    // If we already have a session in context, skip the network call
    if (context.user) return;

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    
    return { user: session.user };
  },
  component: () => <Outlet />,
});
