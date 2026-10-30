import type { NavSection, ThemePref } from "@/lib/types";

const en = {
  nav: {
    home: "Home",
    "voice-agents": "Voice agents",
    "ai-features": "AI features",
    settings: "Settings",
    account: "Account",
  } satisfies Record<NavSection, string>,
  navigation: "Navigation",
  minimize: "Minimize",
  maximize: "Maximize",
  close: "Close",
  theme: "Theme",
  themes: { system: "Auto", light: "Light", dark: "Dark" } satisfies Record<ThemePref, string>,
  themeOption: (label: string) => `${label} theme`,
  fallbackName: "Mushu user",
  accountConnected: "Account connected",
  freePlan: "Free plan",
  lightMode: "Light mode",
  darkMode: "Dark mode",
  account: "Account",
  profile: "Profile",
  plans: "Plans",
  signOut: "Sign out",
  signedOut: "Signed out",
};

const es: typeof en = {
  nav: {
    home: "Inicio",
    "voice-agents": "Agentes de voz",
    "ai-features": "Funciones de IA",
    settings: "Ajustes",
    account: "Cuenta",
  },
  navigation: "Navegación",
  minimize: "Minimizar",
  maximize: "Maximizar",
  close: "Cerrar",
  theme: "Tema",
  themes: { system: "Auto", light: "Claro", dark: "Oscuro" },
  themeOption: (label: string) => `Tema ${label.toLowerCase()}`,
  fallbackName: "Usuario de Mushu",
  accountConnected: "Cuenta conectada",
  freePlan: "Plan gratis",
  lightMode: "Modo claro",
  darkMode: "Modo oscuro",
  account: "Cuenta",
  profile: "Perfil",
  plans: "Planes",
  signOut: "Cerrar sesión",
  signedOut: "Sesión cerrada",
};

export const shellCopy = { en, es };
