import { ArrowUpRight } from "lucide-react";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function SourceLink() {
  const dark = useTheme().theme === "dark";
  return (
    <a
      href="https://github.com/existye4t/skin-fixer"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group hidden h-10 items-center gap-2 rounded-full border px-3 text-sm sm:inline-flex",
        dark ? "border-white/15 text-neutral-300 hover:text-white" : "border-black/10 text-neutral-600 hover:text-black",
      )}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33C3.73 14.91 3.27 13.32 3.27 13.32c-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.89.88 2.35.67.07-.52.28-.88.5-1.08-2.2-.25-4.51-1.1-4.51-4.9 0-1.08.39-1.97 1.02-2.66-.1-.25-.44-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 8 3.47c.85 0 1.7.11 2.5.34 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.69 1.02 1.58 1.02 2.66 0 3.81-2.32 4.64-4.53 4.89.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      GitHub
      <ArrowUpRight size={14} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
}
