import { supabase } from "@/integrations/supabase/client";

/**
 * Shared reseller list for admin pickers/labels. One RPC call returns every
 * reseller the caller may see (RLS applies), cached for a few minutes and
 * shared across pages so navigating the panel does not refetch it.
 */
export type ResellerDirEntry = {
  id: string;
  business_name: string;
  code: string;
  contact_phone: string | null;
  avatar_url: string | null;
  status: string | null;
  agent_id: string | null;
};

const TTL_MS = 5 * 60_000;
let cached: { at: number; promise: Promise<ResellerDirEntry[]> } | null = null;

export function getResellerDirectory(force = false): Promise<ResellerDirEntry[]> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.promise;
  const promise = (async () => {
    const { data, error } = await supabase.rpc("reseller_directory" as never);
    if (error) throw error;
    return ((data ?? []) as unknown as ResellerDirEntry[]) ?? [];
  })();
  cached = { at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** Call after creating/renaming/deleting resellers so pickers show fresh names. */
export function invalidateResellerDirectory() {
  cached = null;
}
