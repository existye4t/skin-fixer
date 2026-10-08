import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type MotionValue = { reduced: boolean; setReduced: (value: boolean) => void };

const MotionContext = createContext<MotionValue | null>(null);
const KEY = "skin-fixer-motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReducedState] = useState(() => localStorage.getItem(KEY) === "1");
  useEffect(() => {
    localStorage.setItem(KEY, reduced ? "1" : "0");
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);
  return (
    <MotionContext.Provider value={{ reduced, setReduced: setReducedState }}>
      {children}
    </MotionContext.Provider>
  );
}

export function useMotionSetting() {
  const value = useContext(MotionContext);
  if (!value) throw new Error("useMotionSetting outside provider");
  return value;
}
