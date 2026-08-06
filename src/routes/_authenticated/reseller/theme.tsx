import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { PageHeader } from "@/components/ui-kit";
import { Check, ExternalLink, Eye, Loader2, Monitor, Smartphone } from "lucide-react";
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
  const [theme, setTheme] = useState<StoreThemeId>(DEFAULT_THEME_ID);
  const [savedTheme, setSavedTheme] = useState<StoreThemeId>(DEFAULT_THEME_ID);
  const [all, setAll] = useState<Record<string, ThemeContentValues>>({});
  const [openGroup, setOpenGroup] = useState<string>("hero");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
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
      const { data: r } = await supabase.from("resellers").select("id,code").eq("user_id", uid).maybeSingle();
      if (!alive) return;
      if (!r) return setLoading(false);
      setRid(r.id);
      setCode(r.code);
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
    setPreviewKey((k) => k + 1);
    toast.success("Theme saved and published");
  }

  if (loading)
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const previewSrc = code
    ? `/s/${code}?theme=${theme}&palette=${palette.id}&preview=${previewKey}`
    : "";

  return (
    <div>
      <PageHeader
        title="Visual Appearance"
        description="Customize your storefront theme, color palettes, and interactive section content."
        actions={
          <div className="flex flex-wrap gap-2">
            {code && (
              <a
                href={`/s/${code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <ExternalLink className="h-4 w-4" /> Live store
              </a>
            )}
            <button
              onClick={save}
              disabled={busy}
              className="btn-brand inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save & publish
            </button>
          </div>
        }
      />

      {/* theme picker */}
      <div className="surface-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">1. Choose theme</h3>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  (active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50 hover:shadow-md")
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

      {/* palette picker */}
      <div className="surface-card mt-4 space-y-4 p-6">
        <div>
          <h3 className="text-sm font-semibold">2. Color palette — {activeTheme.name}</h3>
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
                  "relative overflow-hidden rounded-xl border p-3 text-left transition-colors " +
                  (active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50")
                }
              >
                <PaletteChip palette={p} />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{p.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[11px] text-muted-foreground">{p.dark ? "Dark surfaces" : "Light surfaces"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        {/* editor */}
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-sm font-semibold">3. Content of {activeTheme.name}</h3>
            <p className="text-xs text-muted-foreground">
              Only sections this theme actually renders are listed here.
            </p>
          </div>
          {groups.map((g) => {
            const open = openGroup === g.id;
            return (
              <div key={g.id} className="surface-card overflow-hidden">
                <button
                  onClick={() => setOpenGroup(open ? "" : g.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold">{g.title}</div>
                    <div className="text-xs text-muted-foreground">{g.description}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{open ? "Hide" : "Edit"}</span>
                </button>
                {open && (
                  <div className="space-y-3 border-t p-4">
                    {g.fields.map((f) => {
                      const raw = values[f.key];
                      if (f.type === "toggle") {
                        const checked = typeof raw === "boolean" ? raw : f.def !== false;
                        return (
                          <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium">{f.label}</span>
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
                          </label>
                        );
                      }
                      if (f.type === "image") {
                        const url = typeof raw === "string" ? raw : "";
                        const val: UploadedImage[] = url ? [{ path: "", url, bytes: 0 }] : [];
                        return (
                          <div key={f.key}>
                            <label className="mb-1 block text-xs font-medium">{f.label}</label>
                            <ImageUploader
                              bucket="branding"
                              folder={`${rid}/${theme}/${f.key}`}
                              value={val}
                              onChange={(v) => setField(f.key, v[0]?.url ?? "")}
                            />
                            {f.hint && <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>}
                          </div>
                        );
                      }
                      const str = typeof raw === "string" ? raw : "";
                      const ph = typeof f.def === "string" ? f.def : f.placeholder;
                      return (
                        <div key={f.key}>
                          <label className="mb-1 block text-xs font-medium">{f.label}</label>
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
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-muted-foreground">
                      Leave a field empty to use the theme default. Use {"{store}"} to insert your store name.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* live preview */}
        <div className="surface-card sticky top-4 h-fit p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="h-4 w-4" /> Live preview
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                {activeTheme.name} · {palette.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDevice("desktop")}
                className={
                  "rounded-md border p-2 " + (device === "desktop" ? "border-primary text-primary" : "text-muted-foreground")
                }
                aria-label="Desktop preview"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDevice("mobile")}
                className={
                  "rounded-md border p-2 " + (device === "mobile" ? "border-primary text-primary" : "text-muted-foreground")
                }
                aria-label="Mobile preview"
              >
                <Smartphone className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setPreviewLoaded(false);
                  setPreviewOn(true);
                  setPreviewKey((k) => k + 1);
                }}
                className="rounded-md border px-3 py-2 text-xs"
              >
                {previewOn ? "Refresh" : "Load preview"}
              </button>
            </div>
          </div>
          {!previewSrc ? (
            <p className="text-sm text-muted-foreground">Preview appears once your store is active.</p>
          ) : previewOn ? (
            <div className="mx-auto overflow-hidden rounded-lg border" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
              <iframe
                key={previewKey}
                src={previewSrc}
                title="Store preview"
                onLoad={() => setPreviewLoaded(true)}
                className="h-[720px] w-full bg-background"
              />
            </div>
          ) : (
            <button
              onClick={() => {
                setPreviewLoaded(false);
                setPreviewOn(true);
              }}
              className="grid h-[280px] w-full place-items-center rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/40"
            >
              <span className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4" /> Load live preview
              </span>
            </button>
          )}
          {previewOn && !previewLoaded && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preview… if it stays blank,
              <a href={previewSrc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary">
                open it in a new tab <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Theme and palette changes show instantly after Refresh. Save & publish to apply them for customers —
            text edits appear in the preview after saving.
          </p>

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
