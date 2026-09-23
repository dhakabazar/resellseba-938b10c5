/**
 * Storefront theme engine.
 *
 * A theme is a bundle of typography + layout flags (header / hero / card /
 * section composition) plus a set of hand-tuned COLOR PALETTES. The reseller
 * picks a theme and one of its palettes; every palette ships a complete,
 * contrast-checked set of surface / text / border / brand colors, so switching
 * palette can never break the design.
 *
 * Everything the storefront renders reads these CSS custom properties, so a
 * palette change repaints backgrounds, text, borders and buttons together.
 *
 * Tracking (GA4 / Meta / TikTok) is theme-independent and stays global.
 */

export type StoreThemeId = "aurora" | "noir" | "bazaar" | "atelier" | "poripati";

export type StoreThemeLayout = {
  /** header composition */
  header: "glass" | "bar" | "classic" | "editorial" | "sohoj" | "poripati";
  /** home hero composition */
  hero: "gradient" | "spotlight" | "banner" | "split" | "sohoj" | "poripati";
  /** product card composition */
  card: "soft" | "frame" | "compact" | "bare";
  /** category strip composition */
  nav: "chips" | "pills" | "tabs" | "links";
  /** grid density on listing pages */
  grid: "cozy" | "dense" | "airy";
  uppercaseNav: boolean;
  trustBar: boolean;
};


/** A complete color set. Every field is required so no color can be missing. */
export type StorePalette = {
  id: string;
  name: string;
  /** dark surfaces => storefront ink is light */
  dark: boolean;
  bg: string;
  bgAlt: string;
  surface: string;
  fg: string;
  muted: string;
  border: string;
  primary: string;
  accent: string;
};

export type StoreTheme = {
  id: StoreThemeId;
  name: string;
  description: string;
  /** typography / shape tokens — palette independent */
  vars: Record<string, string>;
  layout: StoreThemeLayout;
  palettes: StorePalette[];
};

/**
 * Device font stacks. No webfont is downloaded — every theme uses fonts that
 * already exist on the visitor's device (including Bengali system fonts), so
 * the storefront never calls Google Fonts or any external font server.
 */
const SYS_SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "Hind Siliguri", "Helvetica Neue", Arial, sans-serif';
const SYS_SERIF =
  'Georgia, "Times New Roman", "Noto Serif Bengali", "Noto Serif", serif';

/** Builds a border color from the ink color so borders never clash. */
const pal = (
  id: string,
  name: string,
  dark: boolean,
  c: {
    bg: string;
    bgAlt: string;
    surface: string;
    fg: string;
    muted: string;
    border: string;
    primary: string;
    accent: string;
  },
): StorePalette => ({ id, name, dark, ...c });

