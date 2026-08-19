import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CleanupStat = { key: string; rows: number };

function normalise(rows: any): CleanupStat[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({ key: String(r.key), rows: Number(r.rows ?? 0) }));
}

/** How many junk rows are currently sitting in the database. */
export const cleanupStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CleanupStat[]> => {
    const { data, error } = await (context.supabase as any).rpc("cleanup_counts");
    if (error) throw new Response(error.message, { status: 400 });
    return normalise(data);
  });

/** Delete the selected junk data. */
export const runCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { keys: string[] }) => input)
  .handler(async ({ data, context }): Promise<CleanupStat[]> => {
    const { data: rows, error } = await (context.supabase as any).rpc("cleanup_purge", {
      _keys: data.keys ?? [],
    });
    if (error) throw new Response(error.message, { status: 400 });
    return normalise(rows);
  });
