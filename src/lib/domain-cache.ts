const MEM_CACHE = new Map<string, string>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isPlatformHostname(rawHost: string): boolean {
  if (!rawHost) return true;
  const host = rawHost.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host === "ecomsellerbd.com" ||
    (host.endsWith(".ecomsellerbd.com") && host !== "fallback.ecomsellerbd.com")
  );
}

export function cleanHostname(rawHost: string): string {
  if (!rawHost) return "";
  return rawHost
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

export function getCachedDomainStoreCode(hostname: string): string | null {
  const host = cleanHostname(hostname);
  if (!host || isPlatformHostname(host)) return null;

  if (MEM_CACHE.has(host)) {
    return MEM_CACHE.get(host) || null;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`__st_dom_${host}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.code && Date.now() - Number(parsed.ts || 0) < TTL_MS) {
          MEM_CACHE.set(host, parsed.code);
          return parsed.code;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function setCachedDomainStoreCode(hostname: string, code: string) {
  const host = cleanHostname(hostname);
  if (!host || !code || isPlatformHostname(host)) return;

  MEM_CACHE.set(host, code);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`__st_dom_${host}`, JSON.stringify({ code, ts: Date.now() }));
    } catch {
      // ignore
    }
  }
}
