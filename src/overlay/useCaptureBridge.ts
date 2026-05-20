import { useEffect, useRef } from "react";
import { listen } from "@/lib/events";

export function useCaptureBridge() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const stopAnalyser = () => {
      if (analyserFrameRef.current !== null) {
        cancelAnimationFrame(analyserFrameRef.current);
        analyserFrameRef.current = null;
      }
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

    const startCapture = async () => {
      stopCapture();
      console.info("[capture] starting microphone capture");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
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
      listen("recording_started", () => {
        void startCapture().catch((error) => {
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
