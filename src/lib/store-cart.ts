/** Per-store cart persisted in localStorage (no cart page — merged into checkout). */
export type CartLine = { listingId: string; qty: number };

const EVT = "store-cart-change";
const key = (code: string) => `store-cart:${code}`;

export function readCart(code: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(code));
    const arr = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(arr)
      ? arr.filter((l) => l && typeof l.listingId === "string" && Number(l.qty) > 0)
      : [];
  } catch {
    return [];
  }
}

function write(code: string, lines: CartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(code), JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(EVT, { detail: code }));
}

export function addToCart(code: string, listingId: string, qty = 1) {
  const lines = readCart(code);
  const found = lines.find((l) => l.listingId === listingId);
  if (found) found.qty += qty;
  else lines.push({ listingId, qty });
  write(code, lines);
}

export function setCartQty(code: string, listingId: string, qty: number) {
  const lines = readCart(code)
    .map((l) => (l.listingId === listingId ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  write(code, lines);
}

export function removeFromCart(code: string, listingId: string) {
  write(code, readCart(code).filter((l) => l.listingId !== listingId));
}

export function clearCart(code: string) {
  write(code, []);
}

export function onCartChange(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}

export const bdt = (n: number) => `৳${Number(n || 0).toLocaleString("en-US")}`;
