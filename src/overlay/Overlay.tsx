import { AnimatePresence, motion } from "framer-motion";
import { Pause } from "lucide-react";
import { MushuReplyCard } from "@/overlay/components/MushuReplyCard";
import { ThinkingDots } from "@/overlay/components/ThinkingDots";
import { WaveBars } from "@/overlay/components/WaveBars";
import { useAudioLevel } from "@/overlay/useAudioLevel";
import { useCaptureBridge } from "@/overlay/useCaptureBridge";
import { useMicrophoneWatcher } from "@/overlay/useMicrophoneWatcher";
import { useOverlayState } from "@/overlay/useOverlayState";
import { cn } from "@/lib/utils";

const ease = [0.33, 1, 0.68, 1] as const;
const transition = { duration: 0.22, ease } as const;

// The pill carries one thing at a time: the wave, the thinking dots, or the agent
// name for a moment after it changes. No badge, no logo, no live transcript — at
// rest it shows still dots and does nothing at all, which is the whole point.
export function Overlay() {
  useCaptureBridge();
  useMicrophoneWatcher();
  const {
    activeVoiceAgent,
    modeBannerOnly,
    bannerText,
    mushuReplyText,
    modePopToken,
    isProcessing,
    isReply,
    showPill,
    showThinking,
    transcriptionFadeOut,
    audioLevelActive,
    isPaused,
  } = useOverlayState();

  const audioLevel = useAudioLevel(audioLevelActive);
  const waveIdle = audioLevel < 0.04;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-1">
      <AnimatePresence mode="wait">
        {showPill && (
          <motion.div
            key="pill-shell"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: transcriptionFadeOut ? 0 : 1,
              scale: transcriptionFadeOut ? 0.96 : 1,
            }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={transition}
            className={cn(
              "overlay-pill-surface text-foreground",
              isReply ? "w-full max-w-[min(100%,408px)]" : "overlay-pill-compact",
              modeBannerOnly && !isReply && "overlay-pill-banner",
            )}
          >
            <AnimatePresence mode="wait">
              {isReply && mushuReplyText !== null ? (
                <motion.div
                  key="reply"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={transition}
                >
                  <MushuReplyCard text={mushuReplyText} />
                </motion.div>
              ) : modeBannerOnly ? (
                <motion.span
                  key={`agent-${modePopToken}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={transition}
                  className="overlay-agent-label"
                >
                  {bannerText ?? activeVoiceAgent ?? "General"}
                </motion.span>
              ) : isProcessing ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  {showThinking ? (
                    <ThinkingDots />
                  ) : (
                    <span className="inline-block min-h-4 min-w-10" aria-hidden />
                  )}
                </motion.div>
              ) : isPaused ? (
                // Red still bars alone read as "can't hear you". Paused is a state the
                // user chose, so the pill names it.
                <motion.span
                  key="paused"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={transition}
                  className="overlay-paused-label"
                  role="status"
                >
                  <Pause size={10} strokeWidth={3} fill="currentColor" aria-hidden />
                  Paused
                </motion.span>
              ) : (
                <motion.div
                  key="wave"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <WaveBars
                    level={audioLevel}
                    color="#FFFFFF"
                    idle={waveIdle}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
