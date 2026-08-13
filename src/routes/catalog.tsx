import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CatalogBrandProvider, CatalogFooter, useLoadCatalogBrand } from "@/components/catalog/shell";
import { PublicHeader } from "@/components/public-header";

export const Route = createFileRoute("/catalog")({
  component: CatalogLayout,
});

function CatalogLayout() {
  const brand = useLoadCatalogBrand();
  return (
    <CatalogBrandProvider value={brand}>
      <div className="min-h-screen bg-background text-foreground">
        <PublicHeader siteName={brand.siteName} logoUrl={brand.logoUrl} content={brand.landingContent ?? undefined} />
        <main>
          <Outlet />
        </main>
        <CatalogFooter />
      </div>
    </CatalogBrandProvider>
  );
}
