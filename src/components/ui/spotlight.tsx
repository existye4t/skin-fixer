import { useRef, useState, useCallback, type ReactNode, type CSSProperties } from "react";

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
  const [pos, setPos] = useState({ x: "50%", y: "50%" });
  const [visible, setVisible] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: `${e.clientX - rect.left}px`,
      y: `${e.clientY - rect.top}px`,
    });
  }, [reduced]);

  const handleMouseEnter = useCallback(() => {
    if (!reduced) setVisible(true);
  }, [reduced]);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  const spotColor = dark ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)";

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
