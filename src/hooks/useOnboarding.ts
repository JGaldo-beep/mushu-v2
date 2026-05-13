import { useCallback, useEffect, useState } from "react";
import { tauri } from "@/lib/tauri";
import type { FrontendState, MushuAccount } from "@/lib/types";

type OnboardingSnapshot = {
  hotkey: string;
  ptt_hotkey: string;
  account: MushuAccount | null;
  api_base_url: string;
};

function parseOnboardingDone(fs: FrontendState & { onboardingCompleted?: boolean }): boolean {
  if (typeof fs.onboarding_completed === "boolean") return fs.onboarding_completed;
  if (typeof fs.onboardingCompleted === "boolean") return fs.onboardingCompleted;
  return false;
}

export function useOnboarding() {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  const [loadTick, setLoadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const fs = await tauri.getFrontendState();
        if (cancelled) return;
        const done = parseOnboardingDone(fs);
        setSnapshot({
          hotkey: fs.hotkey,
          ptt_hotkey: fs.ptt_hotkey,
          account: fs.account,
          api_base_url: fs.api_base_url,
        });
        setOpen(!done);
      } catch (err) {
        if (!cancelled) {
          console.error("[mushu] getFrontendState falló; el onboarding no se mostrará.", err);
          setOpen(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTick]);

  const refresh = useCallback(() => {
    setLoadTick((n) => n + 1);
  }, []);

  const complete = useCallback(async () => {
    await tauri.completeOnboarding();
    setOpen(false);
  }, []);

  return { loading, open, snapshot, complete, refresh };
}
