import { Bot, Home, Settings, Wand2 } from "lucide-react";
import { LogoIcon } from "@/components/LogoIcon";
import { NavUser } from "@/components/layout/NavUser";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useCopy } from "@/i18n";
import { shellCopy } from "@/i18n/shell";
import type { NavSection } from "@/lib/types";

const NAV_ITEMS: { value: NavSection; icon: typeof Home }[] = [
  { value: "home", icon: Home },
  { value: "voice-agents", icon: Bot },
  { value: "ai-features", icon: Wand2 },
  { value: "settings", icon: Settings },
];

interface AppSidebarProps {
  section: NavSection;
  onSectionChange: (next: NavSection) => void;
}

export function AppSidebar({ section, onSectionChange }: AppSidebarProps) {
  const t = useCopy(shellCopy);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader style={{ padding: "14px 16px 10px" }}>
        <div className="flex items-center gap-2.5">
          <LogoIcon />
          <span
            className="group-data-[collapsible=icon]:hidden"
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "17px",
              fontWeight: 600,
              color: "var(--foreground)",
              letterSpacing: "-0.015em",
            }}
          >
            Mushu
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t.navigation}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ value, icon: Icon }) => {
                const isActive = section === value;
                const label = t.nav[value];
                return (
                  <SidebarMenuItem key={value}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => onSectionChange(value)}
                      tooltip={label}
                      style={
                        isActive
                          ? { fontWeight: 500 }
                          : { color: "var(--muted-foreground)", fontWeight: 500 }
                      }
                    >
                      <Icon strokeWidth={isActive ? 2.25 : 1.85} />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter style={{ padding: "8px 8px 12px" }}>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavUser onNavigate={onSectionChange} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
