import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, ChevronRight, ChevronDown, Menu, X, PanelLeftClose, PanelLeftOpen, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResellerAvatar } from "@/components/reseller-avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { clearImpersonation } from "@/lib/impersonation";

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
  /** Open in a new browser tab instead of client-side navigation. */
  external?: boolean;
  /** Pending-work counter shown as a badge next to the label. */
  badge?: number;
}

export interface NavGroup {
  label: string;
  icon: ReactNode;
  items: NavItem[];
  badge?: number;
}

export type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return (entry as NavGroup).items !== undefined;
}

/** Small red counter chip used in the sidebar. */
function NavBadge({ count, dot = false }: { count?: number; dot?: boolean }) {
  if (!count || count < 1) return null;
  if (dot) {
    return (
      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" aria-hidden />
    );
  }
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground tabular-nums">
      {count > 999 ? "999+" : count}
    </span>
  );
}

export function AppShell({
  title,
  brand,
  nav,
  user,
  headerRight,
  children,
}: {
  title: string;
  brand: { name: string; sub?: string; logoUrl?: string | null };
  nav: NavEntry[];
  user: { name: string; email: string; avatarUrl?: string | null };
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  const activeGroupIdx = useMemo(() => {
    for (let i = 0; i < nav.length; i++) {
      const e = nav[i];
      if (isGroup(e) && e.items.some((it) => currentPath === it.to || (!it.end && currentPath.startsWith(it.to + "/")))) {
        return i;
      }
    }
    return -1;
  }, [nav, currentPath]);

  const [openIdx, setOpenIdx] = useState<number>(activeGroupIdx);
  useEffect(() => {
    if (activeGroupIdx !== -1) setOpenIdx(activeGroupIdx);
  }, [activeGroupIdx]);

  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("appshell:collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("appshell:collapsed", desktopCollapsed ? "1" : "0");
    }
  }, [desktopCollapsed]);

  const renderSidebar = (collapsed: boolean) => (
    <>
      <div className={cn("flex min-h-24 items-center gap-3 border-b border-sidebar-border py-4", collapsed ? "px-3 justify-center" : "px-5")}>
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.name} className={cn("shrink-0 object-contain", collapsed ? "h-10 w-10" : "h-12 max-w-28")} />
        ) : (
          <div className={cn("grid shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-bold text-primary-foreground", collapsed ? "h-10 w-10 text-base" : "h-14 w-14 text-xl")}>
            {brand.name.charAt(0)}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold leading-tight text-sidebar-foreground">
              {brand.name}
            </div>
            {brand.sub && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{brand.sub}</div>
            )}
          </div>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className={cn("flex-1 overflow-y-auto no-scrollbar", collapsed ? "p-2" : "p-3")}>
        {nav.map((entry, idx) => {
          if (!isGroup(entry)) {
            return <LeafLink key={entry.to} item={entry} collapsed={collapsed} />;
          }
          const isOpen = openIdx === idx && !collapsed;
          const hasActive = entry.items.some(
            (it) => currentPath === it.to || (!it.end && currentPath.startsWith(it.to + "/")),
          );
          const groupBadge =
            entry.badge ?? entry.items.reduce((sum, it) => sum + (it.badge && it.badge > 0 ? it.badge : 0), 0);
          if (collapsed) {
            return (
              <button
                key={entry.label}
                type="button"
                onClick={() => {
                  setDesktopCollapsed(false);
                  setOpenIdx(idx);
                }}
                title={entry.label}
                className={cn(
                  "relative mb-1 flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  hasActive && "bg-sidebar-accent/60 text-sidebar-accent-foreground",
                )}
              >
                {entry.icon}
                <NavBadge count={groupBadge} dot />
              </button>
            );
          }
          return (
            <div key={entry.label} className="mb-1">
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  hasActive && "text-sidebar-accent-foreground",
                )}
                aria-expanded={isOpen}
              >
                <span className="text-current">{entry.icon}</span>
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-0" : "-rotate-90")}
                />
              </button>
              {isOpen && (
                <div className="mt-1 ml-4 border-l border-sidebar-border pl-2">
                  {entry.items.map((it) => (
                    <LeafLink key={it.to} item={it} nested collapsed={false} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 px-2">
            <ResellerAvatar url={user.avatarUrl} name={user.name} size={32} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          title="Sign out"
          onClick={async () => {
            clearImpersonation();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className={cn(
            "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "w-full justify-center px-0" : "flex w-full justify-start",
          )}
        >
          <LogOut className="h-4 w-4" /> {!collapsed && "Sign out"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
            desktopCollapsed ? "w-16" : "w-64",
          )}
        >
          {renderSidebar(desktopCollapsed)}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-sidebar shadow-xl transition-transform duration-200 md:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {renderSidebar(false)}
        </aside>

        <main className={cn("min-w-0 max-w-full flex-1 overflow-x-hidden transition-[margin] duration-200", desktopCollapsed ? "md:ml-16" : "md:ml-64")}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            <div className="flex flex-1 items-center gap-2 overflow-hidden">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden -ml-1 rounded-md p-2 text-foreground hover:bg-muted"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setDesktopCollapsed((v) => !v)}
                className="hidden md:inline-flex -ml-1 rounded-md p-2 text-foreground hover:bg-muted"
                aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {desktopCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              {headerRight}
            </div>
          </header>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function LeafLink({ item, nested = false, collapsed = false }: { item: NavItem; nested?: boolean; collapsed?: boolean }) {
  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noreferrer"
        title={item.label}
        className={cn(
          "group mb-1 flex items-center rounded-md text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed ? "justify-center p-2" : "gap-3 px-3 py-2 text-[13px] font-medium",
          !collapsed && nested && "py-1.5",
        )}
      >
        <span className="text-current">{item.icon}</span>
        {collapsed ? null : (
          <>
            <span className="flex-1">{item.label}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-40 group-hover:opacity-70" />
          </>
        )}
      </a>
    );
  }
  if (collapsed) {
    return (
      <Link
        to={item.to}
        activeOptions={{ exact: item.end }}
        title={item.label}
        className="mb-1 flex items-center justify-center rounded-md p-2 text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
      >
        {item.icon}
      </Link>
    );
  }
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.end }}
      className={cn(
        "group mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        nested && "py-1.5",
      )}
      activeProps={{
        className: "bg-sidebar-accent text-sidebar-accent-foreground",
      }}
    >
      <span className="text-current">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
    </Link>
  );
}
