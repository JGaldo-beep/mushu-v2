export type ModeName = "DEFAULT" | "EMAIL" | "NOTE" | "RAPPI";

export type ModeIconName = "Mic" | "Mail" | "StickyNote" | "ShoppingCart";

export type ModeInfo = {
  name: ModeName;
  label: string;
  color: string;
  icon: ModeIconName;
};

export type ThemePref = "system" | "light" | "dark";

export type ProcessingMode = "cloud_first" | "local_only";

export type TranscriptionProvider = "groq" | "deepgram";

export type FrontendState = {
  mode: ModeInfo;
  hotkey: string;
  ptt_hotkey: string;
  mode_hotkey: string;
  cycle_mode_hotkey: string;
  pause_hotkey: string;
  api_base_url: string;
  supabase_url: string;
  supabase_anon_key: string;
  model: string;
  processing_mode: ProcessingMode;
  transcription_provider: TranscriptionProvider;
  has_groq_key: boolean;
  has_deepgram_key: boolean;
  microphones: string[];
  selected_microphone: string | null;
  theme: ThemePref;
  sound_effects_enabled: boolean;
  sound_effects_volume: number;
  onboarding_completed: boolean;
  ai_formatting_enabled: boolean;
  auto_translate_enabled: boolean;
  auto_translate_target: string;
  account: MushuAccount | null;
  rappi_connected?: boolean;
};

export type MushuEntitlement = {
  user_id: string;
  status: string;
  trial_seconds_remaining?: number;
  monthly_seconds_remaining?: number;
  trial_minutes_remaining?: number;
  monthly_minutes_remaining?: number;
  renews_at: string | null;
  updated_at?: string;
};

export type MushuAccount = {
  user: {
    id: string;
    email: string | null;
    avatar_url?: string | null;
    full_name?: string | null;
  };
  entitlement: MushuEntitlement | null;
};

export type SaveSettingsInput = {
  hotkey: string;
  ptt_hotkey?: string;
  mode_hotkey: string;
  cycle_mode_hotkey?: string;
  pause_hotkey: string;
  api_base_url?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  model: string;
  processing_mode: ProcessingMode;
  transcription_provider: TranscriptionProvider;
  microphone: string | null;
  theme: ThemePref;
  sound_effects_enabled: boolean;
  sound_effects_volume: number;
  ai_formatting_enabled?: boolean;
  auto_translate_enabled?: boolean;
  auto_translate_target?: string;
};

export type HistoryItem = {
  id: number;
  timestamp: string;
  raw_text: string;
  processed_text: string;
  mode_used: ModeName | string;
  duration_ms: number;
};

export type DictationLatencyPayload = {
  whisper_ms: number;
  llm_ms: number;
  paste_ms: number;
  total_ms: number;
  phase: string;
};

export type NavSection = "home" | "modes" | "ai-features" | "settings" | "account";
