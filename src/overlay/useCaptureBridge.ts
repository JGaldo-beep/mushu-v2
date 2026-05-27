import { useEffect, useRef } from "react";
import { listen } from "@/lib/events";

export function useCaptureBridge() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);

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

    const stopAnalyser = () => {
      workletRef.current?.disconnect();
      workletRef.current = null;
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      window.mushu.emitAudioChunk({ level: 0, ts: Date.now() });
    };

    const stopCapture = () => {
      stopAnalyser();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      mediaRecorderRef.current = null;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };

    const startCapture = async (deviceId: string | null = null) => {
      stopCapture();
      console.info("[capture] starting microphone capture", deviceId ? `device=${deviceId}` : "default");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

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
      recorder.start(250);

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      await audioContext.audioWorklet.addModule(WORKLET_MODULE_URL);
      const worklet = new AudioWorkletNode(audioContext, "linear16-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      workletRef.current = worklet;
      const pendingSamples: number[] = [];
      worklet.port.onmessage = (event) => {
        const raw = event.data;
        const input = raw instanceof Float32Array ? raw : Float32Array.from(raw || []);
        if (input.length === 0) return;

        // Compute RMS from each worklet block (~125 Hz at 16 kHz) for the waveform
        let sum = 0;
        for (const s of input) sum += s * s;
        const rms = Math.sqrt(sum / input.length);
        window.mushu.emitAudioChunk({ level: Math.min(1, rms * 5), ts: Date.now() });

        for (const value of input) pendingSamples.push(value);
        while (pendingSamples.length >= WORKLET_CHUNK_SIZE) {
          const chunk = Float32Array.from(pendingSamples.splice(0, WORKLET_CHUNK_SIZE));
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
      source.connect(worklet);
    };

    const unsubs: Array<Promise<() => void>> = [];
    unsubs.push(
      listen("recording_started", (event) => {
        const deviceId = (event.payload as { selected_microphone?: string | null } | null)?.selected_microphone ?? null;
        void startCapture(deviceId).catch((error) => {
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

    return () => {
      stopCapture();
      for (const u of unsubs) void u.then((off) => off());
    };
  }, []);
}
