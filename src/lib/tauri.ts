import type { FrontendState, HistoryItem, ModeName, SaveSettingsInput } from "./types";

export const tauri = {
  getFrontendState: () => window.mushu.invoke<FrontendState>("get_frontend_state"),
  login: (email: string, password: string) =>
    window.mushu.invoke<FrontendState>("auth_login", { email, password }),
  logout: () => window.mushu.invoke<FrontendState>("auth_logout"),
  refreshAccount: () => window.mushu.invoke<FrontendState>("auth_refresh"),
  completeOnboarding: () => window.mushu.invoke<FrontendState>("complete_onboarding"),
  saveSettings: (input: SaveSettingsInput) =>
    window.mushu.invoke<FrontendState>("save_settings", { input }),
  saveGroqApiKey: (key: string) => window.mushu.invoke<void>("save_groq_api_key", { key }),
  saveDeepgramApiKey: (key: string) => window.mushu.invoke<void>("save_deepgram_api_key", { key }),
  redeemGroqCoupon: (code: string) => window.mushu.invoke<void>("redeem_groq_coupon", { code }),
  testGroq: () => window.mushu.invoke<string>("test_groq"),
  testDeepgram: () => window.mushu.invoke<string>("test_deepgram"),
  getHistory: () => window.mushu.invoke<HistoryItem[]>("get_history"),
  clearHistory: () => window.mushu.invoke<void>("clear_history"),
  copyToClipboard: (text: string) => window.mushu.invoke<void>("copy_to_clipboard", { text }),
  openExternalUrl: (url: string) => window.mushu.invoke<void>("open_external_url", { url }),
  setMode: (mode: ModeName) => window.mushu.invoke<void>("set_mode", { mode }),
};
