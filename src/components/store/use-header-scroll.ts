import { useEffect, useState } from "react";

/** Shared by isolated theme bundles; only the top strips collapse. */
export function useHeaderScroll() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 48);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}