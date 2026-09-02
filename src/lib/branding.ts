import { useEffect } from "react";

/**
 * Applies the four brand colors (primary, accent, secondary, highlight) as CSS
 * variables globally. Accepts hex or any valid CSS color. Restores previous
 * values on unmount.
 */
export function useBrandingTheme(
  color: string | null | undefined,
  accent?: string | null | undefined,
  secondary?: string | null | undefined,
  highlight?: string | null | undefined,
) {
  useEffect(() => {
    if (!color && !accent && !secondary && !highlight) return;
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
      "--brand-1",
      "--brand-2",
      "--brand-3",
      "--brand-4",
      "--brand-3-foreground",
      "--brand-4-foreground",
      "--gradient-brand-4",
      "--gradient-hero",
    ] as const;
    const prev: Record<string, string> = {};
    keys.forEach((k) => (prev[k] = root.style.getPropertyValue(k)));

    const fgOf = (c: string) => `oklch(from ${c} clamp(0, (0.62 - l) * 999, 1) 0 0)`;

    if (color) {
      root.style.setProperty("--primary", color);
      root.style.setProperty("--ring", color);
      root.style.setProperty("--primary-soft", `color-mix(in oklab, ${color} 14%, white)`);
      root.style.setProperty("--primary-foreground", fgOf(color));
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
      root.style.setProperty("--brand-1", color);
    }

    if (accent) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-foreground", fgOf(accent));
      root.style.setProperty("--brand-2", accent);
    }

    if (secondary) {
      root.style.setProperty("--brand-3", secondary);
      root.style.setProperty("--brand-3-foreground", fgOf(secondary));
    }

    if (highlight) {
      root.style.setProperty("--brand-4", highlight);
      root.style.setProperty("--brand-4-foreground", fgOf(highlight));
    }

    const c1 = color ?? "var(--primary)";
    const c2 = accent ?? "var(--accent)";
    const c3 = secondary ?? c1;
    const c4 = highlight ?? c2;

    root.style.setProperty(
      "--gradient-brand-4",
      `linear-gradient(120deg, ${c1} 0%, ${c3} 38%, ${c4} 68%, ${c2} 100%)`,
    );
    root.style.setProperty(
      "--gradient-hero",
      [
        `radial-gradient(ellipse 70% 55% at 12% 0%, color-mix(in oklab, ${c1} 22%, transparent), transparent 70%)`,
        `radial-gradient(ellipse 60% 50% at 88% 5%, color-mix(in oklab, ${c3} 20%, transparent), transparent 70%)`,
        `radial-gradient(ellipse 60% 50% at 60% 95%, color-mix(in oklab, ${c4} 16%, transparent), transparent 70%)`,
        `linear-gradient(180deg, var(--background) 0%, color-mix(in oklab, ${c2} 6%, var(--background)) 100%)`,
      ].join(", "),
    );

    return () => {
      keys.forEach((k) => {
        if (prev[k]) root.style.setProperty(k, prev[k]);
        else root.style.removeProperty(k);
      });
    };
  }, [color, accent, secondary, highlight]);
}