export const STORE_THEMES: StoreTheme[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Modern gradient commerce — soft cards, glass header, bold hero.",
    vars: {
      "--st-radius": "16px",
      "--st-radius-sm": "10px",
      "--st-font-head": SYS_SANS,
      "--st-font-body": SYS_SANS,
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
    },
    palettes: [
      pal("indigo", "Indigo Glow", false, {
        bg: "#f7f8fc",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#0f1729",
        muted: "#64748b",
        border: "rgba(15,23,41,0.10)",
        primary: "#5b5bd6",
        accent: "#06b6d4",
      }),
      pal("emerald", "Fresh Mint", false, {
        bg: "#f4faf7",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#0b1f19",
        muted: "#587268",
        border: "rgba(11,31,25,0.10)",
        primary: "#0f9d67",
        accent: "#0ea5a5",
      }),
      pal("sunset", "Sunset Coral", false, {
        bg: "#fff7f3",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#25120b",
        muted: "#7c5b4d",
        border: "rgba(37,18,11,0.10)",
        primary: "#ef5b2b",
        accent: "#e11d48",
      }),
      pal("midnight", "Midnight Neon", true, {
        bg: "#0a1020",
        bgAlt: "#101a30",
        surface: "#141e37",
        fg: "#eef2ff",
        muted: "#9aa8c7",
        border: "rgba(238,242,255,0.14)",
        primary: "#7c8cff",
        accent: "#22d3ee",
      }),
    ],
  },
  {
    id: "noir",
    name: "Noir Luxe",
    description: "Dark premium boutique — serif headlines, metallic accents, spotlight hero.",
    vars: {
      "--st-radius": "4px",
      "--st-radius-sm": "2px",
      "--st-font-head": SYS_SERIF,
      "--st-font-body": SYS_SANS,
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
    },
    palettes: [
      pal("gold", "Black & Gold", true, {
        bg: "#0b0b0d",
        bgAlt: "#111114",
        surface: "#15151b",
        fg: "#f4f2ee",
        muted: "#a09d95",
        border: "rgba(244,242,238,0.14)",
        primary: "#c9a84c",
        accent: "#e6d9b4",
      }),
      pal("champagne", "Champagne", true, {
        bg: "#100e0c",
        bgAlt: "#171410",
        surface: "#1c1814",
        fg: "#f6efe4",
        muted: "#a89c8a",
        border: "rgba(246,239,228,0.14)",
        primary: "#d9c08a",
        accent: "#b98b5e",
      }),
      pal("emerald", "Deep Emerald", true, {
        bg: "#07100d",
        bgAlt: "#0c1713",
        surface: "#101d18",
        fg: "#eaf5ef",
        muted: "#8aa79a",
        border: "rgba(234,245,239,0.14)",
        primary: "#2fae7f",
        accent: "#c9e8d8",
      }),
      pal("ivory", "Ivory Luxe", false, {
        bg: "#f7f5f0",
        bgAlt: "#f1eee6",
        surface: "#fffdf9",
        fg: "#15130f",
        muted: "#6f6a60",
        border: "rgba(21,19,15,0.14)",
        primary: "#9a7b3f",
        accent: "#2f2a22",
      }),
    ],
  },
  {
    id: "bazaar",
    name: "Bazaar",
    description: "High-density marketplace — colored top bar, compact cards, deal strips.",
    vars: {
      "--st-radius": "8px",
      "--st-radius-sm": "6px",
      "--st-font-head": SYS_SANS,
      "--st-font-body": SYS_SANS,
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
    },
    palettes: [
      pal("orange", "Deal Orange", false, {
        bg: "#f2f4f7",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#16202c",
        muted: "#5b6875",
        border: "rgba(22,32,44,0.12)",
        primary: "#e8590c",
        accent: "#1f3b5c",
      }),
      pal("crimson", "Bazaar Red", false, {
        bg: "#f6f3f3",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#1d1618",
        muted: "#6b5c60",
        border: "rgba(29,22,24,0.12)",
        primary: "#d61f36",
        accent: "#2c1d20",
      }),
      pal("royal", "Royal Blue", false, {
        bg: "#f1f4f9",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#101c30",
        muted: "#5a6880",
        border: "rgba(16,28,48,0.12)",
        primary: "#1266d6",
        accent: "#0b2545",
      }),
      pal("forest", "Market Green", false, {
        bg: "#f1f6f2",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#122019",
        muted: "#556b5e",
        border: "rgba(18,32,25,0.12)",
        primary: "#128c4a",
        accent: "#14342a",
      }),
    ],
  },
  {
    id: "atelier",
    name: "সহজ শপ",
    description: "সহজ বাংলা দোকান — কমলা মেনু বার, ছবির ব্যানার, বড় অর্ডার বাটন, কল করে অর্ডার।",
    vars: {
      "--st-radius": "6px",
      "--st-radius-sm": "5px",
      "--st-font-head": SYS_SANS,
      "--st-font-body": SYS_SANS,
      "--st-head-weight": "800",
      "--st-track": "0",
    },
    layout: {
      header: "sohoj",
      hero: "sohoj",
      card: "compact",
      nav: "tabs",
      grid: "dense",
      uppercaseNav: false,
      trustBar: false,
    },
    palettes: [
      pal("kamla", "কমলা (Orange)", false, {
        bg: "#f2f4f7",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#1b2431",
        muted: "#64748b",
        border: "rgba(27,36,49,0.12)",
        primary: "#fb6514",
        accent: "#1b3d8f",
      }),
      pal("shobuj", "সবুজ (Green)", false, {
        bg: "#f1f6f2",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#14231a",
        muted: "#5b7266",
        border: "rgba(20,35,26,0.12)",
        primary: "#12924f",
        accent: "#0f5132",
      }),
      pal("nil", "নীল (Blue)", false, {
        bg: "#f1f4f9",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#121d31",
        muted: "#5b6880",
        border: "rgba(18,29,49,0.12)",
        primary: "#1266d6",
        accent: "#0b2545",
      }),
      pal("lal", "লাল (Red)", false, {
        bg: "#f7f3f3",
        bgAlt: "#ffffff",
        surface: "#ffffff",
        fg: "#1f1618",
        muted: "#6d5c60",
        border: "rgba(31,22,24,0.12)",
        primary: "#e02440",
        accent: "#7a1020",
      }),
    ],
  },
  {
    id: "poripati",
    name: "পরিপাটি",
    description: "Clean editorial shop — image-led banner, horizontal categories, refined product grid and focused checkout.",
    vars: {
      "--st-radius": "2px",
      "--st-radius-sm": "2px",
      "--st-font-head": SYS_SANS,
      "--st-font-body": SYS_SANS,
      "--st-head-weight": "750",
      "--st-track": "0",
    },
    layout: {
      header: "poripati",
      hero: "poripati",
      card: "bare",
      nav: "links",
      grid: "airy",
      uppercaseNav: false,
      trustBar: false,
    },
    palettes: [
      pal("ink-coral", "Ink & Coral", false, {
        bg: "#f8f8f5", bgAlt: "#eeeeea", surface: "#ffffff", fg: "#18201c", muted: "#68716c",
        border: "rgba(24,32,28,0.14)", primary: "#d94b36", accent: "#1f6650",
      }),
      pal("forest-red", "Forest & Red", false, {
        bg: "#f4f7f4", bgAlt: "#e8eee9", surface: "#ffffff", fg: "#15231c", muted: "#617067",
        border: "rgba(21,35,28,0.14)", primary: "#176b4a", accent: "#c74632",
      }),
      pal("cobalt-lemon", "Cobalt & Lemon", false, {
        bg: "#f6f7fa", bgAlt: "#eaedf4", surface: "#ffffff", fg: "#172033", muted: "#657086",
        border: "rgba(23,32,51,0.14)", primary: "#2357b6", accent: "#9a7600",
      }),
      pal("night-coral", "Night & Coral", true, {
        bg: "#111715", bgAlt: "#19221f", surface: "#202a27", fg: "#f5f6f3", muted: "#a8b4ae",
        border: "rgba(245,246,243,0.14)", primary: "#f06b55", accent: "#65c39f",
      }),
    ],
  },
];

