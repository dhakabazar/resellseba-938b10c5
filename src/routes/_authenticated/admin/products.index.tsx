import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2 } from "lucide-react";

type Row = {
  id: string;
  name: string;
  slug: string;
  buying_price: number;
  suggested_price: number;
  min_selling_price: number;
  stock: number;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,slug,buying_price,suggested_price,min_selling_price,stock,is_active")
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Products"
        description="Master catalog. Resellers ei products theke listing banaben."
        actions={
          <Link
            to="/admin/products/new"
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      />

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Prothom product add kore resellers der jonno available korun."
          action={
            <Link
              to="/admin/products/new"
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Add product
            </Link>
          }
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Suggested</th>
                <th className="px-4 py-3">Min sale</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">৳{p.buying_price}</td>
                  <td className="px-4 py-3">৳{p.suggested_price}</td>
                  <td className="px-4 py-3">৳{p.min_selling_price}</td>
                  <td className="px-4 py-3">{p.stock}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.is_active
                          ? "bg-success/15 text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
