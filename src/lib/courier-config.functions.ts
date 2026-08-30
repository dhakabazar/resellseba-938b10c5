import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getActiveCouriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // Security-definer RPC: staff with shipping/status/edit permission get the
    // active provider names without needing read access to courier credentials.
    const { data } = await supabase.rpc("active_courier_providers");
    return (data ?? []) as string[];
  });
