import { useEffect, useRef } from "react";
import { listen } from "@/lib/events";

export function useCaptureBridge() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Trackeamos la ultima promesa de arrayBuffer() del MediaRecorder.
    // Como recorder.ondataavailable hace el conversion async, sin esto el
    // chunk final puede llegar al main process despues de que processRecording
    // ya empezo, dejando un blob webm incompleto que Deepgram rechaza con
    // "corrupt or unsupported data". Pasa sobre todo despues de sleep/inactividad.
    let pendingChunkPromise: Promise<void> = Promise.resolve();

    const stopAnalyser = () => {
      if (analyserFrameRef.current !== null) {
        cancelAnimationFrame(analyserFrameRef.current);
        analyserFrameRef.current = null;
      }
      void audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      window.mushu.emitAudioChunk({ level: 0, ts: Date.now() });
    };

    const stopCapture = async () => {
      stopAnalyser();
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        const stopped = new Promise<void>((resolve) => {
          recorder.addEventListener("stop", () => resolve(), { once: true });
        });
        recorder.stop();
        await stopped;
        await pendingChunkPromise;
        window.mushu.emitAudioChunk({ done: true, ts: Date.now() });
      }
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };

    const startCapture = async (deviceId?: string | null) => {
      await stopCapture();
      console.info("[capture] starting microphone capture", deviceId ? `device=${deviceId}` : "(default)");

      // Verificar si hay micrófonos disponibles
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      if (mics.length === 0) {
        throw new Error("NO_MICROPHONE");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
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
        pendingChunkPromise = event.data.arrayBuffer().then((buffer) => {
          console.info(`[capture] audio chunk ${buffer.byteLength} bytes`);
          window.mushu.emitAudioChunk({
            bytes: buffer,
            mimeType,
            ts: Date.now(),
          });
        });
      };
      recorder.start(250);

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const sample of data) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / data.length);
        window.mushu.emitAudioChunk({
          level: Math.min(1, rms * 5),
          ts: Date.now(),
        });
        analyserFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    };

    const unsubs: Array<Promise<() => void>> = [];
    unsubs.push(
      listen("recording_started", (event) => {
        const payload = event.payload as { microphone?: string | null } | null;
        const deviceId = payload?.microphone;
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
        void stopCapture();
      }),
    );
    unsubs.push(
      listen("dictation_cancelled", () => {
        void stopCapture();
      }),
    );

    return () => {
      void stopCapture();
      for (const u of unsubs) void u.then((off) => off());
    };
  }, []);
}
