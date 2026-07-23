import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  name: string;
  slug: string;
  buying_price: number;
  suggested_price: number;
  min_selling_price: number;
  stock: number;
  is_active: boolean;
  og_image_url: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id,name,slug,buying_price,suggested_price,min_selling_price,stock,is_active,og_image_url")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(p: Row) {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }
  async function remove(p: Row) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  const filtered = items.filter((i) =>
    q ? i.name.toLowerCase().includes(q.toLowerCase()) || i.slug.includes(q.toLowerCase()) : true,
  );

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

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or slug…"
          className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
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
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted">
                        {p.og_image_url && (
                          <img src={p.og_image_url} className="h-full w-full object-cover" alt="" />
                        )}
                      </div>
                      <div>
                        <Link
                          to="/admin/products/$id/edit"
                          params={{ id: p.id }}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">/{p.slug}</div>
                      </div>
                    </div>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggle(p)}
                        title={p.is_active ? "Hide" : "Show"}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                      >
                        {p.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <Link
                        to="/admin/products/$id/edit"
                        params={{ id: p.id }}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => remove(p)}
                        title="Delete"
                        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
