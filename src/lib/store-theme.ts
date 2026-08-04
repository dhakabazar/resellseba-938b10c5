/**
 * Storefront theme engine.
 *
 * A theme is a bundle of design tokens (colors, fonts, radius, shadows) plus
 * layout flags that switch header / hero / card / section composition.
 * Reseller picks a theme in the panel -> whole storefront changes A-Z.
 *
 * Tracking (GA4 / Meta / TikTok) is theme-independent and stays global.
 */

export type StoreThemeId = "aurora" | "noir" | "bazaar" | "atelier";

export type StoreThemeLayout = {
  /** header composition */
  header: "glass" | "bar" | "classic" | "editorial";
  /** home hero composition */
  hero: "gradient" | "spotlight" | "banner" | "split";
  /** product card composition */
  card: "soft" | "frame" | "compact" | "bare";
  /** category strip composition */
  nav: "chips" | "pills" | "tabs" | "links";
  /** grid density on listing pages */
  grid: "cozy" | "dense" | "airy";
  uppercaseNav: boolean;
  trustBar: boolean;
  /** dark surfaces => use light text utilities */
  dark: boolean;
};

export type StoreTheme = {
  id: StoreThemeId;
  name: string;
  description: string;
  /** google fonts stylesheet for this theme */
  fontHref: string;
  vars: Record<string, string>;
  layout: StoreThemeLayout;
  /** swatches shown in the theme picker */
  preview: string[];
};

const G = (families: string) =>
  `https://fonts.googleapis.com/css2?${families}&display=swap`;

export const STORE_THEMES: StoreTheme[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Modern gradient commerce — soft cards, glass header, bold hero.",
    fontHref: G("family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700"),
    vars: {
      "--st-bg": "#f7f8fc",
      "--st-bg-alt": "#ffffff",
      "--st-surface": "#ffffff",
      "--st-fg": "#0f1729",
      "--st-muted": "#64748b",
      "--st-border": "rgba(15,23,41,0.09)",
      "--st-radius": "16px",
      "--st-radius-sm": "10px",
      "--st-shadow": "0 18px 40px -28px rgba(15,23,41,0.35)",
      "--st-font-head": "'Sora', system-ui, sans-serif",
      "--st-font-body": "'Manrope', system-ui, sans-serif",
      "--st-head-weight": "700",
      "--st-track": "-0.02em",
    },
    layout: {
      header: "glass",
      hero: "gradient",
      card: "soft",
      nav: "chips",
      grid: "cozy",
      uppercaseNav: false,
      trustBar: true,
      dark: false,
    },
    preview: ["#f7f8fc", "#ffffff", "#6366f1", "#0f1729"],
  },
  {
    id: "noir",
    name: "Noir Luxe",
    description: "Dark premium boutique — serif headlines, gold accents, spotlight hero.",
    fontHref: G("family=Cormorant+Garamond:wght@500;600;700&family=Karla:wght@400;500;600;700"),
    vars: {
      "--st-bg": "#0b0b0d",
      "--st-bg-alt": "#111114",
      "--st-surface": "#14141a",
      "--st-fg": "#f4f2ee",
      "--st-muted": "#9d9a93",
      "--st-border": "rgba(244,242,238,0.14)",
      "--st-radius": "4px",
      "--st-radius-sm": "2px",
      "--st-shadow": "0 24px 60px -30px rgba(0,0,0,0.9)",
      "--st-font-head": "'Cormorant Garamond', Georgia, serif",
      "--st-font-body": "'Karla', system-ui, sans-serif",
      "--st-head-weight": "600",
      "--st-track": "0.01em",
    },
    layout: {
      header: "classic",
      hero: "spotlight",
      card: "frame",
      nav: "links",
      grid: "airy",
      uppercaseNav: true,
      trustBar: false,
      dark: true,
    },
    preview: ["#0b0b0d", "#14141a", "#c9a84c", "#f4f2ee"],
  },
  {
    id: "bazaar",
    name: "Bazaar",
    description: "High-density marketplace — colored top bar, compact cards, deal badges.",
    fontHref: G("family=Hind+Siliguri:wght@500;600;700&family=Barlow:wght@400;500;600;700"),
    vars: {
      "--st-bg": "#f2f4f7",
      "--st-bg-alt": "#ffffff",
      "--st-surface": "#ffffff",
      "--st-fg": "#16202c",
      "--st-muted": "#5b6875",
      "--st-border": "rgba(22,32,44,0.12)",
      "--st-radius": "8px",
      "--st-radius-sm": "6px",
      "--st-shadow": "0 10px 24px -20px rgba(22,32,44,0.5)",
      "--st-font-head": "'Hind Siliguri', system-ui, sans-serif",
      "--st-font-body": "'Barlow', system-ui, sans-serif",
      "--st-head-weight": "700",
      "--st-track": "0",
    },
    layout: {
      header: "bar",
      hero: "banner",
      card: "compact",
      nav: "tabs",
      grid: "dense",
      uppercaseNav: false,
      trustBar: true,
      dark: false,
    },
    preview: ["#f2f4f7", "#ffffff", "#e8590c", "#16202c"],
  },
  {
    id: "atelier",
    name: "Atelier",
    description: "Editorial minimal — paper tones, serif display, generous whitespace.",
    fontHref: G("family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@400;500;600"),
    vars: {
      "--st-bg": "#f6f4ef",
      "--st-bg-alt": "#efece4",
      "--st-surface": "#fffdf8",
      "--st-fg": "#1d1b18",
      "--st-muted": "#736d63",
      "--st-border": "rgba(29,27,24,0.14)",
      "--st-radius": "2px",
      "--st-radius-sm": "2px",
      "--st-shadow": "none",
      "--st-font-head": "'Instrument Serif', Georgia, serif",
      "--st-font-body": "'Work Sans', system-ui, sans-serif",
      "--st-head-weight": "400",
      "--st-track": "-0.01em",
    },
    layout: {
      header: "editorial",
      hero: "split",
      card: "bare",
      nav: "pills",
      grid: "airy",
      uppercaseNav: true,
      trustBar: false,
      dark: false,
    },
    preview: ["#f6f4ef", "#fffdf8", "#1d1b18", "#b08968"],
  },
];

