import { useCallback, useEffect, useState } from "react";
import { listen } from "@/lib/events";
import { tauri } from "@/lib/tauri";

export interface AIFeaturesState {
  autoTranslateEnabled: boolean;
  autoTranslateTarget: string;
}

const DEFAULT_STATE: AIFeaturesState = {
  autoTranslateEnabled: false,
  autoTranslateTarget: "en",
};

const SETTINGS_KEY: Record<keyof AIFeaturesState, string> = {
  autoTranslateEnabled: "auto_translate_enabled",
  autoTranslateTarget: "auto_translate_target",
};

function fromState(s: {
  auto_translate_enabled?: boolean;
  auto_translate_target?: string;
}): AIFeaturesState {
  return {
    autoTranslateEnabled: s.auto_translate_enabled ?? false,
    autoTranslateTarget: s.auto_translate_target ?? "en",
  };
}

export function useAIFeatures() {
  const [state, setState] = useState<AIFeaturesState>(DEFAULT_STATE);

  useEffect(() => {
    let mounted = true;
    let off: (() => void) | null = null;

    const refresh = () => {
      tauri
        .getFrontendState()
        .then((s) => {
          if (mounted) setState(fromState(s));
        })
        .catch(() => {});
    };

    refresh();
    void listen("frontend_state_changed", () => {
      if (mounted) refresh();
    }).then((u) => {
      if (!mounted) u();
      else off = u;
    });

    return () => {
      mounted = false;
      if (off) off();
    };
  }, []);

  const setField = useCallback(
    <K extends keyof AIFeaturesState>(key: K, value: AIFeaturesState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
      const settingsKey = SETTINGS_KEY[key];
      // El handler save_settings hace spread, asi que un input parcial es seguro.
      void window.mushu
        .invoke("save_settings", { input: { [settingsKey]: value } })
        .catch(() => {
          // Revertimos si falla la persistencia.
          setState((prev) => ({ ...prev, [key]: state[key] }));
        });
    },
    [state],
  );

  return { ...state, setField };
}
