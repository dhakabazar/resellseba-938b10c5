import type { ReactNode } from "react";

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
    <div className="mb-8 flex flex-wrap items-center justify-between gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-base text-muted-foreground/80 md:text-lg">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
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
    <div className="group surface-card relative overflow-hidden p-6 transition-all hover:border-primary/50 hover:shadow-elegant">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
          {label}
        </span>
        {icon && (
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <div className="text-3xl font-bold tracking-tight md:text-4xl">{value}</div>
        {trend && (
          <span className={`text-xs font-bold ${trend.positive ? 'text-success' : 'text-destructive'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60">
          <div className="h-1 w-1 rounded-full bg-primary/40" />
          {hint}
        </div>
      )}
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
