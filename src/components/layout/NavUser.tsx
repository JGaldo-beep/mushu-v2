import { ChevronsUpDown, CreditCard, LogOut, Moon, Sparkles, Sun, User } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { tauri } from "@/lib/tauri";
import type { NavSection } from "@/lib/types";

interface NavUserProps {
  onNavigate: (next: NavSection) => void;
}

export function NavUser({ onNavigate }: NavUserProps) {
  const { state, refresh } = useSettings();
  const { resolved, toggle } = useTheme();
  const account = state?.account ?? null;
  const displayName = account?.user.full_name || account?.user.email || "Mushu User";
  const planLabel = account?.entitlement?.status
    ? `Plan ${account.entitlement.status}`
    : account
      ? "Account connected"
      : "Free plan";
  const initials = initialsFromAccount(account?.user.full_name || account?.user.email);
  const nextThemeLabel = resolved === "dark" ? "Light mode" : "Dark mode";
  const ThemeIcon = resolved === "dark" ? Sun : Moon;

  const logout = async () => {
    try {
      await tauri.logout();
      await refresh();
      toast.success("Signed out");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-accent"
          tooltip="Account"
          style={{ color: "var(--muted-foreground)" }}
        >
          <span
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: "color-mix(in oklab, var(--primary) 14%, transparent)",
              border: "0.5px solid color-mix(in oklab, var(--primary) 42%, transparent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {account?.user.avatar_url ? (
              <img
                src={account.user.avatar_url}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : account ? (
              <span
                style={{
                  color: "var(--primary)",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                {initials}
              </span>
            ) : (
              <User
                style={{ width: "14px", height: "14px", color: "var(--primary)" }}
                strokeWidth={2.25}
              />
            )}
          </span>
          <span
            className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
            style={{ minWidth: 0 }}
          >
            <span
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "9px",
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {planLabel}
            </span>
          </span>
          <ChevronsUpDown
            className="ml-auto group-data-[collapsible=icon]:hidden"
            style={{ width: "13px", height: "13px", color: "var(--muted-foreground)" }}
            strokeWidth={2}
          />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-60 p-1.5"
        style={{
          background: "var(--popover)",
          border: "0.5px solid var(--border)",
          borderRadius: "calc(var(--radius) * 0.8)",
        }}
      >
        <div style={{ padding: "8px 10px 6px" }}>
          <div
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--foreground)",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "9px",
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: "2px",
            }}
          >
            {planLabel}
          </div>
        </div>

        <Divider />

        <MenuItem icon={ThemeIcon} label={nextThemeLabel} onClick={toggle} />

        <Divider />

        <MenuItem icon={Sparkles} label="Profile" onClick={() => onNavigate("account")} />
        <MenuItem icon={CreditCard} label="Plans" onClick={() => onNavigate("account")} />

        <Divider />

        <MenuItem icon={LogOut} label="Sign out" onClick={() => void logout()} />
      </PopoverContent>
    </Popover>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{ height: "0.5px", background: "var(--border)", margin: "4px 0" }}
    />
  );
}

function initialsFromAccount(value?: string | null): string {
  if (!value) return "M";
  return (
    value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

interface MenuItemProps {
  icon: typeof User;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({ icon: Icon, label, onClick, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "7px 10px",
        background: "transparent",
        border: "none",
        borderRadius: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "'Geist Variable', sans-serif",
        fontSize: "12.5px",
        fontWeight: 500,
        color: "var(--foreground)",
        textAlign: "left",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          e.currentTarget.style.background =
            "color-mix(in oklab, var(--accent) 60%, transparent)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon
        style={{ width: "14px", height: "14px", color: "var(--muted-foreground)" }}
        strokeWidth={2}
      />
      <span>{label}</span>
    </button>
  );
}
