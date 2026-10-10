import { useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

import { useMotionSetting } from "@/lib/motion";

interface MagneticWrapperProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

const SPRING = { stiffness: 280, damping: 22, mass: 0.5 };

export function MagneticWrapper({ children, strength = 7, className }: MagneticWrapperProps) {
  const { reduced } = useMotionSetting();
  const ref = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);

  // MotionValue.set() bypasses React renders — no RAF throttle needed here.
  // useCallback avoids allocating new function objects on every render.
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    rawX.set((dx / (rect.width / 2)) * strength);
    rawY.set((dy / (rect.height / 2)) * strength);
  }, [reduced, rawX, rawY, strength]);

  const handleMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return (
    <motion.div
      ref={ref}
      style={reduced ? {} : { x, y }}
      whileTap={reduced ? {} : { scale: 0.96 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}
