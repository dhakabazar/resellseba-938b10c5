import { Link } from "@tanstack/react-router";
import { LogOut, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
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
  nav: NavItem[];
  user: { name: string; email: string };
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar md:flex">
          <div className="flex min-h-20 items-center gap-3 border-b border-sidebar-border px-5 py-3">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="h-14 w-14 shrink-0 rounded-lg object-contain" />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground">
                {brand.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-semibold leading-tight text-sidebar-foreground">
                {brand.name}
              </div>
              {brand.sub && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{brand.sub}</div>
              )}
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.end }}
                className={cn(
                  "group mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                activeProps={{
                  className:
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                }}
              >
                <span className="text-current">{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
              </Link>
            ))}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <div className="mb-2 px-2">
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
            <Button
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="flex w-full justify-start text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>
        <main className="flex-1 md:ml-64">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-6 backdrop-blur">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {headerRight}
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
