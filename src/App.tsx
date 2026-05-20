import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { HistoryProvider } from "@/context/HistoryContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useTheme } from "@/hooks/useTheme";
import { AccountPage } from "@/pages/AccountPage";
import { AIFeaturesPage } from "@/pages/AIFeaturesPage";
import { HomePage } from "@/pages/HomePage";
import { ModesPage } from "@/pages/ModesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import type { NavSection } from "@/lib/types";

function App() {
  const [section, setSection] = useState<NavSection>("home");
  // Keep useTheme alive so Tauri theme preference still loads (we ignore the value).
  useTheme();
  const onboarding = useOnboarding();

  return (
    <TooltipProvider delayDuration={200}>
      <HistoryProvider>
        <AppShell section={section} onSectionChange={setSection}>
          <AnimatePresence mode="sync">
            <PageTransition key={section}>
              {section === "home" && <HomePage onNavigate={setSection} />}
              {section === "modes" && <ModesPage />}
              {section === "ai-features" && <AIFeaturesPage />}
              {section === "settings" && <SettingsPage />}
              {section === "account" && <AccountPage />}
            </PageTransition>
          </AnimatePresence>
        </AppShell>
      </HistoryProvider>
      <Toaster richColors position="bottom-right" />
      {!onboarding.loading && onboarding.open && onboarding.snapshot && (
        <OnboardingWizard
          hotkey={onboarding.snapshot.hotkey}
          pttHotkey={onboarding.snapshot.ptt_hotkey}
          account={onboarding.snapshot.account}
          onComplete={onboarding.complete}
          onNavigateSettings={setSection}
          onAuthChanged={onboarding.refresh}
        />
      )}
    </TooltipProvider>
  );
}

export default App;
