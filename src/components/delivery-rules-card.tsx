import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DELIVERY_AREAS,
  areaLabel,
  emptyDeliveryRule,
  type DeliveryArea,
  type DeliveryMode,
  type DeliveryRule,
  type DeliverySettings,
} from "@/lib/delivery";
import { ListFilter, Plus, Trash2, X, ChevronDown, GripVertical, ArrowUp, ArrowDown } from "lucide-react";

type Option = { id: string; label: string };

const MODES: { value: DeliveryMode; label: string }[] = [
  { value: "area", label: "Area-wise" },
  { value: "flat", label: "Flat" },
  { value: "free", label: "Free" },
  { value: "custom", label: "Custom" },
];

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Custom delivery rules — target one or many products, brands or categories.
 * Priority: product's own delivery setting > first matching rule > global rule.
 */
export function DeliveryRulesCard({
  value,
  onChange,
}: {
  value: DeliverySettings;
  onChange: (v: DeliverySettings) => void;
}) {
  const [products, setProducts] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);

  useEffect(() => {
    (async () => {
      const [p, b, c] = await Promise.all([
        supabase.from("products").select("id,name,product_code").order("name").limit(2000),
        supabase.from("brands").select("id,name").order("name"),
        supabase.from("categories").select("id,name").order("name"),
      ]);
      setProducts(
        (p.data ?? []).map((r: any) => ({ id: r.id, label: r.product_code ? `${r.name} · ${r.product_code}` : r.name })),
      );
      setBrands((b.data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
      setCategories((c.data ?? []).map((r: any) => ({ id: r.id, label: r.name })));
    })();
  }, []);

  const rules = value.rules ?? [];

  function setRules(next: DeliveryRule[]) {
    onChange({ ...value, rules: next });
  }

  function patch(id: string, p: Partial<DeliveryRule>) {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...rules];
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setRules(next);
  }

  return (
    <section className="surface-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <ListFilter className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Custom delivery rules</h2>
            <p className="text-xs text-muted-foreground">
              Set a different delivery charge for selected products, brands or categories. You can create
              multiple rules — they are checked top to bottom and the first match wins.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRules([...rules, emptyDeliveryRule()])}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        >
          <Plus className="h-3.5 w-3.5" /> Add rule
        </button>
      </header>

      <div className="space-y-3 p-4">
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Priority: 1) delivery charge set on the product, 2) these custom rules, 3) the global rule.
        </p>

        {rules.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Kono custom rule nai. “Add rule” diye shuru korun.
          </p>
        )}

        {rules.map((rule, i) => (
          <div key={rule.id} className={`rounded-lg border p-3 ${rule.enabled ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">#{i + 1}</span>
              <input
                value={rule.name}
                onChange={(e) => patch(rule.id, { name: e.target.value })}
                placeholder="Rule name"
                className="min-w-[10rem] flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium outline-none focus:border-primary"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded-md border p-1.5 disabled:opacity-40"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === rules.length - 1}
                  className="rounded-md border p-1.5 disabled:opacity-40"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => patch(rule.id, { enabled: !rule.enabled })}
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${
                    rule.enabled ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {rule.enabled ? "Active" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}
                  className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10"
                  aria-label="Delete rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Charge</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => patch(rule.id, { mode: m.value })}
                      aria-pressed={rule.mode === m.value}
                      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                        rule.mode === m.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {rule.mode === "area" && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DELIVERY_AREAS.map((area) => (
                      <div key={area}>
                        <div className="mb-1 text-[11px] text-muted-foreground">{areaLabel(area, value)}</div>
                        <input
                          type="number"
                          min={0}
                          value={rule.areas[area]}
                          onChange={(e) =>
                            patch(rule.id, {
                              areas: { ...rule.areas, [area]: Number(e.target.value) || 0 } as Record<DeliveryArea, number>,
                            })
                          }
                          className={inp}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {rule.mode === "flat" && (
                  <input
                    type="number"
                    min={0}
                    value={rule.flat}
                    onChange={(e) => patch(rule.id, { flat: Number(e.target.value) || 0 })}
                    className={inp}
                    placeholder="Flat charge"
                  />
                )}
                {rule.mode === "custom" && (
                  <input
                    type="number"
                    min={0}
                    value={rule.custom}
                    onChange={(e) => patch(rule.id, { custom: Number(e.target.value) || 0 })}
                    className={inp}
                    placeholder="Default charge (editable per order)"
                  />
                )}
                {rule.mode === "free" && (
                  <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Ei rule er product gulote free delivery.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Apply on</Label>
                <MultiPicker
                  placeholder="Products search (name / code)"
                  options={products}
                  selected={rule.target.products}
                  onChange={(products) => patch(rule.id, { target: { ...rule.target, products } })}
                />
                <MultiPicker
                  placeholder="Brands"
                  options={brands}
                  selected={rule.target.brands}
                  onChange={(brands) => patch(rule.id, { target: { ...rule.target, brands } })}
                />
                <MultiPicker
                  placeholder="Categories"
                  options={categories}
                  selected={rule.target.categories}
                  onChange={(categories) => patch(rule.id, { target: { ...rule.target, categories } })}
                />
                {!rule.target.products.length && !rule.target.brands.length && !rule.target.categories.length && (
                  <p className="text-[11px] text-amber-600">
                    Nothing selected — this rule will not apply.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>
  );
}

function MultiPicker({
  placeholder,
  options,
  selected,
  onChange,
}: {
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const chosen = useMemo(
    () => selected.map((id) => options.find((o) => o.id === id) ?? { id, label: id.slice(0, 8) }),
    [selected, options],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return options
      .filter((o) => !selected.includes(o.id))
      .filter((o) => (needle ? o.label.toLowerCase().includes(needle) : true))
      .slice(0, 50);
  }, [options, selected, q]);

  return (
    <div ref={box} className="relative">
      <div
        className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5"
        onClick={() => setOpen(true)}
      >
        {chosen.map((o) => (
          <span
            key={o.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            <span className="truncate">{o.label}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(selected.filter((id) => id !== o.id));
              }}
              aria-label={`Remove ${o.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder={chosen.length ? "" : placeholder}
          className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none"
        />
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No match</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange([...selected, o.id]);
                  setQ("");
                }}
                className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
