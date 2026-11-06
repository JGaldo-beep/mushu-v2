import { listen } from "@/lib/events";
import { useCallback, useEffect, useRef, useState } from "react";
import { tauri } from "@/lib/tauri";
import type { FrontendState, SaveSettingsInput } from "@/lib/types";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// A fresh state from main.js, without losing what the user is in the middle of editing:
// fields whose draft differs from the last known state keep the draft; the rest update.
function mergeDraft(
  prev: FrontendState | null,
  draft: FrontendState | null,
  next: FrontendState,
): FrontendState {
  if (!prev || !draft) return next;
  const merged: Record<string, unknown> = { ...next };
  for (const key of Object.keys(draft) as (keyof FrontendState)[]) {
    if (!same(draft[key], prev[key])) merged[key] = draft[key];
  }
  return merged as FrontendState;
}

export function useSettings() {
  const [state, setState] = useState<FrontendState | null>(null);
  const [draft, setDraft] = useState<FrontendState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<FrontendState | null>(null);

  // main.js broadcasts frontend_state_changed from ~20 places (language, agents, account,
  // mic hot-plug…). Those background reloads used to replace the draft, silently throwing
  // away unsaved edits, and dimmed the page each time. Only the first load shows `loading`.
  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const fs = await tauri.getFrontendState();
      const prev = stateRef.current;
      stateRef.current = fs;
      setState(fs);
      setDraft((d) => mergeDraft(prev, d, fs));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unlistenPromise = listen("frontend_state_changed", () => {
      void load(true);
    });
    return () => {
      void unlistenPromise.then((u) => u());
    };
  }, [load]);

  const setField = useCallback(
    <K extends keyof FrontendState>(key: K, value: FrontendState[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
    },
    [],
  );

  const isDirty = !!state && !!draft && !same(state, draft);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      // Re-fetch theme right before saving so a sidebar theme change isn't overwritten.
      const fresh = await tauri.getFrontendState();
      const input: SaveSettingsInput = {
        hotkey: draft.hotkey,
        ptt_hotkey: draft.ptt_hotkey,
        mode_hotkey: draft.mode_hotkey,
        pause_hotkey: draft.pause_hotkey,
        api_base_url: draft.api_base_url,
        supabase_url: draft.supabase_url,
        supabase_anon_key: draft.supabase_anon_key,
        model: draft.model,
        processing_mode: draft.processing_mode,
        transcription_provider: draft.transcription_provider,
        selected_microphone: draft.selected_microphone,
        selected_microphone_label: draft.selected_microphone_label ?? null,
        auto_switch_microphone: draft.auto_switch_microphone ?? true,
        theme: fresh.theme,
        sound_effects_enabled: draft.sound_effects_enabled,
        sound_effects_volume: draft.sound_effects_volume,
        stop_on_enter: draft.stop_on_enter ?? false,
        deepgram_replacements: draft.deepgram_replacements ?? [],
      };
      const updated = await tauri.saveSettings(input);
      stateRef.current = updated;
      setState(updated);
      setDraft(updated);
      return updated;
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const reset = useCallback(() => {
    if (state) setDraft(state);
  }, [state]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    state,
    draft,
    isDirty,
    loading,
    saving,
    error,
    setField,
    save,
    reset,
    refresh,
  };
}
