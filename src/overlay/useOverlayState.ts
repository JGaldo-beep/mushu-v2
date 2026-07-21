import { listen } from "@/lib/events";
import { useCallback, useEffect, useRef, useState } from "react";

const THINK_AFTER_WAVE_MS = 260;
const MUSHU_REPLY_HIDE_MS = 20000;
const TRANSCRIPTION_EXIT_MS = 220;
const CHIME_GAIN_BOOST = 4;

function voiceAgentName(agent: unknown): string | null {
  const name = (agent as { name?: string } | null | undefined)?.name;
  return typeof name === "string" && name.trim() ? name : null;
}

/** Extracts the embedded `active_voice_agent` field from recording_started/transcription_done payloads. */
function embeddedVoiceAgentName(payload: unknown): string | null {
  return voiceAgentName((payload as { active_voice_agent?: unknown } | null)?.active_voice_agent);
}

function chimeSrc(kind: "start" | "stop"): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const root = base === "/" ? "" : base.replace(/\/$/, "");
  return `${root}/sounds/${kind === "start" ? "start" : "stop"}.wav`;
}

function playChime(kind: "start" | "stop", enabled: boolean, volume: number) {
  if (!enabled) return;
  const gainValue = Math.min(6, Math.max(0, volume) * CHIME_GAIN_BOOST);
  const tryPlay = (attempt: number) => {
    const audio = new Audio(chimeSrc(kind));
    audio.volume = 1;

    try {
      const win = window as Window &
        typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const AudioContextCtor = window.AudioContext || win.webkitAudioContext;
      if (!AudioContextCtor) throw new Error("AudioContext no disponible");
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();
      gain.gain.value = gainValue;
      source.connect(gain).connect(audioContext.destination);
      audio.addEventListener(
        "ended",
        () => {
          source.disconnect();
          gain.disconnect();
          void audioContext.close();
        },
        { once: true },
      );
      void audioContext
        .resume()
        .then(() => audio.play())
        .catch(() => {
          void audioContext.close();
          if (attempt >= 2) return;
          window.setTimeout(() => tryPlay(attempt + 1), attempt === 0 ? 0 : 80);
        });
      return;
    } catch {
      audio.volume = Math.min(1, Math.max(0, volume));
    }

    void audio.play().catch(() => {
      if (attempt >= 2) return;
      window.setTimeout(() => tryPlay(attempt + 1), attempt === 0 ? 0 : 80);
    });
  };
  tryPlay(0);
}

export type OverlaySurface =
  | "hidden"
  | "banner"
  | "recording"
  | "processing"
  | "reply"
  | "idle";

