import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
            {label}
          </span>
          <div className="text-2xl font-black tracking-tighter sm:text-3xl">
            {value}
          </div>
        </div>
        {icon && (
          <div className="shrink-0 rounded-xl bg-primary/5 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            {icon}
          </div>
        )}
      </div>
      {(trend || hint) && (
        <div className="mt-4 flex items-center gap-3 border-t border-dashed pt-4">
          {trend && (
            <span className={cn(
              "flex items-center gap-1 text-[11px] font-bold",
              trend.positive ? "text-emerald-500" : "text-rose-500"
            )}>
              {trend.positive ? "↑" : "↓"} {trend.value}
            </span>
          )}
          {hint && (
            <span className="truncate text-[11px] font-bold text-muted-foreground/60">
              {hint}
            </span>
          )}
        </div>
      )}
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
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
