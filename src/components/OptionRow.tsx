import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function OptionRow({
  label,
  checked,
  onLabel,
  offLabel,
  onChange,
}: {
  label: string;
  checked: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (checked: boolean) => void;
}) {
  const dark = useTheme().theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2.5 text-left text-sm transition-opacity duration-200 hover:opacity-70"
    >
      <span className="font-light">{label}</span>
      <span className="flex items-center gap-2">
        <span className={cn("text-[11px] tracking-wide", dark ? "text-neutral-500" : "text-neutral-400")}>
          {checked ? onLabel : offLabel}
        </span>
        <span
          className={cn(
            "relative h-5 w-9 rounded-full border transition-colors",
            checked
              ? dark
                ? "border-white bg-white"
                : "border-[#12141a] bg-[#12141a]"
              : dark
                ? "border-white/20 bg-transparent"
                : "border-black/15 bg-transparent",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-200 ease-out",
              checked ? "translate-x-4" : "translate-x-0.5",
              checked ? (dark ? "bg-black" : "bg-white") : dark ? "bg-white/70" : "bg-[#12141a]/70",
            )}
          />
        </span>
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const dark = useTheme().theme === "dark";
  return (
    <div className="py-2.5">
      <p className={cn("mb-2 text-sm font-light", dark ? "text-neutral-300" : "text-neutral-700")}>{label}</p>
      <div className={cn("grid grid-cols-3 rounded-full border p-1", dark ? "border-white/15" : "border-black/10")}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-full px-2 py-1.5 text-xs capitalize transition-colors",
                active
                  ? dark
                    ? "bg-white text-black"
                    : "bg-[#12141a] text-white"
                  : dark
                    ? "text-neutral-400 hover:text-white"
                    : "text-neutral-500 hover:text-black",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
