import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyReseller } from "@/lib/app-data";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader, type UploadedImage } from "@/components/ImageUploader";
import {
  DEFAULT_THEME_ID,
  getPalette,
  getStoreTheme,
  paletteSwatches,
  STORE_THEMES,
  type StorePalette,
  type StoreThemeId,
} from "@/lib/store-theme";
import { themeContentGroups, type ThemeContentValues } from "@/lib/store-content";

export const Route = createFileRoute("/_authenticated/reseller/theme")({
  component: ThemePage,
});

const inp = "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function ThemePage() {
  const { user } = useAuth();
  const [rid, setRid] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [theme, setTheme] = useState<StoreThemeId>(DEFAULT_THEME_ID);
  const [savedTheme, setSavedTheme] = useState<StoreThemeId>(DEFAULT_THEME_ID);
  const [all, setAll] = useState<Record<string, ThemeContentValues>>({});
  const [openGroup, setOpenGroup] = useState<string>("hero");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const values = all[theme] ?? {};
  const activeTheme = useMemo(() => getStoreTheme(theme), [theme]);
  /** only the active theme's own sections are listed */
  const groups = useMemo(() => themeContentGroups(theme), [theme]);
  const paletteId = typeof values.palette === "string" ? values.palette : null;
  const palette = getPalette(activeTheme, paletteId);

  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (async () => {
      const r = await getMyReseller(uid);
      if (!alive) return;
      if (!r) return setLoading(false);
      setRid(r.id);
      setCode(r.code);

      let activeUrl = `/s/${r.code}`;
      const { data: dRows } = await supabase
        .from("reseller_domains")
        .select("hostname, is_primary, ssl_status")
        .eq("reseller_id", r.id)
        .eq("ssl_status", "active")
        .order("is_primary", { ascending: false })
        .limit(1);
      if (dRows && dRows.length > 0 && dRows[0]?.hostname) {
        activeUrl = `https://${dRows[0].hostname}`;
      }
      setStoreUrl(activeUrl);

      const { data: s } = await supabase
        .from("reseller_settings")
        .select("theme,theme_settings")
        .eq("reseller_id", r.id)
        .maybeSingle();
      if (!alive) return;
      const id = (s?.theme as StoreThemeId) ?? DEFAULT_THEME_ID;
      setTheme(id);
      setSavedTheme(id);
      setAll((s?.theme_settings as Record<string, ThemeContentValues>) ?? {});
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  function setField(key: string, value: string | boolean) {
    setAll((prev) => ({ ...prev, [theme]: { ...(prev[theme] ?? {}), [key]: value } }));
  }

  async function save() {
    if (!rid) return;
    setBusy(true);
    const { error } = await supabase
      .from("reseller_settings")
      .update({ theme, theme_settings: all })
      .eq("reseller_id", rid);
    setBusy(false);
    if (error) return toast.error(error.message);
    setSavedTheme(theme);
    toast.success("Theme saved and published successfully");
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Visual Appearance"
        description="Customize your storefront theme, color palettes, and interactive section content."
        actions={
          <div className="flex flex-wrap gap-2">
            {(storeUrl || code) && (
              <a
                href={storeUrl || `/s/${code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Live store
              </a>
            )}
            <button
              onClick={save}
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & publish
            </button>
          </div>
        }
      />

      {/* 1. Theme Picker */}
      <div className="surface-card space-y-4 p-6 rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">1. Choose theme</h3>
            <p className="text-xs text-muted-foreground">
              Each theme keeps its own content and palette, so switching back never loses your work.
            </p>
          </div>
          {theme !== savedTheme && (
            <span className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-medium text-primary">
              Previewing {activeTheme.name} — not published yet
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STORE_THEMES.map((t) => {
            const active = theme === t.id;
            const savedPaletteId = (all[t.id]?.palette as string) ?? null;
            const p = getPalette(t, savedPaletteId);
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={
                  "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all " +
                  (active ? "border-primary ring-2 ring-primary/30 shadow-sm" : "hover:border-primary/50 hover:shadow-md")
                }
              >
                {active && (
                  <span className="absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
                
                <div className="relative">
                  <ThemeMock palette={p} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold tracking-tight">{t.name}</span>
                    {t.id === savedTheme && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Palette Picker */}
      <div className="surface-card space-y-4 p-6 rounded-xl border">
        <div>
          <h3 className="text-base font-semibold">2. Color palette — {activeTheme.name}</h3>
          <p className="text-xs text-muted-foreground">
            Each palette is a complete, contrast-checked color set (background, text, border, buttons), so the
            design never breaks — every page of your store repaints together.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {activeTheme.palettes.map((p) => {
            const active = palette.id === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setField("palette", p.id)}
                className={
                  "relative overflow-hidden rounded-xl border p-3.5 text-left transition-all " +
                  (active ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-xs" : "hover:border-primary/50 bg-card")
                }
              >
                <PaletteChip palette={p} />
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{p.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{p.dark ? "Dark surfaces" : "Light surfaces"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Full-width Section Content Settings */}
      <div className="space-y-4">
        <div className="px-1">
          <h3 className="text-base font-semibold">3. Content & Section Settings — {activeTheme.name}</h3>
          <p className="text-xs text-muted-foreground">
            Configure each section of your store. Changes take effect on your live store once saved.
          </p>
        </div>

        <div className="space-y-3">
          {groups.map((g) => {
            const open = openGroup === g.id;
            return (
              <div key={g.id} className="surface-card overflow-hidden rounded-xl border transition-all">
                <button
                  type="button"
                  onClick={() => setOpenGroup(open ? "" : g.id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="text-sm font-semibold">{g.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary">
                      {open ? "Collapse" : "Edit section"}
                    </span>
                    {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {open && (
                  <div className="space-y-5 border-t bg-card/40 p-5">
                    {g.id === "usp" ? (
                      <BenefitStripEditor values={values} setField={setField} />
                    ) : g.id === "reviews" ? (
                      <ReviewsEditor values={values} setField={setField} />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                        {g.fields.map((f) => {
                          const raw = values[f.key];
                          if (f.type === "toggle") {
                            const checked = typeof raw === "boolean" ? raw : f.def !== false;
                            return (
                              <div
                                key={f.key}
                                className="col-span-full flex items-center justify-between rounded-lg border bg-muted/20 p-3.5"
                              >
                                <div>
                                  <span className="text-sm font-medium">{f.label}</span>
                                  {f.hint && <p className="text-[11px] text-muted-foreground mt-0.5">{f.hint}</p>}
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={checked}
                                  onClick={() => setField(f.key, !checked)}
                                  className={
                                    "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                                    (checked ? "bg-primary" : "bg-muted")
                                  }
                                >
                                  <span
                                    className={
                                      "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all " +
                                      (checked ? "left-[22px]" : "left-0.5")
                                    }
                                  />
                                </button>
                              </div>
                            );
                          }

                          if (f.type === "image") {
                            const url = typeof raw === "string" ? raw : "";
                            const val: UploadedImage[] = url ? [{ path: "", url, bytes: 0 }] : [];
                            return (
                              <div key={f.key} className="col-span-full space-y-1.5">
                                <label className="block text-xs font-medium">{f.label}</label>
                                <ImageUploader
                                  bucket="branding"
                                  folder={`${rid}/${theme}/${f.key}`}
                                  value={val}
                                  onChange={(v) => setField(f.key, v[0]?.url ?? "")}
                                />
                                {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
                              </div>
                            );
                          }

                          const str = typeof raw === "string" ? raw : "";
                          const ph = typeof f.def === "string" ? f.def : f.placeholder;
                          const isFullWidth = f.type === "textarea" || f.key.includes("headline") || f.key.includes("text");

                          return (
                            <div key={f.key} className={isFullWidth ? "col-span-full space-y-1.5" : "space-y-1.5"}>
                              <label className="block text-xs font-medium">{f.label}</label>
                              {f.type === "textarea" ? (
                                <textarea
                                  rows={3}
                                  value={str}
                                  placeholder={ph}
                                  onChange={(e) => setField(f.key, e.target.value)}
                                  className={inp}
                                />
                              ) : (
                                <input
                                  value={str}
                                  placeholder={ph}
                                  onChange={(e) => setField(f.key, e.target.value)}
                                  className={inp}
                                />
                              )}
                              {f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground pt-2 border-t border-dashed">
                      Leave a field empty to use the theme default. Use {"{store}"} to insert your store name.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating / Sticky Footer Save Bar */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur-md">
        <div className="text-xs text-muted-foreground">
          Active Theme: <span className="font-semibold text-foreground">{activeTheme.name}</span> ({palette.name})
        </div>
        <div className="flex items-center gap-2">
          {(storeUrl || code) && (
            <a
              href={storeUrl || `/s/${code}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live store
            </a>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save & publish
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tiny wireframe mock painted with a palette. */
function ThemeMock({ palette }: { palette: StorePalette }) {
  const { bg, surface, primary, fg } = palette;
  return (
    <div className="h-28 w-full p-3" style={{ background: bg }}>
      <div className="flex items-center justify-between">
        <span className="h-2 w-10 rounded" style={{ background: fg, opacity: 0.7 }} />
        <span className="h-2 w-6 rounded" style={{ background: primary }} />
      </div>
      <div className="mt-2 h-3 w-2/3 rounded" style={{ background: fg, opacity: 0.85 }} />
      <div className="mt-1.5 h-2 w-1/2 rounded" style={{ background: fg, opacity: 0.4 }} />
      <div className="mt-2 flex gap-1.5">
        <span className="h-8 flex-1 rounded" style={{ background: surface }} />
        <span className="h-8 flex-1 rounded" style={{ background: surface }} />
        <span className="h-8 w-8 rounded" style={{ background: primary }} />
      </div>
    </div>
  );
}

/** Palette swatch row plus a text-on-color readability sample. */
function PaletteChip({ palette }: { palette: StorePalette }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: palette.border }}>
      <div className="flex">
        {paletteSwatches(palette).map((c, i) => (
          <span key={i} className="h-8 flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="px-2 py-2" style={{ background: palette.surface, color: palette.fg }}>
        <div className="text-[11px] font-semibold">Aa Product title</div>
        <div className="text-[10px]" style={{ color: palette.muted }}>
          ৳1,250 · in stock
        </div>
      </div>
    </div>
  );
}

/** Structured editor for Benefit Strip where Title and Detail are cleanly paired per item */
function BenefitStripEditor({
  values,
  setField,
}: {
  values: ThemeContentValues;
  setField: (key: string, value: string | boolean) => void;
}) {
  const showRaw = values["usp_show"];
  const checked = typeof showRaw === "boolean" ? showRaw : true;

  const defaults = [
    { num: 1, titlePh: "Cash on Delivery", detailPh: "Pay after you receive" },
    { num: 2, titlePh: "Nationwide delivery", detailPh: "All 64 districts" },
    { num: 3, titlePh: "100% genuine", detailPh: "Verified products only" },
    { num: 4, titlePh: "Easy returns", detailPh: "Report within 24 hours" },
  ];

  return (
    <div className="space-y-4">
      {/* Visibility Toggle */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div>
          <span className="text-sm font-medium">Show Benefit Strip</span>
          <p className="text-[11px] text-muted-foreground">Display the 4 trust promises below the hero banner</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => setField("usp_show", !checked)}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
            (checked ? "bg-primary" : "bg-muted")
          }
        >
          <span
            className={
              "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all " +
              (checked ? "left-[22px]" : "left-0.5")
            }
          />
        </button>
      </div>

      {/* 4 Grouped Benefit Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {defaults.map(({ num, titlePh, detailPh }) => {
          const tVal = typeof values[`usp${num}_t`] === "string" ? (values[`usp${num}_t`] as string) : "";
          const dVal = typeof values[`usp${num}_d`] === "string" ? (values[`usp${num}_d`] as string) : "";

          return (
            <div key={num} className="rounded-xl border bg-card/60 p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                  {num}
                </span>
                <span className="text-xs font-semibold text-foreground">Benefit Item {num}</span>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-muted-foreground">Title</label>
                <input
                  value={tVal}
                  placeholder={titlePh}
                  onChange={(e) => setField(`usp${num}_t`, e.target.value)}
                  className={inp}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-muted-foreground">Detail / Subtitle</label>
                <input
                  value={dVal}
                  placeholder={detailPh}
                  onChange={(e) => setField(`usp${num}_d`, e.target.value)}
                  className={inp}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Structured editor for Customer Reviews */
function ReviewsEditor({
  values,
  setField,
}: {
  values: ThemeContentValues;
  setField: (key: string, value: string | boolean) => void;
}) {
  const showRaw = values["review_show"];
  const checked = typeof showRaw === "boolean" ? showRaw : true;
  const titleVal = typeof values["review_title"] === "string" ? (values["review_title"] as string) : "";

  const defaults = [
    { num: 1, namePh: "Rakib, Dhaka", textPh: "Product exactly matched the photos and delivery was quick. Highly recommended." },
    { num: 2, namePh: "Sumaiya, Chattogram", textPh: "I paid after checking the parcel. Very comfortable shopping experience." },
    { num: 3, namePh: "Tanvir, Sylhet", textPh: "Support answered on WhatsApp within minutes. Will order again." },
  ];

  return (
    <div className="space-y-4">
      {/* Visibility Toggle */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <div>
          <span className="text-sm font-medium">Show Reviews Section</span>
          <p className="text-[11px] text-muted-foreground">Display social proof feedback from customers</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => setField("review_show", !checked)}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
            (checked ? "bg-primary" : "bg-muted")
          }
        >
          <span
            className={
              "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all " +
              (checked ? "left-[22px]" : "left-0.5")
            }
          />
        </button>
      </div>

      {/* Section Title */}
      <div>
        <label className="mb-1 block text-xs font-medium">Section title</label>
        <input
          value={titleVal}
          placeholder="What customers say"
          onChange={(e) => setField("review_title", e.target.value)}
          className={inp}
        />
      </div>

      {/* 3 Grouped Review Cards */}
      <div className="space-y-3">
        {defaults.map(({ num, namePh, textPh }) => {
          const nVal = typeof values[`review${num}_name`] === "string" ? (values[`review${num}_name`] as string) : "";
          const tVal = typeof values[`review${num}_text`] === "string" ? (values[`review${num}_text`] as string) : "";

          return (
            <div key={num} className="rounded-xl border bg-card/60 p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-primary/10 text-[11px] font-bold text-primary">
                  {num}
                </span>
                <span className="text-xs font-semibold text-foreground">Customer Review {num}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-muted-foreground">Customer Name</label>
                  <input
                    value={nVal}
                    placeholder={namePh}
                    onChange={(e) => setField(`review${num}_name`, e.target.value)}
                    className={inp}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-muted-foreground">Review Text</label>
                  <textarea
                    rows={2}
                    value={tVal}
                    placeholder={textPh}
                    onChange={(e) => setField(`review${num}_text`, e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
