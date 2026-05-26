import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { HistoryProvider } from "@/context/HistoryContext";
import { PageTransition } from "@/components/layout/PageTransition";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useTheme } from "@/hooks/useTheme";
import { AccountPage } from "@/pages/AccountPage";
import { AIFeaturesPage } from "@/pages/AIFeaturesPage";
import { HomePage } from "@/pages/HomePage";
import { ModesPage } from "@/pages/ModesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { listen } from "@/lib/events";
import type { NavSection } from "@/lib/types";

function App() {
  const [section, setSection] = useState<NavSection>("home");
  // Keep useTheme alive so Tauri theme preference still loads (we ignore the value).
  useTheme();
  const onboarding = useOnboarding();

  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ status: string; qr?: string }>("whatsapp_status_changed", (e) => {
      if (e.payload.status === "qr" && e.payload.qr) {
        setWhatsappQr(e.payload.qr);
        setShowQrModal(true);
      } else if (e.payload.status === "ready" || e.payload.status === "disconnected") {
        setShowQrModal(false);
        setWhatsappQr(null);
      }
    }).then((off) => { unlisten = off; });
    return () => unlisten?.();
  }, []);

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
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent
          style={{
            background: "oklch(15% 0.08 209 / 0.96)",
            border: "0.5px solid var(--glass-border)",
            backdropFilter: "blur(20px) saturate(140%)",
            textAlign: "center",
          }}
        >
          <DialogHeader>
            <DialogTitle
              style={{ fontFamily: "'Geist Variable', sans-serif", fontSize: "18px" }}
            >
              Conecta WhatsApp
            </DialogTitle>
            <DialogDescription
              style={{ fontFamily: "'Geist Variable', sans-serif", fontSize: "13px" }}
            >
              Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo
            </DialogDescription>
          </DialogHeader>
          {whatsappQr && (
            <img
              src={whatsappQr}
              alt="WhatsApp QR"
              style={{ width: 200, height: 200, margin: "12px auto", borderRadius: 8 }}
            />
          )}
          <p
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            El QR expira en ~60 segundos. Se cerrará automáticamente al conectar.
          </p>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export default App;
