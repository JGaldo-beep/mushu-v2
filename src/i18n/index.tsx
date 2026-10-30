import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { listen } from "@/lib/events";
import { tauri } from "@/lib/tauri";
import type { UiLanguage } from "@/lib/types";

// The app's text lives in copy objects next to this file, one per area, shaped
//   const en = { ... };
//   const es: typeof en = { ... };
//   export const fooCopy = { en, es };
// so a Spanish string missing or with the wrong shape is a type error. Components
// read theirs with `const t = useCopy(fooCopy)`.
export type Copy<T> = { en: T; es: T };

// Until the main process answers, guess from Chromium's locale (it follows Windows) so a
// Spanish install doesn't flash English on startup.
function initialLanguage(): UiLanguage {
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

const LanguageContext = createContext<UiLanguage>(initialLanguage());

// Wraps each window's root (main, overlay, explain). The main process resolves the
// "auto" preference against Windows; every window follows a change live.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>(initialLanguage);

  useEffect(() => {
    let alive = true;
    const load = () => {
      tauri
        .getFrontendState()
        .then((s) => {
          if (alive && (s.ui_language_resolved === "es" || s.ui_language_resolved === "en")) {
            setLanguage(s.ui_language_resolved);
          }
        })
        .catch(() => {});
    };
    load();
    const unlistenPromise = listen("frontend_state_changed", load);
    return () => {
      alive = false;
      void unlistenPromise.then((u) => u());
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): UiLanguage {
  return useContext(LanguageContext);
}

export function useCopy<T>(copy: Copy<T>): T {
  return copy[useLanguage()];
}
