import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useCopy } from "@/i18n";
import { shellCopy } from "@/i18n/shell";
import type { ThemePref } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; icon: LucideIcon }[] = [
  { value: "system", icon: Monitor },
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
];

export function ThemeToggle({
  value,
  onChange,
}: {
  value: ThemePref;
  onChange: (next: ThemePref) => void;
}) {
  const t = useCopy(shellCopy);
  return (
    <div
      role="group"
      aria-label={t.theme}
      className="grid grid-cols-3 gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
    >
      {OPTIONS.map(({ value: v, icon: Icon }) => {
        const active = value === v;
        const label = t.themes[v];
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            aria-label={t.themeOption(label)}
            title={label}
            onClick={() => onChange(v)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
