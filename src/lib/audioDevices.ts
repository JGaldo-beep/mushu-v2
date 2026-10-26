export interface AudioDevice {
  deviceId: string;
  label: string;
}

// Chromium on Windows lists two pseudo inputs that alias real ones: "default" and
// "communications". They are not devices of their own — listing them showed every
// microphone twice, and "plugging in" one never adds them.
function isPseudoDevice(deviceId: string): boolean {
  return deviceId === "default" || deviceId === "communications";
}

// "Headset Microphone (WH-1000XM4 Hands-Free)" → "WH-1000XM4 Hands-Free". Windows wraps
// the product name in the endpoint type; the product name is what people recognise.
export function friendlyMicLabel(label: string): string {
  const trimmed = label.replace(/^(Default|Communications)\s*-\s*/i, "").trim();
  const inner = /\(([^()]+)\)\s*$/.exec(trimmed)?.[1]?.trim();
  return inner || trimmed;
}

export interface MicrophoneList {
  devices: AudioDevice[];
  // Name of the input Windows currently uses as default, for "System default — X".
  defaultLabel: string | null;
  missingLabels: boolean;
}

export async function listMicrophones(): Promise<MicrophoneList> {
  const all = await navigator.mediaDevices.enumerateDevices();
  const devices: AudioDevice[] = [];
  let defaultLabel: string | null = null;
  let missingLabels = false;
  for (const d of all) {
    if (d.kind !== "audioinput") continue;
    if (!d.label) missingLabels = true;
    if (d.deviceId === "default") {
      defaultLabel = d.label ? friendlyMicLabel(d.label) : null;
      continue;
    }
    if (isPseudoDevice(d.deviceId)) continue;
    devices.push({
      deviceId: d.deviceId,
      label: d.label ? friendlyMicLabel(d.label) : `Microphone ${devices.length + 1}`,
    });
  }
  return { devices, defaultLabel, missingLabels };
}
