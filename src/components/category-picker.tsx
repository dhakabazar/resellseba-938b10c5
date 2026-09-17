import { Check, Star } from "lucide-react";

type Cat = { id: string; name: string };

/**
 * Multi-category picker. `value[0]` is the primary category (used for
 * breadcrumbs / delivery rules); the rest are additional categories.
 */
export function CategoryPicker({
  cats,
  value,
  onChange,
}: {
  cats: Cat[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }
  function makePrimary(id: string) {
    onChange([id, ...value.filter((v) => v !== id)]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-md border p-2">
        {cats.length === 0 && <span className="px-1 text-xs text-muted-foreground">No categories yet.</span>}
        {cats.map((c) => {
          const on = value.includes(c.id);
          const primary = value[0] === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              onDoubleClick={() => makePrimary(c.id)}
              title={on ? "Click to remove · double-click to make primary" : "Click to add"}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              {primary ? <Star className="h-3 w-3 fill-current" /> : on ? <Check className="h-3 w-3" /> : null}
              {c.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Ekadhik category select kora jabe. Prothom ta (★) main category — onno ekta ke main korte double-click korun.
      </p>
    </div>
  );
}
