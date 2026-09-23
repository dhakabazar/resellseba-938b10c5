import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/components/store/store-context";
import { LegacyHomeBoundary, NogoriHomeBoundary, PoripatiHomeBoundary } from "@/components/store/theme-loader";

type Search = { q?: string; theme?: string; palette?: string };
export const Route = createFileRoute("/s/$code/")({
  component: StoreHome,
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    theme: typeof s.theme === "string" && s.theme ? s.theme : undefined,
    palette: typeof s.palette === "string" && s.palette ? s.palette : undefined,
  }),
});
function StoreHome() { const { q } = Route.useSearch(); const id = useStore().theme.id; return id === "poripati" ? <PoripatiHomeBoundary query={q}/> : id === "nogori" ? <NogoriHomeBoundary query={q}/> : <LegacyHomeBoundary query={q}/>; }