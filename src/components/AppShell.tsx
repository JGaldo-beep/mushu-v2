import { type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import type { NavSection } from "@/lib/types";

interface AppShellProps {
  children: ReactNode;
  section: NavSection;
  onSectionChange: (next: NavSection) => void;
}

export function AppShell({ children, section, onSectionChange }: AppShellProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "var(--background)",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <TitleBar />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <SidebarProvider defaultOpen={true} style={{ minHeight: 0, height: "100%" }}>
            <AppSidebar section={section} onSectionChange={onSectionChange} />
            <SidebarInset
              style={{
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {children}
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>
    </div>
  );
}