export const DEFAULT_THEME_ID: StoreThemeId = "aurora";

export function getStoreTheme(id?: string | null): StoreTheme {
  return STORE_THEMES.find((t) => t.id === id) ?? STORE_THEMES[0];
}

/** Relative luminance of a hex color (0 = black, 1 = white). */
function luminance(hex: string): number {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Text color that stays readable on top of any brand color the reseller picks.
 * Dark themes keep their off-white ink, light themes fall back to near-black.
 */
export function onColor(bg: string, theme: StoreTheme): string {
  const light = theme.id === "noir" ? "#f4f2ee" : theme.id === "atelier" ? "#fffdf8" : "#ffffff";
  const dark = theme.vars["--st-fg"] && !theme.layout.dark ? theme.vars["--st-fg"] : "#111114";
  return luminance(bg) > 0.55 ? dark : light;
}

/** CSS custom properties for the storefront root element. */
export function storeThemeStyle(
  theme: StoreTheme,
  primary?: string | null,
  accent?: string | null,
): React.CSSProperties {
  const p = primary || theme.preview[2];
  const a = accent || theme.preview[3];
  return {
    ...theme.vars,
    "--st-primary": p,
    "--st-accent": a,
    "--st-on-primary": onColor(p, theme),
    "--st-on-accent": onColor(a, theme),
    /** legacy var kept for older components */
    "--store-primary": p,
  } as React.CSSProperties;
}

/** Ensures the theme's webfont stylesheet is present (client only). */
export function ensureThemeFont(theme: StoreTheme) {
  if (typeof document === "undefined") return;
  const id = `st-font-${theme.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = theme.fontHref;
  document.head.appendChild(link);
}
