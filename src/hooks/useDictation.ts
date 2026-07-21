import { listen } from "@/lib/events";
import { useCallback, useEffect, useRef, useState } from "react";
import { tauri } from "@/lib/tauri";

export type DictationStatus = "idle" | "recording" | "processing" | "result" | "error";

interface DictationState {
  status: DictationStatus;
  resultText: string | null;
  errorMessage: string | null;
  hotkey: string;
  modeHotkey: string;
}

const RESULT_AUTO_CLEAR_MS = 12000;
const ERROR_AUTO_CLEAR_MS = 6000;

export function useDictation() {
  const [state, setState] = useState<DictationState>({
    status: "idle",
    resultText: null,
    errorMessage: null,
    hotkey: "Ctrl+Space",
    modeHotkey: "Ctrl+Shift+M",
  });

  const clearTimerRef = useRef<number | null>(null);

  const scheduleClear = useCallback((ms: number) => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setState((s) => ({ ...s, status: "idle", resultText: null, errorMessage: null }));
      clearTimerRef.current = null;
    }, ms);
  }, []);

  useEffect(() => {
    tauri
      .getFrontendState()
      .then((fs) => {
        setState((s) => ({
          ...s,
          hotkey: fs.hotkey,
          modeHotkey: fs.mode_hotkey,
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unlistenStart = listen("recording_started", () => {
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      setState((s) => ({
        ...s,
        status: "recording",
        resultText: null,
        errorMessage: null,
      }));
    });

    const unlistenProcessing = listen("dictation_processing", (event) => {
      const active = (event.payload as { active?: boolean })?.active === true;
      if (active) setState((s) => ({ ...s, status: "processing" }));
    });

    const unlistenDone = listen("transcription_done", (event) => {
      const p = event.payload as { text?: string };
      const hasText = !!p?.text;
      setState((s) => ({
        ...s,
        status: hasText ? "result" : "idle",
        resultText: p?.text ?? null,
      }));
      if (hasText) scheduleClear(RESULT_AUTO_CLEAR_MS);
    });

    const unlistenMushu = listen("mushu_reply", (event) => {
      const p = event.payload as { text?: string };
      const hasText = !!p?.text;
      setState((s) => ({
        ...s,
        status: hasText ? "result" : "idle",
        resultText: p?.text ?? null,
      }));
      if (hasText) scheduleClear(RESULT_AUTO_CLEAR_MS);
    });

    const unlistenError = listen("transcription_error", (event) => {
      const msg = String(event.payload ?? "Transcription error.");
      setState((s) => ({ ...s, status: "error", errorMessage: msg }));
      scheduleClear(ERROR_AUTO_CLEAR_MS);
    });

    const unlistenCancelled = listen("dictation_cancelled", () => {
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      setState((s) => ({
        ...s,
        status: "idle",
        resultText: null,
        errorMessage: null,
      }));
    });

    const unlistenGroq = listen("groq_error", (event) => {
      const msg = String(event.payload ?? "Failed to transcribe. Try again.");
      setState((s) => ({ ...s, status: "error", errorMessage: msg }));
      scheduleClear(ERROR_AUTO_CLEAR_MS);
    });

    return () => {
      unlistenStart.then((f) => f());
      unlistenProcessing.then((f) => f());
      unlistenDone.then((f) => f());
      unlistenMushu.then((f) => f());
      unlistenError.then((f) => f());
      unlistenGroq.then((f) => f());
      unlistenCancelled.then((f) => f());
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, [scheduleClear]);

  const dismiss = useCallback(() => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    setState((s) => ({ ...s, status: "idle", resultText: null, errorMessage: null }));
  }, []);

  return {
    ...state,
    dismiss,
  };
}
