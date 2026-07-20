import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, ChevronDown, ChevronRight, Copy, LogIn } from "lucide-react";
import { useState } from "react";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { CopyButton } from "@/components/CopyButton";
import { tauri } from "@/lib/tauri";
import { MetricCard } from "@/components/MetricCard";
import { ModeChip } from "@/components/ModeChip";
import { ShortcutKbd } from "@/components/ShortcutKbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TextAnimate } from "@/components/ui/text-animate";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { useDictation } from "@/hooks/useDictation";
import { useHomeMetrics } from "@/hooks/useHomeMetrics";
import { useVoiceAgents } from "@/hooks/useVoiceAgents";
import { Skeleton } from "@/components/Skeleton";
import { useHistoryContext } from "@/context/HistoryContext";
import { Ripple } from "@/components/ui/ripple";
import { HistoryPage } from "@/pages/HistoryPage";
import {
  MODE_ICONS,
  MODE_ICONS_BY_NAME,
  MODE_LABELS,
  MODE_NAMES,
  modeLabel,
} from "@/lib/modes";
import type { ModeName, NavSection } from "@/lib/types";

function RowCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await tauri.copyToClipboard(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : "Copy"}
      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      style={{
        width: "28px",
        height: "28px",
        borderRadius: "var(--radius)",
        background: "transparent",
        border: "0.5px solid var(--border)",
        color: copied ? "var(--foreground)" : "var(--muted-foreground)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s",
      }}
    >
      {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2.25} />}
    </button>
  );
}

function relativeTime(iso: string) {
  const now = new Date();
  const then = new Date(iso);
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 2) return "yesterday";
  return then.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

type HomePageProps = {
  onNavigate?: (section: NavSection) => void;
};

