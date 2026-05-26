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

// Mode colors are sage-family variations so they sit cohesively next to the
// canonical primary on both light and dark backgrounds. Picked from the
// chart palette in src/index.css (chart-1, chart-3, chart-4).
export const MODE_COLORS: Record<ModeName, string> = {
  DEFAULT: "#81B09A",
  EMAIL: "#4E7561",
  NOTE: "#B7CFB9",
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
  return "#8A8278";
}
