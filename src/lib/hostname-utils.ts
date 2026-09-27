// Pure hostname helpers — no server-only imports, safe from client components too.

// Common two-part public suffixes so "abc.com.bd" is recognised as the apex
// (not "com.bd"), and "shop.abc.com" is correctly seen as a subdomain rather
// than an apex of its own. Not a full public-suffix list, but covers the
// TLDs actually used by this platform's resellers.
const COMPOUND_TLDS = new Set([
  "com.bd", "net.bd", "org.bd", "gov.bd", "edu.bd", "ac.bd", "co.bd",
  "co.uk", "org.uk", "me.uk", "ltd.uk",
  "com.au", "net.au", "org.au",
  "co.in", "co.jp", "co.nz", "co.za",
  "com.sg", "com.pk", "com.my",
]);

/** True when `hostname` is a bare root/apex domain (e.g. "abc.com", "abc.com.bd"),
 * false for anything with an extra label in front (e.g. "www.abc.com", "shop.abc.com"). */
export function isApexHostname(hostname: string): boolean {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) return true;
  const lastTwo = labels.slice(-2).join(".");
  if (labels.length === 3 && COMPOUND_TLDS.has(lastTwo)) return true;
  if (labels.length === 2 && !COMPOUND_TLDS.has(lastTwo)) return true;
  return false;
}

/** The label a DNS provider's "Host / Name" field expects for this hostname:
 * "@" for the apex, otherwise its leading label (e.g. "www", "shop"). */
export function dnsHostLabel(hostname: string): string {
  return isApexHostname(hostname) ? "@" : hostname.split(".")[0];
}

/** Groups an apex hostname with its auto-added "www." counterpart under one
 * key, so the UI can show them as a single domain card instead of two. */
export function domainGroupKey(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

/** Groups rows into one card per base domain (apex + its "www." row together),
 * apex/non-www first within each group. Preserves first-seen group order. */
export function groupDomainRows<T extends { hostname: string }>(rows: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = domainGroupKey(r.hostname);
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => Number(a.hostname.startsWith("www.")) - Number(b.hostname.startsWith("www.")));
  }
  return [...map.values()];
}
