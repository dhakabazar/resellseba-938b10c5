/** Shared, prettier form primitives used by the add / edit order modals. */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1.5 rounded-full bg-primary" />
      <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-foreground/80">{children}</span>
    </div>
  );
}


export function MoneyField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
}: {
  label: string;
  hint?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        {hint && <span className="text-[11px] font-medium text-muted-foreground/70">{hint}</span>}
      </div>
      <div
        className={`flex items-center overflow-hidden rounded-xl border bg-background transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 ${
          invalid ? "border-destructive" : ""
        } ${disabled ? "opacity-70" : ""}`}
      >
        <span className="grid h-10 w-9 shrink-0 place-items-center border-r bg-muted/40 text-[13px] font-bold text-muted-foreground">
          ৳
        </span>
        <input
          inputMode="numeric"
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full bg-transparent px-3 text-[13px] font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}


/** Advance receiver toggle (admin vs reseller). */
export function AdvanceByToggle({
  value,
  onChange,
}: {
  value: "admin" | "reseller";
  onChange: (v: "admin" | "reseller") => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-semibold">Who received the advance?</div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["admin", "Admin"],
            ["reseller", "Reseller"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-xl border-2 px-3 py-2.5 text-[13px] font-bold transition-all ${
              value === v
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-muted bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >

            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
