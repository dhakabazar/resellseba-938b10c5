import { useEffect } from "react";

/**
 * Applies branding colors (primary + optional accent) as CSS variables globally.
 * Accepts hex or any valid CSS color. Restores previous values on unmount.
 */
export function useBrandingTheme(
  color: string | null | undefined,
  accent?: string | null | undefined,
) {
  useEffect(() => {
    if (!color && !accent) return;
    const root = document.documentElement;
    const keys = [
      "--primary",
      "--ring",
      "--primary-soft",
      "--primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-ring",
      "--gradient-brand",
      "--shadow-elegant",
      "--accent",
      "--accent-foreground",
    ] as const;
    const prev: Record<string, string> = {};
    keys.forEach((k) => (prev[k] = root.style.getPropertyValue(k)));

    if (color) {
      const fg = `oklch(from ${color} clamp(0, (0.62 - l) * 999, 1) 0 0)`;
      root.style.setProperty("--primary", color);
      root.style.setProperty("--ring", color);
      root.style.setProperty("--primary-soft", `color-mix(in oklab, ${color} 14%, white)`);
      root.style.setProperty("--primary-foreground", fg);
      root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${color} 12%, white)`);
      root.style.setProperty("--sidebar-accent-foreground", color);
      root.style.setProperty("--sidebar-ring", color);
      root.style.setProperty(
        "--gradient-brand",
        `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 70%, black) 100%)`,
      );
      root.style.setProperty(
        "--shadow-elegant",
        `0 10px 40px -12px color-mix(in oklab, ${color} 40%, transparent)`,
      );
    }

    if (accent) {
      const afg = `oklch(from ${accent} clamp(0, (0.62 - l) * 999, 1) 0 0)`;
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-foreground", afg);
    }

    return () => {
      keys.forEach((k) => {
        if (prev[k]) root.style.setProperty(k, prev[k]);
        else root.style.removeProperty(k);
      });
    };
  }, [color, accent]);
}
