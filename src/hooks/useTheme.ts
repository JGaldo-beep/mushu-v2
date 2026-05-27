import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, watchSystemTheme } from "@/lib/theme";
import { tauri } from "@/lib/tauri";
import type { SaveSettingsInput, ThemePref } from "@/lib/types";

type Resolved = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<Resolved>("light");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    tauri
      .getFrontendState()
      .then((s) => {
        const t: ThemePref =
          s.theme === "light" || s.theme === "dark" || s.theme === "system" ? s.theme : "system";
        setThemeState(t);
        applyTheme(t);
        setResolved(resolveTheme(t));
        setLoaded(true);
      })
      .catch(() => {
        applyTheme("system");
        setResolved(resolveTheme("system"));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    return watchSystemTheme(() => {
      applyTheme("system");
      setResolved(resolveTheme("system"));
    });
  }, [theme]);

  const setTheme = async (next: ThemePref) => {
    setThemeState(next);
    applyTheme(next);
    setResolved(resolveTheme(next));
    if (!loaded) return;
    try {
      const state = await tauri.getFrontendState();
      const input: SaveSettingsInput = {
        hotkey: state.hotkey,
        mode_hotkey: state.mode_hotkey,
        pause_hotkey: state.pause_hotkey,
        model: state.model,
        processing_mode: state.processing_mode,
        transcription_provider: state.transcription_provider,
        selected_microphone: state.selected_microphone,
        theme: next,
        sound_effects_enabled: state.sound_effects_enabled,
        sound_effects_volume: state.sound_effects_volume,
      };
      await tauri.saveSettings(input);
    } catch {
      /* ignore persistence errors */
    }
  };

  const toggle = () => {
    void setTheme(resolved === "dark" ? "light" : "dark");
  };

  return { theme, resolved, setTheme, toggle };
}
