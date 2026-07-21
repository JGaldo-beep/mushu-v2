import { Bot, Mic, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({
  label,
  isAgent,
  className,
}: {
  label: string;
  isAgent: boolean;
  className?: string;
}) {
  const Icon: LucideIcon = isAgent ? Bot : Mic;
  return (
    <div
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium leading-none tracking-[-0.01em]",
        "overlay-mode-pop",
        className,
      )}
      style={{
        background: "rgba(255, 255, 255, 0.07)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
      }}
    >
      <Icon
        className="size-3.5 shrink-0"
        style={{ color: "rgba(255, 255, 255, 0.72)" }}
        strokeWidth={2.25}
      />
      <span className="overlay-mode-chip-label truncate">{label}</span>
    </div>
  );
}
