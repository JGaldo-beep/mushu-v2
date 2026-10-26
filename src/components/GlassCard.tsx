import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  variant?: "default" | "strong" | "subtle";
}

// Translucent surfaces over the near-black ground; see the --glass-* tokens in
// styles/design-tokens.css.
const VARIANT_STYLE: Record<NonNullable<GlassCardProps["variant"]>, CSSProperties> = {
  default: {
    background: "var(--glass-surface)",
    border: "1px solid var(--glass-edge)",
    boxShadow: "var(--glass-highlight), var(--elev-shadow)",
  },
  strong: {
    background: "var(--glass-surface-strong)",
    border: "1px solid var(--glass-edge)",
    boxShadow: "var(--glass-highlight), var(--elev-shadow)",
  },
  subtle: {
    background: "transparent",
    border: "1px solid var(--glass-edge)",
  },
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
      className={cn("rounded-xl", className)}
      style={{
        ...VARIANT_STYLE[variant],
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
