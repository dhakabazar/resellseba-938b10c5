/**
 * Central icon registry — everything ships inside the app bundle.
 * No CDN, no icon font, no third-party icon server.
 *
 * - Vector UI icons: `lucide-react` (bundled npm package, tree-shaken into our JS).
 * - Brand logos (couriers): local PNG files in `src/assets/`.
 *
 * Add every new dynamic/name-based icon here so there is a single source of truth.
 */
import {
  Boxes,
  Truck,
  Wallet,
  Megaphone,
  Globe,
  BarChart3,
  ShieldCheck,
  Sparkles,
  ClipboardList,
  Send,
  PackageCheck,
  Coins,
  BanknoteArrowDown,
  ShoppingBag,
  Users,
  Layers,
  type LucideIcon,
} from "lucide-react";

/** Name → component map used for content-driven icons (landing page editor etc.). */
export const APP_ICONS: Record<string, LucideIcon> = {
  Boxes,
  Truck,
  Wallet,
  Megaphone,
  Globe,
  BarChart3,
  ShieldCheck,
  Sparkles,
  ClipboardList,
  Send,
  PackageCheck,
  Coins,
  BanknoteArrowDown,
  ShoppingBag,
  Users,
  Layers,
};

/** Selectable icon names (admin dropdowns). */
export const APP_ICON_NAMES = Object.keys(APP_ICONS);

/** Resolve a stored icon name, with a safe local fallback. */
export function appIcon(name?: string | null): LucideIcon {
  return (name && APP_ICONS[name]) || Sparkles;
}

export type { LucideIcon };

/** Local brand logo assets (bundled PNGs). */
export { COURIER_BRANDS, COURIER_LIST, courierBrand } from "@/components/courier-brand";
