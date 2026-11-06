import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@/lib/events";
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

function snapshotOf(fs: FrontendState): OnboardingSnapshot {
  return {
    hotkey: fs.hotkey,
    ptt_hotkey: fs.ptt_hotkey,
    account: fs.account,
    api_base_url: fs.api_base_url || "https://mushu.space",
  };
}

export function useOnboarding() {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot | null>(null);
  // True once the user has reached the wizard's sign-in step: from then on the wizard
  // finishes itself (signed-in state, then the hotkey step) instead of vanishing.
  const holdOpenRef = useRef(false);

  // First load only. `loading` gates the wizard's mount, so it never flips back to true:
  // doing that on a refresh unmounted the wizard and reopened it at step 01.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fs = await tauri.getFrontendState();
        if (cancelled) return;
        setSnapshot(snapshotOf(fs));
        setOpen(!parseOnboardingDone(fs));
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
  }, []);

  // Keep the snapshot (account, hotkeys) current. A `mushu://auth` deep link marks onboarding
  // complete in main.js; if it lands before the user got to sign-in (they signed up on the
  // web first), the wizard closes as intended. Once they're on the sign-in step it stays,
  // so they see "You're signed in" and the step that teaches the hotkey.
  useEffect(() => {
    let off: (() => void) | null = null;
    let cancelled = false;
    void listen("frontend_state_changed", () => {
      if (cancelled) return;
      void tauri.getFrontendState().then((fs) => {
        if (cancelled) return;
        setSnapshot(snapshotOf(fs));
        if (parseOnboardingDone(fs) && !holdOpenRef.current) setOpen(false);
      });
    }).then((u) => {
      if (cancelled) u();
      else off = u;
    });
    return () => {
      cancelled = true;
      if (off) off();
    };
  }, []);

  const holdOpen = useCallback((hold: boolean) => {
    holdOpenRef.current = hold;
  }, []);

  const complete = useCallback(async () => {
    await tauri.completeOnboarding();
    holdOpenRef.current = false;
    setOpen(false);
  }, []);

  return { loading, open, snapshot, complete, holdOpen };
}
