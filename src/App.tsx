import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { I18nProvider } from "@/lib/i18n";
import { MotionProvider, useMotionSetting } from "@/lib/motion";
import { ThemeProvider } from "@/lib/theme";
import { Fix } from "@/pages/Fix";
import { Home } from "@/pages/Home";

const ease = [0.22, 1, 0.36, 1] as const;

function Stage({ children }: { children: ReactNode }) {
  const { reduced } = useMotionSetting();
  return (
    <motion.div
      className="min-h-screen"
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 1 } : { opacity: 0, y: -12 }}
      transition={{ duration: reduced ? 0.01 : 0.22, ease }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Stage><Home /></Stage>} />
        <Route path="/fix" element={<Stage><Fix /></Stage>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
      <I18nProvider>
        <BrowserRouter basename="/skin-fixer">
          <AnimatedRoutes />
        </BrowserRouter>
      </I18nProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
