import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type L = {
  id: string;
  selling_price: number;
  is_active: boolean;
  products: {
    name: string;
    slug: string;
    buying_price: number;
    packaging_cost: number;
    delivery_inside: number;
    og_image_url: string | null;
  } | null;
};

export const Route = createFileRoute("/_authenticated/reseller/listings")({
  component: ListingsPage,
});

function ListingsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<L[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: r } = await supabase
      .from("resellers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!r) return setLoading(false);
    const { data } = await supabase
      .from("reseller_listings")
      .select(
        "id,selling_price,is_active,products(name,slug,buying_price,packaging_cost,delivery_inside,og_image_url)",
      )
      .eq("reseller_id", r.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as L[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [user]);

  async function remove(id: string) {
    if (!confirm("Remove this listing?")) return;
    await supabase.from("reseller_listings").delete().eq("id", id);
    toast.success("Removed");
    load();
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader title="My listings" description="Apnar store-e joined thakā products." />
      {items.length === 0 ? (
        <EmptyState
          title="No listings yet"
          description="Catalog theke product select kore listing shuru korun."
        />
      ) : (
        <div className="surface-card divide-y">
          {items.map((l) => {
            const cost = (l.products?.buying_price ?? 0) + (l.products?.packaging_cost ?? 0) + (l.products?.delivery_inside ?? 0);
            const profit = l.selling_price - cost;
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="h-14 w-14 overflow-hidden rounded-md border bg-muted">
                  {l.products?.og_image_url && (
                    <img src={l.products.og_image_url} className="h-full w-full object-cover" alt="" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.products?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Sell ৳{l.selling_price} · Cost ৳{cost} ·{" "}
                    <span className="text-success">Profit ৳{profit}</span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    l.is_active ? "bg-success/15 text-success-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {l.is_active ? "Live" : "Paused"}
                </span>
                <button
                  onClick={() => remove(l.id)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
