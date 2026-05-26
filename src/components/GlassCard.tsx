import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  variant?: "default" | "strong" | "subtle";
}

const VARIANT_BG: Record<NonNullable<GlassCardProps["variant"]>, string> = {
  default: "var(--card)",
  strong: "var(--card)",
  subtle: "color-mix(in oklab, var(--card) 50%, transparent)",
};

export function GlassCard({
  children,
  className,
  style,
  onClick,
  variant = "default",
}: GlassCardProps) {
  return (
    <div
      className={cn("rounded-2xl", className)}
      style={{
        background: VARIANT_BG[variant],
        border: "0.5px solid var(--border)",
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
