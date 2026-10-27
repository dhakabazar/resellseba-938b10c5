/** Presentation only; never changes availability or inventory validation. */
export function productStockVisible(showStock: boolean, isAdmin = false, loading = false): boolean {
  return isAdmin || (!loading && showStock);
}