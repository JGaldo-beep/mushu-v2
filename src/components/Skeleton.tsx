import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-[10px]", className)}
      style={{
        background: "color-mix(in oklab, var(--foreground) 5%, transparent)",
        border: "1px solid var(--glass-edge)",
        ...style,
      }}
    />
  );
}
