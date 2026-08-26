import bkashLogo from "@/assets/payments/bkash.png";
import nagadLogo from "@/assets/payments/nagad.png";
import rocketLogo from "@/assets/payments/rocket.png";
import otherLogo from "@/assets/payments/other.png";
import sslcommerzLogo from "@/assets/payments/sslcommerz.png";
import shurjopayLogo from "@/assets/payments/shurjopay.png";
import epsLogo from "@/assets/payments/eps.png";
import aamarpayLogo from "@/assets/payments/aamarpay.png";
import epaysebaLogo from "@/assets/payments/epayseba.png";

/**
 * Hardcoded payment brand logos (transparent PNG, uniform square).
 * Keyed by manual method value and by automatic gateway provider,
 * so a single lookup covers both families.
 */
export const PAYMENT_LOGOS: Record<string, string> = {
  bkash: bkashLogo,
  nagad: nagadLogo,
  rocket: rocketLogo,
  other: otherLogo,
  bank: otherLogo,
  cash: otherLogo,
  sslcommerz: sslcommerzLogo,
  shurjopay: shurjopayLogo,
  eps: epsLogo,
  aamarpay: aamarpayLogo,
  epayseba: epaysebaLogo,
};

export function paymentLogo(key?: string | null): string | null {
  if (!key) return null;
  const k = String(key).trim().toLowerCase().replace(/[\s_-]+/g, "");
  return PAYMENT_LOGOS[k] ?? null;
}

/** Logo tile. Falls back to `null` so callers can render their own icon.
 *  Brand logos are wide (landscape) content painted onto square canvases with
 *  heavy vertical padding, so `fit="cover"` in a landscape box shows the actual
 *  mark much larger than the old square `contain` tile. */
export function PaymentLogo({
  method,
  size = 36,
  width,
  height,
  fit = "contain",
  className,
  alt,
}: {
  method?: string | null;
  size?: number;
  width?: number;
  height?: number;
  fit?: "contain" | "cover";
  className?: string;
  alt?: string;
}) {
  const src = paymentLogo(method);
  if (!src) return null;
  const w = width ?? size;
  const h = height ?? size;
  return (
    <img
      src={src}
      alt={alt ?? `${method} logo`}
      loading="eager"
      decoding="async"
      width={w}
      height={h}
      className={className ?? "shrink-0 rounded-lg"}
      style={{ width: w, height: h, objectFit: fit }}
    />
  );
}
