import { useEffect, useRef, useState } from "react";

/**
 * Animates the numeric portion of a stat value (e.g. "27+", "1200", "24/7")
 * from 0 to target once it scrolls into view. Non-numeric values render as-is.
 */
export function CountUp({ value, duration = 1400 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = /^(\D*)(\d[\d,]*)(.*)$/.exec(value?.trim() ?? "");
  const target = match ? Number(match[2].replace(/,/g, "")) : null;
  const [n, setN] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (target === null || started) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, started]);

  useEffect(() => {
    if (!started || target === null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  if (target === null) return <span ref={ref}>{value}</span>;

  return (
    <span ref={ref} className="tabular-nums">
      {match![1]}
      {n.toLocaleString("en-US")}
      {match![3]}
    </span>
  );
}
