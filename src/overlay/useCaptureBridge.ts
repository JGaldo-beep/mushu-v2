import { useEffect, useRef } from "react";
import { listen } from "@/lib/events";

// The microphone pipeline (getUserMedia + AudioContext + worklet) costs over a second
// to build on Windows, and rebuilding it on every hotkey press meant the first second
// of speech never reached the stream *or* the REST fallback. So it is built once and
// kept warm, then released after a period of inactivity so the OS microphone indicator
// does not stay lit forever.
const WARM_TTL_MS = 3 * 60 * 1000;

export function useCaptureBridge() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const warmDeviceIdRef = useRef<string | null | undefined>(undefined);
  const warmPromiseRef = useRef<Promise<void> | null>(null);
  const capturingRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSamplesRef = useRef<number[]>([]);

  useEffect(() => {
    const TARGET_SAMPLE_RATE = 16000;
    const WORKLET_CHUNK_SIZE = 1024;
    const WORKLET_MODULE_URL = new URL("linear16-capture.worklet.js", document.baseURI).toString();

    const toLinear16 = (input: Float32Array, sourceSampleRate: number) => {
      const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
      const outputLength = Math.max(1, Math.floor(input.length / ratio));
      const pcm = new Int16Array(outputLength);

      for (let i = 0; i < outputLength; i += 1) {
        const sample = input[Math.min(input.length - 1, Math.floor(i * ratio))] ?? 0;
        const clamped = Math.max(-1, Math.min(1, sample));
        pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      }

      return pcm;
    };

    const cancelRelease = () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    };

    // Full teardown: hands the microphone back to the OS.
    const releaseWarmPipeline = () => {
      cancelRelease();
      capturingRef.current = false;
      warmDeviceIdRef.current = undefined;
      warmPromiseRef.current = null;
      pendingSamplesRef.current = [];

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      mediaRecorderRef.current = null;

      sourceRef.current?.disconnect();
      sourceRef.current = null;
      workletRef.current?.disconnect();
      workletRef.current = null;
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
      console.info("[capture] pipeline liberado — micrófono devuelto al sistema");
    };

    const scheduleRelease = () => {
      cancelRelease();
      releaseTimerRef.current = setTimeout(releaseWarmPipeline, WARM_TTL_MS);
    };

    const buildWarmPipeline = async (deviceId: string | null) => {
      const t0 = performance.now();
      const since = () => `+${Math.round(performance.now() - t0)}ms`;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.info(`[capture] getUserMedia listo ${since()}`);
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule(WORKLET_MODULE_URL);
      console.info(`[capture] worklet cargado ${since()}`);

      const worklet = new AudioWorkletNode(audioContext, "linear16-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      workletRef.current = worklet;

      worklet.port.onmessage = (event) => {
        // The pipeline keeps running while warm; only forward once recording starts.
        if (!capturingRef.current) return;

        const raw = event.data;
        const input = raw instanceof Float32Array ? raw : Float32Array.from(raw || []);
        if (input.length === 0) return;

        // Compute RMS from each worklet block (~125 Hz at 16 kHz) for the waveform
        let sum = 0;
        for (const s of input) sum += s * s;
        const rms = Math.sqrt(sum / input.length);
        window.mushu.emitAudioChunk({ level: Math.min(1, rms * 5), ts: Date.now() });

        const pending = pendingSamplesRef.current;
        for (const value of input) pending.push(value);
        while (pending.length >= WORKLET_CHUNK_SIZE) {
          const chunk = Float32Array.from(pending.splice(0, WORKLET_CHUNK_SIZE));
          const pcm = toLinear16(chunk, audioContext.sampleRate);
          window.mushu.emitAudioChunk({
            bytes: pcm.buffer,
            mimeType: "audio/linear16",
            sampleRate: TARGET_SAMPLE_RATE,
            streamFormat: "linear16",
            streamOnly: true,
            ts: Date.now(),
          });
        }
      };

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(worklet);
      warmDeviceIdRef.current = deviceId;
      console.info(`[capture] pipeline caliente ${since()}`);
    };

    // Idempotent, and safe to call concurrently: a second caller awaits the first build.
    const ensureWarm = (deviceId: string | null) => {
      if (warmDeviceIdRef.current !== undefined && warmDeviceIdRef.current !== deviceId) {
        console.info("[capture] cambió el dispositivo — rehaciendo pipeline");
        releaseWarmPipeline();
      }
      if (streamRef.current && audioContextRef.current && workletRef.current) {
        return Promise.resolve();
      }
      if (!warmPromiseRef.current) {
        warmPromiseRef.current = buildWarmPipeline(deviceId).catch((error) => {
          warmPromiseRef.current = null;
          warmDeviceIdRef.current = undefined;
          throw error;
        });
      }
      return warmPromiseRef.current;
    };

    const startCapture = async (deviceId: string | null = null) => {
      const t0 = performance.now();
      cancelRelease();
      await ensureWarm(deviceId);

      const audioContext = audioContextRef.current;
      const stream = streamRef.current;
      if (!audioContext || !stream) throw new Error("Microphone pipeline unavailable.");
      if (audioContext.state === "suspended") await audioContext.resume();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        void event.data.arrayBuffer().then((buffer) => {
          window.mushu.emitAudioChunk({
            bytes: buffer,
            mimeType,
            ts: Date.now(),
          });
        });
      };

      pendingSamplesRef.current = [];
      capturingRef.current = true;
      recorder.start(250);
      console.info(`[capture] grabando +${Math.round(performance.now() - t0)}ms desde el hotkey`);
    };

    // Keeps the microphone but stops forwarding, so the next hotkey press is instant.
    const stopCapture = () => {
      capturingRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      mediaRecorderRef.current = null;
      pendingSamplesRef.current = [];
      window.mushu.emitAudioChunk({ level: 0, ts: Date.now() });
      if (streamRef.current) scheduleRelease();
    };

    const unsubs: Array<Promise<() => void>> = [];
    unsubs.push(
      listen("recording_started", (event) => {
        const deviceId = (event.payload as { selected_microphone?: string | null } | null)?.selected_microphone ?? null;
        void startCapture(deviceId).catch((error) => {
          capturingRef.current = false;
          window.mushu.emitAudioChunk({
            error: error instanceof Error ? error.message : String(error),
            ts: Date.now(),
          });
        });
      }),
    );
    unsubs.push(
      listen("recording_stopped", () => {
        console.info("[capture] stopping microphone capture");
        stopCapture();
      }),
    );
    unsubs.push(
      listen("dictation_cancelled", () => {
        stopCapture();
      }),
    );

    // Warm on mount so the first dictation after launch is fast too. The release timer
    // hands the microphone back if it goes unused.
    void ensureWarm(null)
      .then(scheduleRelease)
      .catch((error) => {
        console.warn("[capture] warm-up inicial falló:", error instanceof Error ? error.message : String(error));
      });

    return () => {
      releaseWarmPipeline();
      for (const u of unsubs) void u.then((off) => off());
    };
  }, []);
}
