import { useCallback, useEffect, useState } from "react";
import { patchSettings } from "../lib/tauri";

const STORAGE_KEY = "mushu.spoken_language.v1";
const DEFAULT_VALUE = "auto";

export function useSpokenLanguage() {
  const [language, setLanguageState] = useState<string>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_VALUE;
    } catch {
      return DEFAULT_VALUE;
    }
  });

  // Keep localStorage and main-process settings in sync.
  // Fires on mount (syncs persisted value on startup) and on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
    void patchSettings({ spoken_language: language }).catch(() => {});
  }, [language]);

  const setLanguage = useCallback((next: string) => {
    setLanguageState(next);
  }, []);

  return { language, setLanguage };
}
