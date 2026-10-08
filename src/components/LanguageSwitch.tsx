import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  const dark = useTheme().theme === "dark";

  return (
    <div
      className={cn(
        "relative grid h-10 w-[4.6rem] grid-cols-2 rounded-full border p-1 text-[11px] tracking-[0.14em]",
        dark ? "border-white/15 bg-white/5" : "border-black/10 bg-white/70",
      )}
      role="group"
      aria-label="Language"
    >
      <span
        className={cn(
          "absolute top-1 left-1 h-8 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ease-out",
          dark ? "bg-white" : "bg-[#12141a]",
          lang === "en" ? "translate-x-full" : "translate-x-0",
        )}
      />
      {(["tr", "en"] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={cn(
            "relative z-10 uppercase transition-colors",
            lang === code ? (dark ? "text-black" : "text-white") : dark ? "text-neutral-400" : "text-neutral-500",
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
