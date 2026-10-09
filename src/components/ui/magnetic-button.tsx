import { useRef, type ReactNode } from "react";
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

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    // normalise to ±1 within element bounds, then scale by strength
    rawX.set((dx / (rect.width / 2)) * strength);
    rawY.set((dy / (rect.height / 2)) * strength);
  }

  function handleMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

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
