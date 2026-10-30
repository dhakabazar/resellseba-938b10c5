import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Counts orders per customer phone (only phones with >1 order). RLS scopes resellers to their own orders. */
export function usePhoneCounts(phones: string[]) {
  const key = Array.from(new Set(phones.filter(Boolean))).sort();
  const { data } = useQuery({
    queryKey: ["order-phone-counts", key],
    enabled: key.length > 0,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const map = new Map<string, number>();
      for (let i = 0; i < key.length; i += 500) {
        const { data } = await (supabase.rpc as any)("order_phone_counts", { _phones: key.slice(i, i + 500) });
        for (const r of (data ?? []) as { phone: string; cnt: number }[]) map.set(r.phone, r.cnt);
      }
      return map;
    },
  });
  return data ?? new Map<string, number>();
}

export function DupPhoneBadge({ count }: { count?: number }) {
  if (!count || count < 2) return null;
  return (
    <span
      title={`This customer has ${count} orders`}
      className="inline-flex shrink-0 animate-pulse items-center rounded-full bg-destructive px-1.5 text-[9px] font-bold leading-4 text-destructive-foreground"
    >
      {count}x
    </span>
  );
}
