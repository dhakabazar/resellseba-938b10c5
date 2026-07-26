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
    const keys = [
      "--primary",
      "--ring",
      "--primary-soft",
      "--primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--gradient-brand",
      "--shadow-elegant",
    ] as const;
    const prev: Record<string, string> = {};
    keys.forEach((k) => (prev[k] = root.style.getPropertyValue(k)));

    // Pure white/black foreground based on brand lightness — guarantees contrast on gradient buttons.
    // (0.62 - l) * 999 clamps to 0 or 1: dark brand -> white text, light brand -> black text.
    const fg = `oklch(from ${color} clamp(0, (0.62 - l) * 999, 1) 0 0)`;

    root.style.setProperty("--primary", color);
    root.style.setProperty("--ring", color);
    root.style.setProperty("--primary-soft", `color-mix(in oklab, ${color} 14%, white)`);
    root.style.setProperty("--primary-foreground", fg);
    root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${color} 12%, white)`);
    root.style.setProperty("--sidebar-accent-foreground", color);
    root.style.setProperty(
      "--gradient-brand",
      `linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 70%, black) 100%)`,
    );
    root.style.setProperty(
      "--shadow-elegant",
      `0 10px 40px -12px color-mix(in oklab, ${color} 40%, transparent)`,
    );

    return () => {
      keys.forEach((k) => {
        if (prev[k]) root.style.setProperty(k, prev[k]);
        else root.style.removeProperty(k);
      });
    };
  }, [color]);
}
