const en = {
  // The pill names the plain-dictation state when no voice agent is active.
  general: "General",
  paused: "Paused",
  processing: "Processing",
  replyFrom: "Mushu",
  micPipelineUnavailable: "Microphone pipeline unavailable.",
  // Fallback name for an input Windows doesn't label (no microphone permission yet).
  microphoneN: (n: number) => `Microphone ${n}`,
};

const es: typeof en = {
  general: "General",
  paused: "En pausa",
  processing: "Procesando",
  replyFrom: "Mushu",
  micPipelineUnavailable: "No se pudo abrir el micrófono.",
  microphoneN: (n: number) => `Micrófono ${n}`,
};

export const overlayCopy = { en, es };
