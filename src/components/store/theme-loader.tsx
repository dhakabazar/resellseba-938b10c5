import type { ReactNode } from "react";
import { PoripatiChrome, PoripatiHome, PoripatiListing, PoripatiProduct } from "./themes/poripati";
import LegacyShell from "./legacy-shell";
import LegacyHome from "./legacy-home";
import { useStore, type StoreListing } from "./store-context";

export function PoripatiChromeBoundary({ children }: { children: ReactNode }) {
  return <PoripatiChrome>{children}</PoripatiChrome>;
}
export function LegacyChromeBoundary({ children }: { children: ReactNode }) {
  return <LegacyShell>{children}</LegacyShell>;
}
export function LegacyHomeBoundary({ query }: { query?: string }) {
  return <LegacyHome query={query} />;
}
export function PoripatiHomeBoundary({ query }: { query?: string }) {
  return <PoripatiHome query={query} />;
}
export function PoripatiListingBoundary(props: { title: string; listings: StoreListing[]; categoryId?: string; clearUrl?: string }) {
  return <PoripatiListing {...props} />;
}
export function PoripatiProductBoundary({ listing }: { listing: StoreListing }) {
  return <PoripatiProduct listing={listing} />;
}
export function usePoripati() { return useStore().theme.id === "poripati"; }