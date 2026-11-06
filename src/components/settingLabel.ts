import { createContext, useContext } from "react";

// A settings row's visible label, handed to the control inside it so toggles, selects and
// hotkey buttons are announced by name ("Auto-switch microphone, switch, on") instead of
// as an anonymous "switch, on".
export type SettingLabel = { id: string; label: string };

export const SettingLabelContext = createContext<SettingLabel | null>(null);

export function useSettingLabel(): SettingLabel | null {
  return useContext(SettingLabelContext);
}