export function HomePage({ onNavigate }: HomePageProps = {}) {
  const { status, mode, hotkey, modeHotkey, resultText, errorMessage, setMode } = useDictation();
  const { activeAgent } = useVoiceAgents();
  const [modeOpen, setModeOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { items, loading } = useHistoryContext();
  const { isSignedIn, loaded: accountLoaded } = useAccountStatus();
  const isRecording = status === "recording";
  const audioLevel = useAudioLevel(isRecording);
  const showSignedOutBanner = accountLoaded && !isSignedIn;

  const metrics = useHomeMetrics();
  const recentHistory = items.slice(0, 3);

  const hotkeyParts = hotkey.split("+");
  const modeHotkeyParts = modeHotkey.split("+");

  return (
    <div className="flex h-full flex-col" style={{ minHeight: 0 }}>
      {/* Topbar */}
      <div
        className="mushu-topbar flex items-center justify-between px-6 py-4"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-3">
          <SidebarTrigger style={{ color: "var(--muted-foreground)" }} />
          <div>
            <h1
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--foreground)",
                lineHeight: 1.15,
                letterSpacing: "-0.025em",
                margin: 0,
              }}
            >
              Home
            </h1>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12.5px",
                fontWeight: 450,
                color: "var(--muted-foreground)",
                marginTop: "2px",
              }}
            >
              Ready to dictate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeAgent && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5"
              title={activeAgent.instruction}
              style={{
                border: "0.5px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <Bot size={12} strokeWidth={2.25} style={{ color: "var(--muted-foreground)" }} />
              <span
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--foreground)",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {activeAgent.name}
              </span>
            </div>
          )}
          <Popover open={modeOpen} onOpenChange={setModeOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5"
                style={{
                  background: "transparent",
                  border: "0.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <span
                  className="animate-mode-pulse rounded-full"
                  style={{
                    width: "6px",
                    height: "6px",
                    background: "var(--muted-foreground)",
                    flexShrink: 0,
                    display: "block",
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "var(--foreground)",
                  }}
                >
                  {mode.label}
                </span>
                <ChevronDown
                  size={11}
                  strokeWidth={2.5}
                  style={{
                    color: "var(--muted-foreground)",
                    transition: "transform 0.2s",
                    transform: modeOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              style={{
                background: "var(--popover)",
                border: "0.5px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "14px",
                width: "280px",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className="tracking-widest"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "9px",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                  }}
                >
                  Dictation mode
                </span>
                <ShortcutKbd keys={modeHotkeyParts} size="sm" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MODE_NAMES.map((name) => {
                  const Icon = MODE_ICONS[MODE_ICONS_BY_NAME[name as ModeName]];
                  const label = MODE_LABELS[name as ModeName];
                  const isActive = mode.name === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setMode(name as ModeName).catch(() => {});
                        setModeOpen(false);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        padding: "12px 6px 10px",
                        borderRadius: "var(--radius)",
                        background: isActive ? "var(--foreground)" : "transparent",
                        border: isActive
                          ? "0.5px solid var(--foreground)"
                          : "0.5px solid var(--border)",
                        cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s, color 0.15s",
                      }}
                    >
                      <Icon
                        size={18}
                        strokeWidth={isActive ? 2.25 : 1.85}
                        style={{
                          color: isActive ? "var(--background)" : "var(--muted-foreground)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "'Geist Variable', sans-serif",
                          fontSize: "11px",
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? "var(--background)" : "var(--muted-foreground)",
                          textAlign: "center",
                          lineHeight: 1.2,
                        }}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {showSignedOutBanner && (
        <div className="px-6 pt-4" style={{ flexShrink: 0 }}>
          <div
            role="status"
            className="flex items-center gap-3 px-4 py-3"
            style={{
              border: "0.5px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--card)",
            }}
          >
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "var(--foreground)",
              }}
            >
              <LogIn size={13} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--foreground)",
                  lineHeight: 1.3,
                }}
              >
                You're not signed in to Mushu
              </p>
              <p
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "12px",
                  fontWeight: 450,
                  color: "var(--muted-foreground)",
                  lineHeight: 1.4,
                  marginTop: "2px",
                }}
              >
                Sign in to use dictation, the agent, and trial minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("account")}
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--primary-foreground)",
                background: "var(--primary)",
                border: "none",
                borderRadius: "var(--radius)",
                padding: "8px 14px",
                cursor: "pointer",
                flexShrink: 0,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* Metrics — 4 cards in a grid */}
        <div className="grid grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: "84px" }} />
            ))
          ) : (
            <>
              <MetricCard
                label="Words today"
                value={metrics.wordsToday}
                delta={metrics.wordsTodayDelta ?? undefined}
              />
              <MetricCard
                label="Words / wk."
                value={metrics.wordsWeek}
                delta={metrics.wordsWeekDelta ?? undefined}
              />
              <MetricCard
                label="Min / wk."
                value={metrics.minutesWeek}
                unit="min"
                delta={metrics.minutesWeekDelta ?? undefined}
              />
              <MetricCard
                label="Avg. speed"
                value={metrics.velocityToday}
                unit={metrics.velocityToday !== "--" ? "wpm" : ""}
                delta={metrics.velocityTodayDelta ?? undefined}
              />
            </>
          )}
        </div>

        {/* Push-to-talk hero — wrapped in a card so it doesn't drown in whitespace */}
        <div
          className="mt-5 flex flex-col items-center gap-7 px-4 py-10"
          style={{
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--card)",
            minHeight: "260px",
          }}
        >
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col items-center gap-6"
              >
                <span
                  className="tracking-widest"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                    fontWeight: 700,
                  }}
                >
                  Push-to-talk
                </span>

                <div className="flex items-center gap-2">
                  {hotkeyParts.map((k, i) => (
                    <span key={`${k}-${i}`} className="flex items-center gap-2">
                      <kbd
                        className="tabular"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "60px",
                          height: "44px",
                          padding: "0 16px",
                          borderRadius: "var(--radius)",
                          fontFamily: "'Space Mono', monospace",
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--foreground)",
                          background: "var(--card)",
                          border: "0.5px solid var(--border)",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {k}
                      </kbd>
                      {i < hotkeyParts.length - 1 && (
                        <span
                          style={{
                            fontFamily: "'Space Mono', monospace",
                            fontSize: "14px",
                            fontWeight: 500,
                            color: "var(--muted-foreground)",
                          }}
                        >
                          +
                        </span>
                      )}
                    </span>
                  ))}
                </div>

                <p
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "13.5px",
                    fontWeight: 450,
                    color: "var(--muted-foreground)",
                    textAlign: "center",
                    maxWidth: "440px",
                    lineHeight: 1.55,
                  }}
                >
                  Hold the shortcut and talk in any app — release to transcribe.
                </p>

                <div
                  aria-hidden
                  style={{
                    width: "40px",
                    height: "0.5px",
                    background: "var(--border)",
                  }}
                />

                <div className="flex items-center gap-3">
                  <span
                    className="tracking-widest"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "9.5px",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      fontWeight: 700,
                    }}
                  >
                    Agent mode
                  </span>
                  <ShortcutKbd keys={modeHotkeyParts} size="sm" />
                </div>
              </motion.div>
            )}

            {status === "recording" && (
              <motion.div
                key="recording"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.22 }}
                className="relative flex h-56 w-full items-center justify-center"
              >
                <Ripple
                  mainCircleSize={110 + audioLevel * 80}
                  mainCircleOpacity={0.12 + audioLevel * 0.3}
                  numCircles={5}
                />
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div
                    className="flex items-center gap-2 px-3 py-1"
                    style={{
                      background: "var(--card)",
                      border: "0.5px solid var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    <span className="relative flex size-2">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ background: "var(--destructive)" }}
                      />
                      <span
                        className="relative inline-flex size-2 rounded-full"
                        style={{ background: "var(--destructive)" }}
                      />
                    </span>
                    <span
                      style={{
                        fontFamily: "'Geist Variable', sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--foreground)",
                      }}
                    >
                      Listening…
                    </span>
                  </div>
                  <ShortcutKbd keys={hotkeyParts} />
                  <p
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "11px",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Release to transcribe
                  </p>
                </div>
              </motion.div>
            )}

            {status === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex gap-1.5">
                  <span
                    className="size-2 animate-bounce rounded-full [animation-delay:-0.3s]"
                    style={{ background: "var(--foreground)" }}
                  />
                  <span
                    className="size-2 animate-bounce rounded-full [animation-delay:-0.15s]"
                    style={{ background: "var(--foreground)" }}
                  />
                  <span
                    className="size-2 animate-bounce rounded-full"
                    style={{ background: "var(--foreground)" }}
                  />
                </div>
                <p
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--muted-foreground)",
                  }}
                >
                  Transcribing…
                </p>
              </motion.div>
            )}

            {status === "result" && resultText && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
                className="w-full max-w-xl px-2"
              >
                <div
                  className="relative overflow-hidden p-5"
                  style={{
                    background: "var(--card)",
                    border: "0.5px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <ModeChip mode={mode} />
                    <CopyButton text={resultText} variant="ghost" />
                  </div>
                  <TextAnimate
                    animation="blurInUp"
                    by="word"
                    duration={0.5}
                    once
                    startOnView={false}
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "15px",
                      fontWeight: 450,
                      lineHeight: 1.6,
                      color: "var(--foreground)",
                    }}
                  >
                    {resultText}
                  </TextAnimate>
                </div>
              </motion.div>
            )}

            {status === "error" && errorMessage && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full max-w-md px-2"
              >
                <div
                  className="p-4"
                  style={{
                    background:
                      "color-mix(in oklab, var(--destructive) 10%, transparent)",
                    border:
                      "0.5px solid color-mix(in oklab, var(--destructive) 35%, transparent)",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--destructive)",
                    }}
                  >
                    {errorMessage}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent history — flat list, hairline dividers */}
        <div className="mt-2">
          <div className="mb-3 flex items-center justify-between px-1">
            <span
              className="tracking-widest"
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "9px",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
              }}
            >
              Recent history
            </span>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1"
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "11.5px",
                fontWeight: 500,
                color: "var(--muted-foreground)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--foreground)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted-foreground)")}
            >
              See all
              <ChevronRight size={12} strokeWidth={2.25} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} style={{ height: "56px" }} />
              ))}
            </div>
          ) : recentHistory.length === 0 ? (
            <div
              className="p-6 text-center"
              style={{
                border: "0.5px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--card)",
              }}
            >
              <p
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "13px",
                  fontWeight: 450,
                  color: "var(--muted-foreground)",
                }}
              >
                No sessions yet. Hold the shortcut and start talking.
              </p>
            </div>
          ) : (
            <div
              className="overflow-hidden"
              style={{
                border: "0.5px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--card)",
              }}
            >
              {recentHistory.map((item, i) => {
                const Icon =
                  MODE_ICONS[MODE_ICONS_BY_NAME[item.mode_used as ModeName] ?? "Mic"] ??
                  MODE_ICONS.Mic;
                const label = modeLabel(item.mode_used);
                const text = item.processed_text || item.raw_text;
                return (
                  <div
                    key={item.id}
                    className="group flex items-start gap-3 px-4 py-3"
                    style={{
                      borderTop: i === 0 ? "none" : "0.5px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "var(--radius)",
                        background: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      <Icon size={12} strokeWidth={2} style={{ color: "var(--muted-foreground)" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span
                          style={{
                            fontFamily: "'Geist Variable', sans-serif",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "var(--foreground)",
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Space Mono', monospace",
                            fontSize: "10px",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          · {relativeTime(item.timestamp)}
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "'Geist Variable', sans-serif",
                          fontSize: "12.5px",
                          fontWeight: 450,
                          color:
                            "color-mix(in oklab, var(--foreground) 75%, transparent)",
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {text}
                      </p>
                    </div>
                    <RowCopyButton text={text} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side="right"
          className="w-[560px] sm:max-w-[560px] p-0"
          style={{
            background: "var(--background)",
            border: "0.5px solid var(--border)",
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Full history</SheetTitle>
          </SheetHeader>
          <HistoryPage embedded />
        </SheetContent>
      </Sheet>
    </div>
  );
}
