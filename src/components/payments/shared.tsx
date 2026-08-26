import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

/** Small shared primitives for the payment settings screens. */

export const field =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

export function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children} {required && <span className="text-destructive">*</span>}
    </span>
  );
}

export function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      className={"inline-block h-2 w-2 rounded-full " + (on ? "bg-success" : "bg-muted-foreground/40")}
      aria-hidden
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
        (checked ? "bg-primary" : "bg-muted-foreground/30")
      }
    >
      <span
        className={
          "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all " +
          (checked ? "left-[22px]" : "left-0.5")
        }
      />
    </button>
  );
}

export function SecretInput({
  value,
  onChange,
  placeholder,
  secret,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  multiline?: boolean;
}) {
  const [show, setShow] = React.useState(false);

  if (multiline)
    return (
      <div className="relative">
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className={field + (secret && !show ? " [-webkit-text-security:disc]" : "") + " font-mono text-[11px]"}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            aria-label={show ? "Hide value" : "Show value"}
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );

  return (
    <div className="relative">
      <input
        type={secret && !show ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={field + (secret ? " pr-9" : "")}
      />
      {secret && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide value" : "Show value"}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

