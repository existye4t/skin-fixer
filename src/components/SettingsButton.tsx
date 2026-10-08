import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useMotionSetting } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function SettingsButton() {
  const { t } = useI18n();
  const { reduced, setReduced } = useMotionSetting();
  const dark = useTheme().theme === "dark";
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t.settings}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border",
          dark ? "border-white/15 hover:bg-white/10" : "border-black/10 bg-white/70 hover:bg-white",
        )}
      >
        <Settings size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/50" aria-label={t.close} onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: reduced ? 0.01 : 0.16 }}
              className={cn("relative w-full max-w-sm rounded-3xl border p-5", dark ? "border-white/10 bg-[#0b0b0b] text-white" : "border-black/10 bg-[#f7f8fb]")}
            >
              <h2 className="text-lg font-light">{t.settings}</h2>
              <button type="button" onClick={() => setReduced(!reduced)} className="mt-4 flex w-full items-center justify-between text-sm">
                <span>{t.reduceMotion}</span>
                <span className={cn("text-xs", dark ? "text-neutral-400" : "text-neutral-500")}>{reduced ? t.on : t.off}</span>
              </button>
              <button type="button" onClick={() => setOpen(false)} className="mt-5 text-sm text-neutral-500">{t.close}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
