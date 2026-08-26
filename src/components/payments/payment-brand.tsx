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

/** Square logo tile. Falls back to `null` so callers can render their own icon. */
export function PaymentLogo({
  method,
  size = 36,
  className,
  alt,
}: {
  method?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const src = paymentLogo(method);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt ?? `${method} logo`}
      loading="lazy"
      width={size}
      height={size}
      className={className ?? "shrink-0 rounded-lg object-contain"}
      style={{ width: size, height: size }}
    />
  );
}
