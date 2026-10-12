import { useEffect, useState } from "react";

/**
 * Shared by isolated theme bundles; only the top strips collapse.
 * Uses hysteresis: hide past 48px, but only reappear near the very top (<8px).
 * Without it, collapsing the strip shifts the page and scrollY can bounce
 * around the threshold, restarting the animation every frame (jitter).
 */
export function useHeaderScroll() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 8 : y > 48));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}
