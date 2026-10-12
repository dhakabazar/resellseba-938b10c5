import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Full product descriptions are heavy HTML, so the store bootstrap omits them and
// product pages fetch the one they show on demand (cached per session).
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function load(id: string) {
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null);
  let p = inflight.get(id);
  if (!p) {
    p = Promise.resolve(supabase.rpc("store_product_description" as never, { _product_id: id } as never)).then(
      ({ data }: any) => {
        const v = (data as string | null) ?? null;
        cache.set(id, v);
        inflight.delete(id);
        return v;
      },
      () => {
        inflight.delete(id);
        return null;
      },
    );
    inflight.set(id, p);
  }
  return p;
}

export function useProductDescription(product: { id?: string; description?: string | null } | null | undefined) {
  const id = product?.id;
  const inline = product?.description ?? null;
  const [desc, setDesc] = useState<string | null>(inline);
  useEffect(() => {
    if (inline) { setDesc(inline); return; }
    if (!id) return;
    let alive = true;
    setDesc(cache.get(id) ?? null);
    void load(id).then((v) => alive && setDesc(v));
    return () => { alive = false; };
  }, [id, inline]);
  return desc;
}
