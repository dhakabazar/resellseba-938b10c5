/**
 * Reseller phone and text search matching utility.
 * Supports Bangladeshi number normalizations (+88, 88, 01, spacing, etc.)
 */

export function normalizeSearchPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("880")) digits = digits.slice(2); // "8801..." -> "01..."
  else if (digits.startsWith("88") && digits.length > 10) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
  return digits;
}

export function matchesPhoneSearch(storedPhone: string | null | undefined, query: string): boolean {
  if (!storedPhone || !query) return false;
  const rawQuery = query.trim();
  if (!rawQuery) return false;

  const storedStr = String(storedPhone).toLowerCase();
  const queryStr = rawQuery.toLowerCase();

  // Direct substring check
  if (storedStr.includes(queryStr)) return true;

  const cleanStored = storedStr.replace(/\D/g, "");
  const cleanQuery = queryStr.replace(/\D/g, "");

  if (cleanQuery.length > 0) {
    if (cleanStored.includes(cleanQuery)) return true;

    const normStored = normalizeSearchPhone(storedPhone);
    const normQuery = normalizeSearchPhone(rawQuery);

    if (normStored && normQuery && normStored.includes(normQuery)) return true;
    if (normStored && cleanQuery && normStored.includes(cleanQuery)) return true;
    if (cleanStored && normQuery && cleanStored.includes(normQuery)) return true;
  }

  return false;
}

export function matchesResellerSearch(
  reseller: {
    business_name?: string | null;
    code?: string | null;
    contact_phone?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (reseller.business_name && reseller.business_name.toLowerCase().includes(q)) return true;
  if (reseller.code && reseller.code.toLowerCase().includes(q)) return true;
  if (reseller.email && reseller.email.toLowerCase().includes(q)) return true;

  const phone = reseller.contact_phone || reseller.phone;
  if (phone && matchesPhoneSearch(phone, query)) return true;

  return false;
}
