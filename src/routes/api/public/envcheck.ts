import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/envcheck")({
  server: {
    handlers: {
      GET: async () => {
        const keys = Object.keys(process.env ?? {}).filter((k) => k.startsWith("SUPABASE"));
        const svc = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? "";
        let adminProbe = "skipped";
        if (svc) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
            adminProbe = error ? `error: ${error.message}` : "ok";
          } catch (e: any) {
            adminProbe = `throw: ${e?.message}`;
          }
        }
        return Response.json({ keys, svcPrefix: svc.slice(0, 8), adminProbe });
      },
    },
  },
});
