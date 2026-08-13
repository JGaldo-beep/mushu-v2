import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 9;
const BAR_WIDTH = 2.5;
const BAR_GAP = 3.5;
const MIN_H = 2.5;
const MAX_H = 16;
const LERP = 0.28;

export function WaveBars({
  level,
  color,
  idle,
  className,
}: {
  level: number;
  color: string;
  idle: boolean;
  className?: string;
}) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const renderedHeights = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, () => MIN_H),
  );
  const levelRef = useRef(level);
  levelRef.current = level;
  const idleRef = useRef(idle);
  idleRef.current = idle;
  const barSeeds = useMemo(
    () => Array.from({ length: BAR_COUNT }, (_, i) => 0.65 + Math.sin(i * 1.7) * 0.22),
    [],
  );

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const targets = new Array<number>(BAR_COUNT);
      if (idleRef.current) {
        // Dead still at rest. A breathing idle animation reads as "the app is doing
        // something", which is exactly what the overlay should not say when it isn't.
        targets.fill(MIN_H);
      } else {
        const lv = Math.max(0, Math.min(1, levelRef.current));
        for (let i = 0; i < BAR_COUNT; i++) {
          const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
          const pulse =
            0.58 +
            Math.sin(now / 86 + i * 0.72) * 0.22 +
            Math.sin(now / 137 + i * 1.31) * 0.14;
          const voice = Math.max(0, Math.min(1, lv * (barSeeds[i] + center * 0.45) * pulse));
          targets[i] = MIN_H + voice * (MAX_H - MIN_H);
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        renderedHeights.current[i] +=
          (targets[i] - renderedHeights.current[i]) * LERP;
        const el = barRefs.current[i];
        if (el) {
          el.style.height = `${renderedHeights.current[i]}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [barSeeds]);

  return (
    <div
      className={cn("flex h-4 items-center justify-center", className)}
      style={{ gap: `${BAR_GAP}px` }}
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const distanceFromCenter = Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
        const opacity = idle ? 0.38 : 0.72 + (1 - distanceFromCenter) * 0.28;
        return (
          <div
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className="rounded-full will-change-[height]"
            style={{
              width: `${BAR_WIDTH}px`,
              height: MIN_H,
              backgroundColor: color,
              opacity,
              boxShadow: idle ? "none" : `0 0 4px ${color}55`,
              transition: "opacity 200ms cubic-bezier(0.33, 1, 0.68, 1)",
            }}
          />
        );
      })}
    </div>
  );
}
