import { useEffect, useState } from "react";
import { listen } from "@/lib/events";
import { tauri } from "@/lib/tauri";
import type { MushuAccount } from "@/lib/types";

export function useAccountStatus() {
  const [account, setAccount] = useState<MushuAccount | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const fs = await tauri.getFrontendState();
        if (cancelled) return;
        setAccount(fs.account ?? null);
      } catch {
        if (!cancelled) setAccount(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    void refresh();
    const unlistenPromise = listen("frontend_state_changed", () => {
      void refresh();
    });

    return () => {
      cancelled = true;
      void unlistenPromise.then((u) => u());
    };
  }, []);

  return { account, loaded, isSignedIn: Boolean(account) };
}
