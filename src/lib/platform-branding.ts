/**
 * Platform branding (favicon + the four brand colors).
 *
 * Instead of every page re-reading `global_settings`, whichever page bootstrap
 * already carries the settings row pushes them here once. The root layout only
 * subscribes — so branding costs zero extra requests on any page.
 */
import { useEffect, useState } from "react";

export type PlatformBrand = {
  primary: string | null;
  accent: string | null;
  secondary: string | null;
  highlight: string | null;
};

let current: PlatformBrand = { primary: null, accent: null, secondary: null, highlight: null };
const subs = new Set<(b: PlatformBrand) => void>();

export function applyPlatformBranding(
  settings:
    | {
        favicon_url?: string | null;
        primary_color?: string | null;
        accent_color?: string | null;
        secondary_color?: string | null;
        highlight_color?: string | null;
      }
    | null
    | undefined,
) {
  if (!settings) return;
  if (typeof document !== "undefined" && settings.favicon_url) {
    document.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = settings.favicon_url;
    document.head.appendChild(link);
  }
  const next: PlatformBrand = {
    primary: settings.primary_color ?? null,
    accent: settings.accent_color ?? null,
    secondary: settings.secondary_color ?? null,
    highlight: settings.highlight_color ?? null,
  };
  if (
    next.primary === current.primary &&
    next.accent === current.accent &&
    next.secondary === current.secondary &&
    next.highlight === current.highlight
  )
    return;
  current = next;
  subs.forEach((fn) => fn(current));
}

/** Subscribe to the branding pushed by the current page's bootstrap call. */
export function usePlatformBranding(): PlatformBrand {
  const [brand, setBrand] = useState(current);
  useEffect(() => {
    setBrand(current);
    subs.add(setBrand);
    return () => {
      subs.delete(setBrand);
    };
  }, []);
  return brand;
}