export function useOverlayState() {
  const [surface, setSurface] = useState<OverlaySurface>("hidden");
  const [activeVoiceAgent, setActiveVoiceAgent] = useState<string | null>(null);
  const [modeBannerOnly, setModeBannerOnly] = useState(false);
  const [mushuReplyText, setMushuReplyText] = useState<string | null>(null);
  // Bumped whenever the active voice agent changes, forcing the overlay badge
  // to re-key and replay its "pop" entrance animation.
  const [modePopToken, setModePopToken] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [transcriptionFadeOut, setTranscriptionFadeOut] = useState(false);
  const [isHandsOff, setIsHandsOff] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  const soundEnabledRef = useRef(true);
  const soundVolumeRef = useRef(0.22);
  const thinkTimerRef = useRef<number | null>(null);
  const mushuHideTimerRef = useRef<number | null>(null);
  const transcriptionExitTimerRef = useRef<number | null>(null);

  const bumpModePop = useCallback(() => {
    setModePopToken((n) => n + 1);
  }, []);

  const cancelThinkPhase = useCallback(() => {
    if (thinkTimerRef.current) {
      window.clearTimeout(thinkTimerRef.current);
      thinkTimerRef.current = null;
    }
    setShowThinking(false);
  }, []);

  const cancelMushuHide = useCallback(() => {
    if (mushuHideTimerRef.current) {
      window.clearTimeout(mushuHideTimerRef.current);
      mushuHideTimerRef.current = null;
    }
  }, []);

  const cancelTranscriptionExit = useCallback(() => {
    if (transcriptionExitTimerRef.current) {
      window.clearTimeout(transcriptionExitTimerRef.current);
      transcriptionExitTimerRef.current = null;
    }
  }, []);

  const beginProcessing = useCallback(() => {
    cancelThinkPhase();
    cancelMushuHide();
    setMushuReplyText(null);
    setSurface("processing");
    thinkTimerRef.current = window.setTimeout(() => {
      thinkTimerRef.current = null;
      setShowThinking(true);
    }, THINK_AFTER_WAVE_MS);
  }, [cancelMushuHide, cancelThinkPhase]);

  useEffect(() => {
    const unsubs: Array<Promise<() => void>> = [];

    unsubs.push(
      listen("mushu_sound_prefs", (event) => {
        const p = event.payload as { enabled?: boolean; volume?: number };
        if (typeof p?.enabled === "boolean")
          soundEnabledRef.current = p.enabled;
        if (typeof p?.volume === "number") soundVolumeRef.current = p.volume;
      }),
    );

    unsubs.push(
      listen("recording_started", (event) => {
        cancelTranscriptionExit();
        cancelThinkPhase();
        cancelMushuHide();
        setMushuReplyText(null);
        setModeBannerOnly(false);
        setTranscriptionFadeOut(false);
        setIsHandsOff(false);
        setIsPaused(false);
        setLiveTranscript("");
        setActiveVoiceAgent(embeddedVoiceAgentName(event.payload));
        setSurface("recording");
        playChime("start", soundEnabledRef.current, soundVolumeRef.current);
      }),
    );

    unsubs.push(
      listen("voice_agent_changed", (event) => {
        setActiveVoiceAgent(voiceAgentName(event.payload));
        bumpModePop();
      }),
    );

    unsubs.push(
      listen("overlay_mode_banner", (event) => {
        const active = Boolean((event.payload as { active?: boolean })?.active);
        setModeBannerOnly(active);
        if (active) {
          cancelTranscriptionExit();
          setTranscriptionFadeOut(false);
          setSurface("banner");
        } else {
          setSurface((prev) => (prev === "banner" ? "hidden" : prev));
        }
      }),
    );

    unsubs.push(
      listen("dictation_processing", (event) => {
        const active = Boolean((event.payload as { active?: boolean })?.active);
        if (active) {
          setModeBannerOnly(false);
          beginProcessing();
        } else {
          cancelThinkPhase();
          cancelMushuHide();
          setMushuReplyText(null);
          setTranscriptionFadeOut(false);
          setSurface((prev) => {
            if (prev === "processing") return "idle";
            if (prev === "hidden") return "hidden";
            return prev;
          });
        }
      }),
    );

    unsubs.push(
      listen("recording_stopped", () => {
        playChime("stop", soundEnabledRef.current, soundVolumeRef.current);
      }),
    );

    unsubs.push(
      listen("dictation_cancelled", () => {
        cancelThinkPhase();
        cancelMushuHide();
        cancelTranscriptionExit();
        setMushuReplyText(null);
        setModeBannerOnly(false);
        setTranscriptionFadeOut(false);
        setIsHandsOff(false);
        setIsPaused(false);
        setLiveTranscript("");
        setSurface("hidden");
      }),
    );

    unsubs.push(
      listen("live_transcript", (event) => {
        const text = String((event.payload as { text?: string })?.text ?? "")
          .replace(/\s+/g, " ")
          .trim();
        setLiveTranscript(text);
      }),
    );

    unsubs.push(
      listen("hands_off_changed", (event) => {
        setIsHandsOff(Boolean(event.payload));
      }),
    );

    unsubs.push(
      listen("dictation_paused", (event) => {
        setIsPaused(Boolean(event.payload));
      }),
    );

    unsubs.push(
      listen("transcription_done", (event) => {
        cancelThinkPhase();
        cancelMushuHide();
        setMushuReplyText(null);
        setLiveTranscript("");
        setActiveVoiceAgent(embeddedVoiceAgentName(event.payload));
        setTranscriptionFadeOut(true);
        cancelTranscriptionExit();
        transcriptionExitTimerRef.current = window.setTimeout(() => {
          transcriptionExitTimerRef.current = null;
          setSurface("hidden");
          setTranscriptionFadeOut(false);
        }, TRANSCRIPTION_EXIT_MS);
      }),
    );

    unsubs.push(
      listen("mushu_reply", (event) => {
        cancelThinkPhase();
        const t = String(
          (event.payload as { text?: string })?.text ?? "",
        ).slice(0, 2800);
        setMushuReplyText(t);
        setSurface("reply");
        cancelMushuHide();
        mushuHideTimerRef.current = window.setTimeout(() => {
          mushuHideTimerRef.current = null;
          setMushuReplyText(null);
          setSurface((prev) => (prev === "reply" ? "idle" : prev));
        }, MUSHU_REPLY_HIDE_MS);
      }),
    );

    return () => {
      cancelThinkPhase();
      cancelMushuHide();
      cancelTranscriptionExit();
      for (const u of unsubs) void u.then((f) => f());
    };
  }, [
    beginProcessing,
    bumpModePop,
    cancelMushuHide,
    cancelThinkPhase,
    cancelTranscriptionExit,
  ]);

  const isProcessing = surface === "processing";
  const isReply = surface === "reply" && mushuReplyText !== null;
  const showPill = surface !== "hidden" || transcriptionFadeOut;
  const audioLevelActive = surface === "recording";

  return {
    surface,
    activeVoiceAgent,
    modeBannerOnly,
    mushuReplyText,
    modePopToken,
    isProcessing,
    isReply,
    showPill,
    showThinking,
    transcriptionFadeOut,
    audioLevelActive,
    isHandsOff,
    isPaused,
    liveTranscript,
  };
}
