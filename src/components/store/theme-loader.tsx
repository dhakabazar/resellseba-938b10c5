import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useStore, type StoreListing } from "./store-context";

const PoripatiChrome = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiChrome })));
const PoripatiHome = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiHome })));
const PoripatiListing = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiListing })));
const PoripatiProduct = lazy(() => import("./themes/poripati").then(m => ({ default: m.PoripatiProduct })));
const NogoriChrome = lazy(() => import("./themes/nogori").then(m => ({ default: m.NogoriChrome })));
const NogoriHome = lazy(() => import("./themes/nogori").then(m => ({ default: m.NogoriHome })));
const NogoriListing = lazy(() => import("./themes/nogori").then(m => ({ default: m.NogoriListing })));
const NogoriProduct = lazy(() => import("./themes/nogori").then(m => ({ default: m.NogoriProduct })));
const LegacyShell = lazy(() => import("./legacy-shell"));
const LegacyHome = lazy(() => import("./legacy-home"));

function Wait() { return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--st-muted)]" /></div>; }

export function PoripatiChromeBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Wait />}><PoripatiChrome>{children}</PoripatiChrome></Suspense>;
}
export function LegacyChromeBoundary({ children }: { children: ReactNode }) { return <Suspense fallback={<Wait />}><LegacyShell>{children}</LegacyShell></Suspense>; }
export function LegacyHomeBoundary({ query }: { query?: string }) { return <Suspense fallback={<Wait />}><LegacyHome query={query} /></Suspense>; }
export function PoripatiHomeBoundary({ query }: { query?: string }) { return <Suspense fallback={<Wait />}><PoripatiHome query={query} /></Suspense>; }
export function PoripatiListingBoundary(props: { title: string; listings: StoreListing[]; categoryId?: string }) { return <Suspense fallback={<Wait />}><PoripatiListing {...props} /></Suspense>; }
export function PoripatiProductBoundary({ listing }: { listing: StoreListing }) { return <Suspense fallback={<Wait />}><PoripatiProduct listing={listing} /></Suspense>; }
export function NogoriChromeBoundary({ children }: { children: ReactNode }) { return <Suspense fallback={<Wait />}><NogoriChrome>{children}</NogoriChrome></Suspense>; }
export function NogoriHomeBoundary({ query }: { query?: string }) { return <Suspense fallback={<Wait />}><NogoriHome query={query} /></Suspense>; }
export function NogoriListingBoundary(props: { title: string; listings: StoreListing[]; categoryId?: string }) { return <Suspense fallback={<Wait />}><NogoriListing {...props} /></Suspense>; }
export function NogoriProductBoundary({ listing }: { listing: StoreListing }) { return <Suspense fallback={<Wait />}><NogoriProduct listing={listing} /></Suspense>; }
export function usePoripati() { return useStore().theme.id === "poripati"; }
export function useNogori() { return useStore().theme.id === "nogori"; }