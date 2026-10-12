/** Compare-at values are display-only; order totals always use selling_price. */
export function productDiscount(sellingPrice: number, previousPrice: unknown) {
  const regular = Number(previousPrice);
  if (!Number.isFinite(regular) || !Number.isFinite(sellingPrice) || sellingPrice < 0 || regular <= sellingPrice) return null;
  return { regular, saving: regular - sellingPrice, percent: Math.round((regular - sellingPrice) / regular * 100) };
}

export function validPreviousPrice(value: string, sellingPrice: number) {
  return value.trim() === "" || (Number.isFinite(Number(value)) && Number(value) > sellingPrice);
}

export function soldRange(minValue: string, maxValue: string): [number, number] {
  const parse = (value: string, fallback: number) => value.trim() && Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback;
  const min = parse(minValue, 15);
  const max = parse(maxValue, 214);
  return [Math.min(min, max), Math.max(min, max)];
}

export function randomSoldCount(min: number, max: number, random: number) {
  return min + Math.floor(Math.max(0, Math.min(random, 1 - Number.EPSILON)) * (max - min + 1));
}