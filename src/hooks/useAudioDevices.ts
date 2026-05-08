import { useCallback, useEffect, useState } from "react";

export interface AudioDevice {
  deviceId: string;
  label: string;
}

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
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDevice[] = [];
      let missingLabels = false;
      for (const d of all) {
        if (d.kind !== "audioinput") continue;
        if (!d.label) missingLabels = true;
        inputs.push({
          deviceId: d.deviceId,
          label: d.label || `Micrófono ${inputs.length + 1}`,
        });
      }
      setDevices(inputs);
      setNeedsPermission(missingLabels);
    } catch (err) {
      console.warn("[useAudioDevices] enumerate failed:", err);
    }
  }, []);

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

  return { devices, refresh, needsPermission };
}