export const DEFAULT_THEME_ID: StoreThemeId = "aurora";

export function getStoreTheme(id?: string | null): StoreTheme {
  return STORE_THEMES.find((t) => t.id === id) ?? STORE_THEMES[0];
}

export function getPalette(theme: StoreTheme, id?: string | null): StorePalette {
  return theme.palettes.find((p) => p.id === id) ?? theme.palettes[0];
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

/** Readable ink for text sitting on top of an arbitrary palette color. */
export function onColor(bg: string, palette: StorePalette): string {
  return luminance(bg) > 0.55 ? (palette.dark ? "#111114" : palette.fg) : palette.dark ? palette.fg : "#ffffff";
}

/** Swatches used by the theme / palette pickers. */
export function paletteSwatches(p: StorePalette): string[] {
  return [p.bg, p.surface, p.primary, p.accent];
}

/** CSS custom properties for the storefront root element. */
export function storeThemeStyle(theme: StoreTheme, paletteId?: string | null): React.CSSProperties {
  const p = getPalette(theme, paletteId);
  return {
    ...theme.vars,
    "--st-bg": p.bg,
    "--st-bg-alt": p.bgAlt,
    "--st-surface": p.surface,
    "--st-fg": p.fg,
    "--st-muted": p.muted,
    "--st-border": p.border,
    "--st-primary": p.primary,
    "--st-accent": p.accent,
    "--st-on-primary": onColor(p.primary, p),
    "--st-on-accent": onColor(p.accent, p),
    "--st-on-surface": onColor(p.surface, p),
    "--st-shadow": p.dark
      ? "0 24px 60px -32px rgba(0,0,0,0.85)"
      : "0 18px 40px -28px rgba(15,23,41,0.30)",
    /** legacy var kept for older components */
    "--store-primary": p.primary,
  } as React.CSSProperties;
}

/**
 * Kept for backwards compatibility: themes now use device fonts only, so
 * there is no external stylesheet to load.
 */
export function ensureThemeFont(_theme: StoreTheme) {
  /* no external webfont — device fonts only */
}
