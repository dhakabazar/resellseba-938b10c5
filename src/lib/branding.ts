import { useEffect } from "react";

/**
 * Applies a branding color as the CSS `--primary` (+ ring/soft) across the app.
 * Accepts hex (#3b82f6) or any valid CSS color (oklch/hsl/rgb).
 * Restores previous values on unmount.
 */
export function useBrandingTheme(color: string | null | undefined) {
  useEffect(() => {
    if (!color) return;
    const root = document.documentElement;
    const prev = {
      primary: root.style.getPropertyValue("--primary"),
      ring: root.style.getPropertyValue("--ring"),
      soft: root.style.getPropertyValue("--primary-soft"),
      pfg: root.style.getPropertyValue("--primary-foreground"),
      sidebarAccent: root.style.getPropertyValue("--sidebar-accent"),
      sidebarAccentFg: root.style.getPropertyValue("--sidebar-accent-foreground"),
    };

    root.style.setProperty("--primary", color);
    root.style.setProperty("--ring", color);
    root.style.setProperty(
      "--primary-soft",
      `color-mix(in oklab, ${color} 14%, white)`,
    );
    root.style.setProperty(
      "--primary-foreground",
      `oklch(from ${color} clamp(0.02, 1 - l, 0.98) 0 0)`,
    );
    root.style.setProperty(
      "--sidebar-accent",
      `color-mix(in oklab, ${color} 12%, white)`,
    );
    root.style.setProperty(
      "--sidebar-accent-foreground",
      color,
    );

    return () => {
      const restore = (k: string, v: string) => {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      };
      restore("--primary", prev.primary);
      restore("--ring", prev.ring);
      restore("--primary-soft", prev.soft);
      restore("--primary-foreground", prev.pfg);
      restore("--sidebar-accent", prev.sidebarAccent);
      restore("--sidebar-accent-foreground", prev.sidebarAccentFg);
    };
  }, [color]);
}
