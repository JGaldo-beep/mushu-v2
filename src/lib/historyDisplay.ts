import { Bot, Mic, type LucideIcon } from "lucide-react";

// History entries tag their source via HistoryItem.mode_used: "DEFAULT" for
// plain dictation, "AGENT" for the selection agent, or "Agent: <name>" for a
// Voice Agent. These helpers turn that string into a display icon/label.
export const HISTORY_BADGE_COLOR = "var(--primary)";

/** Tint helper — hex-alpha suffixes (`${color}14`) are invalid once the value is a var(). */
export const historyBadgeTint = (percent: number) =>
  `color-mix(in oklab, ${HISTORY_BADGE_COLOR} ${percent}%, transparent)`;

export function historyIcon(modeUsed: string): LucideIcon {
  return modeUsed.startsWith("Agent:") || modeUsed === "AGENT" ? Bot : Mic;
}

export function historyLabel(modeUsed: string): string {
  if (modeUsed === "DEFAULT") return "General";
  if (modeUsed === "AGENT") return "Agent";
  return modeUsed;
}
