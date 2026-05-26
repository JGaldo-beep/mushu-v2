import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GlassSelectOption {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  options: GlassSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function GlassSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className,
}: GlassSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={className}
        style={{
          background: "var(--card)",
          border: "0.5px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        style={{
          background: "var(--popover)",
          border: "0.5px solid var(--border)",
          color: "var(--popover-foreground)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
        }}
      >
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
