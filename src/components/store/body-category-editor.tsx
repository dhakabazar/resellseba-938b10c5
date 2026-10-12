import { useState } from "react";
import { ArrowDown, ArrowUp, Layers, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { BodyCategoryItem } from "@/lib/store-body-categories";

export type CategorySource = { id: string; name: string; image_url: string | null };

export function BodyCategoryEditor({ categories, items, onChange }: {
  categories: CategorySource[];
  items: BodyCategoryItem[];
  onChange: (items: BodyCategoryItem[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const available = categories.filter((c) => !items.some((item) => item.id === c.id) && c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const byId = new Map(categories.map((c) => [c.id, c]));
  function move(index: number, offset: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(index + offset, 0, item);
    onChange(next);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-4">
        <h2 className="text-sm font-semibold">Select categories</h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input aria-label="Search categories" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search categories…" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="max-h-[440px] space-y-2 overflow-y-auto">
          {available.map((category) => (
            <label key={category.id} className="flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3">
              <input type="checkbox" className="h-4 w-4 shrink-0" checked={picked.includes(category.id)} onChange={(e) => setPicked((old) => e.target.checked ? [...old, category.id] : old.filter((id) => id !== category.id))} />
              <CategoryImage category={category} />
              <span className="min-w-0 break-words text-sm">{category.name}</span>
            </label>
          ))}
          {!available.length && <p className="py-8 text-center text-sm text-muted-foreground">No more categories</p>}
        </div>
        <Button className="w-full" disabled={!picked.some((id) => available.some((c) => c.id === id))} onClick={() => {
          onChange([...items, ...available.filter((c) => picked.includes(c.id)).map((c) => ({ id: c.id, is_active: true }))]);
          setPicked([]);
        }}><Plus /> Add</Button>
      </section>
      <section className="min-w-0 space-y-4 lg:border-l lg:pl-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Body categories</h2>
          <span className="text-xs text-muted-foreground">{items.filter((item) => item.is_active && byId.has(item.id)).length} active / {items.length} selected</span>
        </div>
        {!items.length && <div className="rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground">No categories selected</div>}
        <div className="space-y-2">
          {items.map((item, index) => {
            const category = byId.get(item.id);
            return <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-md border bg-background p-3">
              <span className="w-5 text-xs text-muted-foreground">{index + 1}</span>
              <CategoryImage category={category} />
              <div className="min-w-0 flex-1 break-words text-sm font-medium">{category?.name ?? "Unavailable category"}</div>
              <div className="ml-auto flex items-center gap-1">
                <Switch aria-label={`${category?.name ?? item.id} active`} checked={item.is_active} onCheckedChange={(is_active) => onChange(items.map((row) => row.id === item.id ? { ...row, is_active } : row))} />
                <Button size="icon" variant="ghost" title="Move up" aria-label={`${category?.name ?? item.id} move up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" title="Move down" aria-label={`${category?.name ?? item.id} move down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" title="Remove" aria-label={`${category?.name ?? item.id} remove`} onClick={() => onChange(items.filter((row) => row.id !== item.id))}><Trash2 /></Button>
              </div>
            </div>;
          })}
        </div>
      </section>
    </div>
  );
}

function CategoryImage({ category }: { category?: CategorySource }) {
  return category?.image_url ? <img src={category.image_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Layers className="h-4 w-4" /></span>;
}
