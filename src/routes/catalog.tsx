import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CatalogBrandProvider, CatalogFooter, CatalogHeader, useLoadCatalogBrand } from "@/components/catalog/shell";

export const Route = createFileRoute("/catalog")({
  component: CatalogLayout,
});

function CatalogLayout() {
  const brand = useLoadCatalogBrand();
  return (
    <CatalogBrandProvider value={brand}>
      <div className="min-h-screen bg-background text-foreground">
        <CatalogHeader />
        <main>
          <Outlet />
        </main>
        <CatalogFooter />
      </div>
    </CatalogBrandProvider>
  );
}
