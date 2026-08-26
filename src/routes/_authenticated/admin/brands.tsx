import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import { confirmAction } from "@/lib/confirm";

type EditBrand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
};

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
  const [edit, setEdit] = useState<EditBrand | null>(null);
  const [editLogo, setEditLogo] = useState<UploadedImage[]>([]);

  async function openEdit(b: Brand) {
    const { data, error } = await supabase
      .from("brands")
      .select("id,name,slug,description,logo_url,sort_order,meta_title,meta_description")
      .eq("id", b.id)
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Brand not found");
    setEdit(data as EditBrand);
    setEditLogo(data.logo_url ? [{ url: data.logo_url } as UploadedImage] : []);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    const { error } = await supabase
      .from("brands")
      .update({
        name: edit.name,
        slug: slugify(edit.slug || edit.name),
        description: edit.description || null,
        logo_url: editLogo[0]?.url ?? null,
        sort_order: Number(edit.sort_order ?? 0),
        meta_title: edit.meta_title || null,
        meta_description: edit.meta_description || null,
      })
      .eq("id", edit.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Brand updated");
    setEdit(null);
    load();
  }

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
    if (items.length === 0) {
      load();
    }
  }, []);

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
    if (!(await confirmAction({ title: "Delete brand", description: "This brand will be permanently deleted.", detail: b.name, confirmText: "Delete" }))) return;
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
                onClick={() => openEdit(b)}
                title="Edit brand"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
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

      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg space-y-3 modal-scroll rounded-xl border bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Edit brand</h3>
              <button type="button" onClick={() => setEdit(null)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inp} />
              </Field>
              <Field label="Slug">
                <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} className={inp} />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={inp} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Meta title (SEO)">
                <input value={edit.meta_title ?? ""} onChange={(e) => setEdit({ ...edit, meta_title: e.target.value })} className={inp} />
              </Field>
              <Field label="Sort order">
                <input type="number" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} className={inp} />
              </Field>
            </div>
            <Field label="Meta description (SEO)">
              <textarea rows={2} value={edit.meta_description ?? ""} onChange={(e) => setEdit({ ...edit, meta_description: e.target.value })} className={inp} />
            </Field>
            <Field label="Logo">
              <ImageUploader bucket="branding" folder="brands" value={editLogo} onChange={setEditLogo} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEdit(null)} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
              <button disabled={busy} className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
