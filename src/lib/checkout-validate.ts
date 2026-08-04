/**
 * Customer checkout field rules (shared by the storefront checkout form).
 * Kept tiny and dependency free so it runs on every theme.
 */

/** Letters (Latin + Bangla) and single spaces only — no digits or symbols. */
export function sanitizeName(raw: string): string {
  return raw.replace(/[^A-Za-z\u0980-\u09FF\s]/g, "").replace(/\s{2,}/g, " ").trimStart();
}

export function nameError(raw: string): string | null {
  const v = sanitizeName(raw).trim();
  if (v.length < 3) return "Please write your full name (letters only).";
  return null;
}

/**
 * Normalizes any Bangladeshi mobile input to the local 11 digit form:
 * +8801XXXXXXXXX / 8801XXXXXXXXX / 1XXXXXXXXX -> 01XXXXXXXXX
 */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(3);
  else if (d.startsWith("88") && d.length > 11) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  return d.slice(0, 11);
}

export function phoneError(raw: string): string | null {
  const v = normalizePhone(raw);
  if (v.length !== 11) return "Mobile number must be exactly 11 digits.";
  if (!/^01[3-9]\d{8}$/.test(v)) return "Enter a valid number starting with 01.";
  return null;
}

export function addressError(raw: string): string | null {
  return raw.trim().length < 10 ? "Write your full address so the courier can find you." : null;
}
