import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Plus, Loader2, Trash2, ChevronRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";

type EditCat = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  meta_title: string | null;
  meta_description: string | null;
};

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<EditCat | null>(null);
  const [editImage, setEditImage] = useState<UploadedImage[]>([]);

  async function openEdit(c: Cat) {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,parent_id,description,image_url,sort_order,meta_title,meta_description")
      .eq("id", c.id)
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Category not found");
    setEdit(data as EditCat);
    setEditImage(data.image_url ? [{ url: data.image_url } as UploadedImage] : []);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    const { error } = await supabase
      .from("categories")
      .update({
        name: edit.name,
        slug: slugify(edit.slug || edit.name),
        parent_id: edit.parent_id || null,
        description: edit.description || null,
        image_url: editImage[0]?.url ?? null,
        sort_order: Number(edit.sort_order ?? 0),
        meta_title: edit.meta_title || null,
        meta_description: edit.meta_description || null,
      })
      .eq("id", edit.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Category updated");
    setEdit(null);
    load();
  }

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
    if (items.length === 0) {
      load();
    }
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
      if (parent) setExpanded((s) => new Set(s).add(parent));
      load();
    }
  }
  async function toggle(c: Cat) {
    const { error } = await supabase.from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  }
  async function remove(c: Cat) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else load();
  }

  const { parents, childrenByParent } = useMemo(() => {
    const parents = items.filter((i) => !i.parent_id);
    const map = new Map<string, Cat[]>();
    for (const c of items) {
      if (c.parent_id) {
        const arr = map.get(c.parent_id) ?? [];
        arr.push(c);
        map.set(c.parent_id, arr);
      }
    }
    return { parents, childrenByParent: map };
  }, [items]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Nested categories supported — pick a parent to create a subcategory."
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
            {parents.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
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

      {!loading && items.length > 0 && (
        <div className="mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        <div className="surface-card divide-y">
          {(() => {
            const q = search.trim().toLowerCase();
            const match = (c: Cat) =>
              !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
            const visibleParents = q
              ? parents.filter(
                  (p) => match(p) || (childrenByParent.get(p.id) ?? []).some(match),
                )
              : parents;
            return visibleParents.map((p) => {
            const allKids = childrenByParent.get(p.id) ?? [];
            const kids = q && !match(p) ? allKids.filter(match) : allKids;
            const isOpen = q ? true : expanded.has(p.id);
            return (
              <div key={p.id}>
                <CategoryRow
                  cat={p}
                  onEdit={() => openEdit(p)}
                  onToggleActive={() => toggle(p)}
                  onDelete={() => remove(p)}
                  onToggleExpand={kids.length ? () => toggleExpand(p.id) : undefined}
                  expanded={isOpen}
                  childCount={kids.length}
                />
                {isOpen && kids.length > 0 && (
                  <div className="divide-y border-t bg-muted/30">
                    {kids.map((c) => (
                      <CategoryRow
                        key={c.id}
                        cat={c}
                        indent
                        onEdit={() => openEdit(c)}
                        onToggleActive={() => toggle(c)}
                        onDelete={() => remove(c)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          });
          })()}
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setEdit(null)}>
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Edit category</h3>
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
              <Field label="Parent">
                <select
                  value={edit.parent_id ?? ""}
                  onChange={(e) => setEdit({ ...edit, parent_id: e.target.value || null })}
                  className={inp}
                >
                  <option value="">— Top level —</option>
                  {parents.filter((p) => p.id !== edit.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order">
                <input type="number" value={edit.sort_order ?? 0} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} className={inp} />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className={inp} />
            </Field>
            <Field label="Meta title (SEO)">
              <input value={edit.meta_title ?? ""} onChange={(e) => setEdit({ ...edit, meta_title: e.target.value })} className={inp} />
            </Field>
            <Field label="Meta description (SEO)">
              <textarea rows={2} value={edit.meta_description ?? ""} onChange={(e) => setEdit({ ...edit, meta_description: e.target.value })} className={inp} />
            </Field>
            <Field label="Image">
              <ImageUploader bucket="branding" folder="categories" value={editImage} onChange={setEditImage} />
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

function CategoryRow({
  cat, indent, onToggleActive, onDelete, onEdit, onToggleExpand, expanded, childCount,
}: {
  cat: Cat;
  indent?: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onToggleExpand?: () => void;
  expanded?: boolean;
  childCount?: number;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 ${indent ? "pl-12" : ""}`}>
      {onToggleExpand ? (
        <button
          onClick={onToggleExpand}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          title={expanded ? "Collapse" : "Expand"}
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
      ) : (
        <span className="w-6" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          {cat.name}
          {childCount ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {childCount}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">/{cat.slug}</div>
      </div>
      <button
        onClick={onToggleActive}
        title={cat.is_active ? "Click to hide" : "Click to activate"}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
          cat.is_active
            ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
            : "border border-border bg-muted text-muted-foreground hover:bg-muted/70"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cat.is_active ? "bg-primary-foreground" : "bg-muted-foreground/60"}`} />
        {cat.is_active ? "Active" : "Hidden"}
      </button>
      <button
        onClick={onEdit}
        title="Edit category"
        className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
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
