import { Mail, Mic, StickyNote, type LucideIcon } from "lucide-react";
import type { ModeIconName, ModeInfo, ModeName } from "./types";

export const MODE_ICONS: Record<ModeIconName, LucideIcon> = {
  Mic,
  Mail,
  StickyNote,
};

export const MODE_LABELS: Record<ModeName, string> = {
  DEFAULT: "General",
  EMAIL: "Email",
  NOTE: "Note",
};

export const MODE_DESCRIPTIONS: Record<ModeName, string> = {
  DEFAULT: "Clean transcription, no rewrites.",
  EMAIL: "Formal tone, structured paragraphs.",
  NOTE: "Casual, bullets and fragments allowed.",
};

// Editorial monochrome: modes are differentiated by LABEL, not color.
// All three dots resolve to mid-gray that reads on both light and dark.
// Recording state shows the destructive red separately.
export const MODE_COLORS: Record<ModeName, string> = {
  DEFAULT: "#737373",
  EMAIL: "#737373",
  NOTE: "#737373",
};

export const MODE_ICONS_BY_NAME: Record<ModeName, ModeIconName> = {
  DEFAULT: "Mic",
  EMAIL: "Mail",
  NOTE: "StickyNote",
};

export const MODE_NAMES: ModeName[] = ["DEFAULT", "EMAIL", "NOTE"];

export const DEFAULT_MODE: ModeInfo = {
  name: "DEFAULT",
  label: MODE_LABELS.DEFAULT,
  color: MODE_COLORS.DEFAULT,
  icon: "Mic",
};

const KNOWN_MODES = new Set<string>(MODE_NAMES);

/** Returns a fully-populated ModeInfo, falling back to DEFAULT for unknown names. */
export function normalizeMode(m: Partial<ModeInfo> & { name?: string }): ModeInfo {
  const name = (m.name && KNOWN_MODES.has(m.name) ? m.name : "DEFAULT") as ModeName;
  return {
    name,
    label: m.label || MODE_LABELS[name],
    color: m.color || MODE_COLORS[name],
    icon: m.icon || MODE_ICONS_BY_NAME[name],
  };
}

/** Display label for any mode string (including legacy ones from old history). */
export function modeLabel(name: string): string {
  if (name in MODE_LABELS) return MODE_LABELS[name as ModeName];
  return name;
}

/** Display color for any mode string. */
export function modeColor(name: string): string {
  if (name in MODE_COLORS) return MODE_COLORS[name as ModeName];
  return "#737373";
}
