/**
 * Shared reseller profile picture.
 * Falls back to initials when no image is uploaded, so every list/report
 * can render the same visual identity without extra branching.
 */
export function ResellerAvatar({
  url,
  name,
  size = 40,
  className = "",
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = (name ?? "").trim().slice(0, 2) || "R";
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) };

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name} profile picture` : "Profile picture"}
        loading="lazy"
        style={style}
        className={"shrink-0 rounded-full border object-cover " + className}
      />
    );
  }
  return (
    <div
      style={style}
      className={
        "grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold uppercase text-primary " + className
      }
    >
      {initials}
    </div>
  );
}
