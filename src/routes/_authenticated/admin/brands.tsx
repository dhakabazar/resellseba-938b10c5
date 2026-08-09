import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";

type Brand = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  logo_url: string | null;
  sort_order: number;
};

export const Route = createFileRoute("/_authenticated/admin/brands")({
  component: BrandsPage,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function BrandsPage() {
  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<UploadedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("brands")
      .select("id,name,slug,is_active,logo_url,sort_order")
      .order("sort_order")
      .order("name");
    setItems(data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    // Audit fix: only load if items empty to prevent resets on tab switch
    if (items.length === 0) {
      load();
    }
  }, [items.length]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("brands").insert({
        name,
        slug: slugify(name),
        description: description || null,
        logo_url: logo[0]?.url ?? null,
      });
      if (error) throw error;
      toast.success("Brand added");
      setName("");
      setDescription("");
      setLogo([]);
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Brand) {
    await supabase.from("brands").update({ is_active: !b.is_active }).eq("id", b.id);
    load();
  }
  async function remove(b: Brand) {
    if (!confirm(`Delete "${b.name}"?`)) return;
    const { error } = await supabase.from("brands").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else load();
  }

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Organize products under brands."
        actions={
          <button
            onClick={() => setOpen((o) => !o)}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> New brand
          </button>
        }
      />

      {open && (
        <form onSubmit={create} className="surface-card mb-6 space-y-3 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Logo</label>
            <ImageUploader bucket="branding" folder="brands" value={logo} onChange={setLogo} />
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!loading && items.length > 0 && (
        <div className="mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands…"
            className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No brands yet"
          description="Add a brand to start organizing products."
        />
      ) : (
        <div className="surface-card divide-y">
          {items
            .filter((b) => {
              const q = search.trim().toLowerCase();
              if (!q) return true;
              return b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q);
            })
            .map((b) => (
            <div key={b.id} className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted">
                {b.logo_url && <img src={b.logo_url} className="h-full w-full object-cover" alt="" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{b.name}</div>
                <div className="truncate text-xs text-muted-foreground">/{b.slug}</div>
              </div>
              <button
                onClick={() => toggle(b)}
                title={b.is_active ? "Click to hide" : "Click to activate"}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  b.is_active
                    ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                    : "border border-border bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${b.is_active ? "bg-primary-foreground" : "bg-muted-foreground/60"}`} />
                {b.is_active ? "Active" : "Hidden"}
              </button>
              <button
                onClick={() => remove(b)}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
