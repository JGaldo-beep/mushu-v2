import { useCallback, useEffect, useState } from "react";
import { useCopy } from "@/i18n";
import { overlayCopy } from "@/i18n/overlay";
import { listMicrophones, type AudioDevice } from "@/lib/audioDevices";

export type { AudioDevice };

async function ensureMicPermission(): Promise<void> {
  // enumerateDevices() devuelve labels vacios sin permiso de mic.
  // Pedimos un stream momentaneo solo para desbloquear los nombres.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
  } catch {
    // Permiso denegado o sin mic: igual intentamos enumerar (sin labels).
  }
}

export function useAudioDevices() {
  const { microphoneN } = useCopy(overlayCopy);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [defaultLabel, setDefaultLabel] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listMicrophones(microphoneN);
      setDevices(list.devices);
      setDefaultLabel(list.defaultLabel);
      setNeedsPermission(list.missingLabels);
    } catch (err) {
      console.warn("[useAudioDevices] enumerate failed:", err);
    }
  }, [microphoneN]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureMicPermission();
      if (cancelled) return;
      await refresh();
    })();

    const onChange = () => void refresh();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
    };
  }, [refresh]);

  return { devices, defaultLabel, refresh, needsPermission };
}
