import { useEffect } from "react";
import { listMicrophones } from "@/lib/audioDevices";

// Reports microphones plugged in or out to the main process, which decides whether to
// switch to them (see handleAudioInputsChanged in main.js). It lives in the overlay
// because that renderer is always alive and already holds the microphone permission,
// so device labels are available even while the main window is closed.
export function useMicrophoneWatcher() {
  useEffect(() => {
    let known: Set<string> | null = null;
    let disposed = false;

    const scan = async () => {
      let list;
      try {
        list = await listMicrophones();
      } catch {
        return;
      }
      if (disposed) return;
      const current = new Map(list.devices.map((d) => [d.deviceId, d.label]));
      // The first scan is the baseline: what is already connected is not "new". It is
      // still reported, so a microphone unplugged while Mushu was closed is dropped.
      // Without the permission, ids and labels are blank and prove nothing — skip it.
      if (known === null) {
        known = new Set(current.keys());
        if (!list.missingLabels && list.devices.length > 0) {
          void window.mushu
            .invoke("audio_inputs_changed", { present: [...known], defaultLabel: list.defaultLabel })
            .catch(() => {});
        }
        return;
      }
      const added = list.devices.filter((d) => !known!.has(d.deviceId));
      const removed = [...known].filter((id) => !current.has(id));
      known = new Set(current.keys());
      if (added.length === 0 && removed.length === 0) return;
      void window.mushu
        .invoke("audio_inputs_changed", { added, removed, defaultLabel: list.defaultLabel })
        .catch(() => {});
    };

    // Bluetooth headsets register their endpoints in stages and fire several
    // devicechange events in a row; scan once things settle.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void scan(), 600);
    };

    void scan();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
    };
  }, []);
}
