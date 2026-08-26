import { MailCheck, MailX, ShieldCheck, Smartphone, SmartphoneNfc } from "lucide-react";

/**
 * One source of truth for "email / mobile verified" chips.
 *
 * Colour logic (kept intentionally calm):
 *  - verified            → success tint
 *  - missing + required  → destructive tint (this actually blocks the reseller)
 *  - missing, not needed → neutral muted chip, because verification is turned
 *                          off in Advanced settings so it is only information.
 */
export type VerifyFlags = {
  emailVerified: boolean;
  phoneVerified: boolean;
  /** false when the reseller has no phone number saved at all */
  hasPhone?: boolean;
  /** Advanced settings → verification master + per channel */
  requireEmail?: boolean;
  requirePhone?: boolean;
};

const base =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap";
const okCls = "bg-success/10 text-success ring-1 ring-inset ring-success/25";
const dueCls = "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25";
const offCls = "bg-muted text-muted-foreground ring-1 ring-inset ring-border";

function Chip({
  verified,
  required,
  label,
  icon,
  iconOff,
}: {
  verified: boolean;
  required: boolean;
  label: string;
  icon: React.ReactNode;
  iconOff: React.ReactNode;
}) {
  const cls = verified ? okCls : required ? dueCls : offCls;
  return (
    <span
      className={`${base} ${cls}`}
      title={
        verified
          ? `${label} verified`
          : required
            ? `${label} not verified — required, reseller stays blocked`
            : `${label} not verified — verification is off in Advanced settings`
      }
    >
      {verified ? icon : iconOff}
      {label} {verified ? "verified" : "unverified"}
    </span>
  );
}

export function VerifyBadges({
  emailVerified,
  phoneVerified,
  hasPhone = true,
  requireEmail = false,
  requirePhone = false,
}: VerifyFlags) {
  const allDone = emailVerified && (phoneVerified || !hasPhone);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Chip
        verified={emailVerified}
        required={requireEmail}
        label="Email"
        icon={<MailCheck className="h-3 w-3" />}
        iconOff={<MailX className="h-3 w-3" />}
      />
      {hasPhone ? (
        <Chip
          verified={phoneVerified}
          required={requirePhone}
          label="Mobile"
          icon={<SmartphoneNfc className="h-3 w-3" />}
          iconOff={<Smartphone className="h-3 w-3" />}
        />
      ) : (
        <span className={`${base} ${offCls}`} title="No phone number saved">
          <Smartphone className="h-3 w-3" /> No mobile
        </span>
      )}
      {allDone && (
        <span className={`${base} ${okCls}`} title="Every verification step is done">
          <ShieldCheck className="h-3 w-3" /> Fully verified
        </span>
      )}
    </span>
  );
}

/** true when this reseller still owes a verification step that is switched on */
export function verifyPending(f: VerifyFlags): boolean {
  if (f.requireEmail && !f.emailVerified) return true;
  if (f.requirePhone && (f.hasPhone ?? true) && !f.phoneVerified) return true;
  return false;
}
