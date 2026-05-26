import { type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { Particles } from "@/components/Particles";
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
      <Particles
        className="pointer-events-none absolute inset-0 z-0"
        quantity={36}
        color="#81B09A"
        size={1.4}
        opacity={0.22}
      />

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
