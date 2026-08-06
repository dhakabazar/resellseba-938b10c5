import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/Hint";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground/70 sm:text-base md:text-lg">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}

const TONES = {
  primary: { text: "text-primary", ring: "hover:border-primary/50", glow: "from-primary/15" },
  emerald: { text: "text-emerald-500", ring: "hover:border-emerald-500/50", glow: "from-emerald-500/15" },
  amber: { text: "text-amber-500", ring: "hover:border-amber-500/50", glow: "from-amber-500/15" },
  violet: { text: "text-violet-500", ring: "hover:border-violet-500/50", glow: "from-violet-500/15" },
  sky: { text: "text-sky-500", ring: "hover:border-sky-500/50", glow: "from-sky-500/15" },
  rose: { text: "text-rose-500", ring: "hover:border-rose-500/50", glow: "from-rose-500/15" },
} as const;

export type StatTone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  tone?: StatTone;
}) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        t.ring,
      )}
    >
      {/* watermark icon */}
      {icon && (
        <div className={cn("pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 opacity-[0.07] [&_svg]:h-16 [&_svg]:w-16", t.text)}>
          {icon}
        </div>
      )}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent opacity-0 transition-opacity group-hover:opacity-100",
          t.glow,
        )}
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {trend && (
            <span className={cn("text-[10px] font-bold", trend.positive ? "text-emerald-500" : "text-rose-500")}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
          )}
          {hint && (
            <Hint side="left" className={t.text}>
              {hint}
            </Hint>
          )}
        </span>
      </div>
      <div className={cn("relative mt-1 truncate text-xl font-black leading-tight tracking-tight sm:text-2xl", t.text)}>
        {value}
      </div>
    </div>
  );
}


export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card grid place-items-center gap-3 p-12 text-center">
      <div className="text-lg font-semibold">{title}</div>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </div>
  );
}
