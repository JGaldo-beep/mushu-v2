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
import { VoiceAgentsPage } from "@/pages/VoiceAgentsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import type { NavSection } from "@/lib/types";

function App() {
  const [section, setSection] = useState<NavSection>("home");
  useTheme();
  const onboarding = useOnboarding();
  const wizardOpen = !onboarding.loading && onboarding.open && Boolean(onboarding.snapshot);

  return (
    <TooltipProvider delayDuration={200}>
      {/* While the wizard is up, the app behind it is out of the tab order and hidden from
          screen readers, so focus can't wander behind the dialog. */}
      <div className="contents" inert={wizardOpen}>
      <HistoryProvider>
        <AppShell section={section} onSectionChange={setSection}>
          <AnimatePresence mode="sync">
            <PageTransition key={section}>
              {section === "home" && <HomePage onNavigate={setSection} />}
              {section === "voice-agents" && <VoiceAgentsPage />}
              {section === "ai-features" && <AIFeaturesPage />}
              {section === "settings" && <SettingsPage />}
              {section === "account" && <AccountPage />}
            </PageTransition>
          </AnimatePresence>
        </AppShell>
      </HistoryProvider>
      </div>
      <Toaster richColors position="bottom-right" />
      {wizardOpen && onboarding.snapshot && (
        <OnboardingWizard
          hotkey={onboarding.snapshot.hotkey}
          pttHotkey={onboarding.snapshot.ptt_hotkey}
          account={onboarding.snapshot.account}
          apiBaseUrl={onboarding.snapshot.api_base_url}
          onComplete={onboarding.complete}
          onHoldOpen={onboarding.holdOpen}
        />
      )}
    </TooltipProvider>
  );
}

export default App;
