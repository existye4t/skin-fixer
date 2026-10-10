import { useRef, useState, useCallback, useEffect, type ReactNode, type CSSProperties } from "react";

import { useMotionSetting } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface SpotlightPanelProps {
  children: ReactNode;
  className?: string;
  dark: boolean;
  /** Spotlight circle radius in px (default 220) */
  radius?: number;
  /** Overlay opacity when hovered (default 1 — the gradient itself is low-opacity) */
  style?: CSSProperties;
}

export function SpotlightPanel({ children, className, dark, radius = 220, style }: SpotlightPanelProps) {
  const { reduced } = useMotionSetting();
  const ref = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);
  const [pos, setPos] = useState({ x: "50%", y: "50%" });
  const [visible, setVisible] = useState(false);

  // Cancel any pending RAF when the component unmounts
  useEffect(() => () => cancelAnimationFrame(rafId.current), []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    // Capture event coordinates before the synthetic event is recycled
    const { clientX, clientY } = e;
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setPos({
        x: `${clientX - rect.left}px`,
        y: `${clientY - rect.top}px`,
      });
    });
  }, [reduced]);

  const handleMouseEnter = useCallback(() => {
    if (!reduced) setVisible(true);
  }, [reduced]);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  // Dark: white at low opacity; Light: ink (near-black) at higher opacity — paper bg needs more contrast
  const spotColor = dark ? "rgba(255,255,255,0.06)" : "rgba(18,20,26,0.11)";

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* spotlight overlay — pointer-events-none so it never blocks interaction */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: visible ? 1 : 0,
          background: `radial-gradient(circle ${radius}px at ${pos.x} ${pos.y}, ${spotColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}
