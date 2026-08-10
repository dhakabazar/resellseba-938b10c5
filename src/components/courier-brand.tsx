import steadfastMark from "@/assets/couriers/steadfast-mark.png";
import steadfastWordmark from "@/assets/couriers/steadfast-wordmark.png";
import pathaoMark from "@/assets/couriers/pathao-mark.png";
import pathaoWordmark from "@/assets/couriers/pathao-wordmark.png";
import carrybeeMark from "@/assets/couriers/carrybee-mark.png";
import carrybeeWordmark from "@/assets/couriers/carrybee-wordmark.png";

export type CourierProvider = "steadfast" | "pathao" | "carrybee";

type Brand = {
  id: CourierProvider;
  label: string;
  mark: string;
  wordmark: string;
};

export const COURIER_BRANDS: Record<CourierProvider, Brand> = {
  steadfast: {
    id: "steadfast",
    label: "Steadfast Courier",
    mark: steadfastMark,
    wordmark: steadfastWordmark,
  },
  pathao: {
    id: "pathao",
    label: "Pathao Courier",
    mark: pathaoMark,
    wordmark: pathaoWordmark,
  },
  carrybee: {
    id: "carrybee",
    label: "CarryBee",
    mark: carrybeeMark,
    wordmark: carrybeeWordmark,
  },
};

export const COURIER_LIST = [
  COURIER_BRANDS.steadfast,
  COURIER_BRANDS.pathao,
  COURIER_BRANDS.carrybee,
];

export function courierBrand(provider?: string | null): Brand | null {
  if (!provider) return null;
  const key = String(provider).trim().toLowerCase().replace(/[\s_-]+/g, "");
  const alias: Record<string, CourierProvider> = {
    steadfast: "steadfast",
    steadfastcourier: "steadfast",
    pathao: "pathao",
    pathaocourier: "pathao",
    carrybee: "carrybee",
    carybee: "carrybee",
  };
  const id = alias[key];
  return id ? COURIER_BRANDS[id] : null;
}

export function courierLabel(provider?: string | null) {
  return courierBrand(provider)?.label ?? (provider ? String(provider) : "—");
}

/** Logo image only. `variant="mark"` = square icon, `variant="wordmark"` = full logo. */
export function CourierLogo({
  provider,
  variant = "mark",
  className,
  size = 20,
}: {
  provider?: string | null;
  variant?: "mark" | "wordmark";
  className?: string;
  size?: number;
}) {
  const brand = courierBrand(provider);
  if (!brand) return null;
  const src = variant === "wordmark" ? brand.wordmark : brand.mark;
  return (
    <img
      src={src}
      alt={`${brand.label} logo`}
      loading="lazy"
      className={className ?? "object-contain"}
      style={variant === "wordmark" ? { height: size, width: "auto" } : { height: size, width: size }}
    />
  );
}

/** Logo + name, the standard way a courier is shown across the app. */
export function CourierBadge({
  provider,
  size = 18,
  className,
  labelClassName,
  showLabel = true,
}: {
  provider?: string | null;
  size?: number;
  className?: string;
  labelClassName?: string;
  showLabel?: boolean;
}) {
  const brand = courierBrand(provider);
  if (!brand)
    return (
      <span className={labelClassName ?? "text-xs text-muted-foreground"}>
        {provider ? String(provider) : "—"}
      </span>
    );
  return (
    <span className={className ?? "inline-flex items-center gap-1.5 min-w-0"}>
      <CourierLogo provider={brand.id} size={size} />
      {showLabel && (
        <span className={labelClassName ?? "truncate text-xs font-semibold"}>{brand.label}</span>
      )}
    </span>
  );
}
