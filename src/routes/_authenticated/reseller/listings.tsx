import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deliveryLabel } from "@/lib/delivery";
import { useAuth } from "@/lib/use-auth";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { DataToolbar, Pagination, usePaginated, type FilterDef } from "@/components/data-list";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type L = {
  id: string;
  selling_price: number;
  is_active: boolean;
  products: {
    name: string;
    slug: string;
    reseller_price: number;
    packaging_cost: number;
    delivery_inside: number;
    delivery_outside: number;
    delivery_mode: string | null;
    delivery_flat: number | null;
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
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);


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
        "id,selling_price,is_active,products(name,slug,reseller_price,packaging_cost,delivery_inside,delivery_outside,delivery_mode,delivery_flat,og_image_url)",
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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = items.filter((l) => {
      const okQ = !term || (l.products?.name ?? "").toLowerCase().includes(term);
      const okS =
        !status || (status === "active" ? l.is_active : !l.is_active);
      return okQ && okS;
    });
    const profitOf = (l: L) =>
      l.selling_price - ((l.products?.reseller_price ?? 0) + (l.products?.packaging_cost ?? 0));
    out = [...out];
    if (sort === "price_high") out.sort((a, b) => b.selling_price - a.selling_price);
    else if (sort === "price_low") out.sort((a, b) => a.selling_price - b.selling_price);
    else if (sort === "profit_high") out.sort((a, b) => profitOf(b) - profitOf(a));
    else if (sort === "name")
      out.sort((a, b) => (a.products?.name ?? "").localeCompare(b.products?.name ?? ""));
    return out;
  }, [items, q, status, sort]);

  useEffect(() => {
    setPage(1);
  }, [q, status, sort, perPage]);

  const paged = usePaginated(filtered, page, perPage);

  const filters: FilterDef[] = [
    {
      key: "status",
      label: "Status",
      value: status,
      onChange: setStatus,
      options: [
        { value: "active", label: "Live" },
        { value: "paused", label: "Paused" },
      ],
    },
    {
      key: "sort",
      label: "Sort",
      value: sort,
      onChange: setSort,
      options: [
        { value: "newest", label: "Newest first" },
        { value: "name", label: "Name (A-Z)" },
        { value: "price_high", label: "Price high → low" },
        { value: "price_low", label: "Price low → high" },
        { value: "profit_high", label: "Profit high → low" },
      ],
    },
  ];

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div>
      <PageHeader title="My listings" description="Apnar store-e joined thakā products." />

      <DataToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search listings…"
        filters={filters}
        perPage={perPage}
        onPerPage={setPerPage}
        right={
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {items.length} listings
          </span>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No listings"
          description="Catalog theke product select kore listing shuru korun."
        />
      ) : (
        <>
        <div className="surface-card divide-y">
          {paged.map((l) => {

            const cost = (l.products?.reseller_price ?? 0) + (l.products?.packaging_cost ?? 0);
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
                    Sell ৳{l.selling_price} · Cost ৳{cost} (product + packaging) · Delivery:{" "}
                    {l.products ? deliveryLabel(l.products) : "—"} ·{" "}
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
        <Pagination page={page} perPage={perPage} total={filtered.length} onPage={setPage} />
        </>
      )}
    </div>
  );
}
