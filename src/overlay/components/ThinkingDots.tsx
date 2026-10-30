import { useCopy } from "@/i18n";
import { overlayCopy } from "@/i18n/overlay";
import { cn } from "@/lib/utils";

export function ThinkingDots({ className }: { className?: string }) {
  const t = useCopy(overlayCopy);
  return (
    <div
      className={cn("inline-flex items-center justify-center gap-1", className)}
      role="status"
      aria-label={t.processing}
    >
      <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
      <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
      <span className="size-1 animate-bounce rounded-full bg-primary" />
    </div>
  );
}
