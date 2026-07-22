import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Cat = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  parent_id: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CatsPage,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function CatsPage() {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("id,name,slug,is_active,parent_id")
      .order("name");
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("categories").insert({
      name,
      slug: slugify(name),
      parent_id: parent || null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Category added");
      setName("");
      setParent("");
      load();
    }
  }
  async function remove(c: Cat) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Nested categories supported — parent select korle sub-category hobe."
      />
      <form onSubmit={create} className="surface-card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium">Parent (optional)</label>
          <select
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Top level —</option>
            {items
              .filter((i) => !i.parent_id)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
        </div>
        <button
          disabled={busy}
          className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
      </form>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No categories yet" description="Add korun product-e assign korte." />
      ) : (
        <div className="surface-card divide-y">
          {items.map((c) => {
            const parent = items.find((i) => i.id === c.parent_id);
            return (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {parent && (
                      <span className="text-muted-foreground">{parent.name} / </span>
                    )}
                    {c.name}
                  </div>
                  <div className="text-xs text-muted-foreground">/{c.slug}</div>
                </div>
                <button
                  onClick={() => remove(c)}
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
