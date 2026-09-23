import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useStore, type StoreListing } from "./store-context";

const PoripatiChrome = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiChrome })));
const PoripatiHome = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiHome })));
const PoripatiListing = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiListing })));
const PoripatiProduct = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiProduct })));

function Wait() { return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--st-muted)]" /></div>; }

export function PoripatiChromeBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Wait />}><PoripatiChrome>{children}</PoripatiChrome></Suspense>;
}
export function PoripatiHomeBoundary({ query }: { query?: string }) { return <Suspense fallback={<Wait />}><PoripatiHome query={query} /></Suspense>; }
export function PoripatiListingBoundary(props: { title: string; listings: StoreListing[]; categoryId?: string }) { return <Suspense fallback={<Wait />}><PoripatiListing {...props} /></Suspense>; }
export function PoripatiProductBoundary({ listing }: { listing: StoreListing }) { return <Suspense fallback={<Wait />}><PoripatiProduct listing={listing} /></Suspense>; }
export function usePoripati() { return useStore().theme.id === "poripati"; }