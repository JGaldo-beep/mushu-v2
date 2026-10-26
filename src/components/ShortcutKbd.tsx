import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Key({ children, size = "md" }: { children: ReactNode; size?: "sm" | "md" }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono",
        size === "md" ? "h-7 min-w-7 px-2 text-[12px]" : "h-5 min-w-5 px-1.5 text-[10px]",
      )}
      style={{
        background: "var(--glass-surface-strong)",
        border: "1px solid var(--glass-edge)",
        boxShadow: "var(--glass-highlight), 0 1px 1px rgba(0,0,0,0.25)",
        color: "var(--text-secondary)",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </kbd>
  );
}

export function ShortcutKbd({
  keys,
  size = "md",
  className,
}: {
  keys: string[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="inline-flex items-center gap-1.5">
          <Key size={size}>{k}</Key>
          {i < keys.length - 1 && (
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: size === "md" ? "11px" : "10px",
                fontFamily: "'Space Mono', monospace",
              }}
            >
              +
            </span>
          )}
        </span>
      ))}
    </span>
  );
}
