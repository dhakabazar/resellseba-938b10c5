import type { ReactNode } from "react";
import { StoreFooter, StoreHeader } from "./chrome";

export default function LegacyStoreShell({ children }: { children: ReactNode }) {
  return <><StoreHeader /><main>{children}</main><StoreFooter /></>;
}