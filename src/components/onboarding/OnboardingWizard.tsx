import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Mic, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ShortcutKbd } from "@/components/ShortcutKbd";
import { Button } from "@/components/ui/button";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import { useCopy } from "@/i18n";
import { onboardingCopy } from "@/i18n/onboarding";
import { patchSettings, tauri } from "@/lib/tauri";
import type { MushuAccount } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["welcome", "mic", "shortcuts", "signin", "done"] as const;
const STEP_COUNT = STEPS.length;

// The brand is monochrome glass, so the confetti is too: whites and greys from the logo's
// bars, with the darker greys there so it still shows up over the light theme.
const CONFETTI_COLORS = ["#FFFFFF", "#E4E4E7", "#C9C9CF", "#A1A1AA", "#71717A", "#3F3F46"];
type ConfettiStyle = CSSProperties & {
  "--tx": string;
  "--ty": string;
  "--rot": string;
};

type T = (typeof onboardingCopy)["en"];

const ease = [0.33, 1, 0.68, 1] as const;
const stepTransition = { duration: 0.2, ease } as const;
const SIGNIN_INDEX = STEPS.indexOf("signin");
// How long to wait for the deep link before suggesting the browser may have blocked it.
const LONG_WAIT_MS = 45_000;

type Props = {
  hotkey: string;
  pttHotkey: string;
  account: MushuAccount | null;
  apiBaseUrl: string;
  onComplete: () => Promise<void>;
  // Tell the onboarding hook to keep the wizard open once sign-in is underway.
  onHoldOpen: (hold: boolean) => void;
};

export function OnboardingWizard({
  hotkey,
  pttHotkey,
  account,
  apiBaseUrl,
  onComplete,
  onHoldOpen,
}: Props) {
  const t = useCopy(onboardingCopy);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [finishError, setFinishError] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const signedInEmail = account?.user.email || null;
  const prevSignedInEmailRef = useRef<string | null>(signedInEmail);

  useEffect(() => {
    if (!prevSignedInEmailRef.current && signedInEmail) {
      setConfettiSeed((s) => s + 1);
    }
    prevSignedInEmailRef.current = signedInEmail;
  }, [signedInEmail]);

  const step = STEPS[stepIndex];
  const isTrial = account?.entitlement?.status === "trial";

  useEffect(() => {
    onHoldOpen(stepIndex >= SIGNIN_INDEX);
  }, [stepIndex, onHoldOpen]);
  const dictationParts = hotkey.split("+");
  const pttParts = pttHotkey.split("+");

  const goNext = () => {
    setDirection(1);
    setStepIndex((s) => Math.min(STEP_COUNT - 1, s + 1));
  };
  const goBack = () => {
    setDirection(-1);
    setStepIndex((s) => Math.max(0, s - 1));
  };

  const finish = async () => {
    setBusy(true);
    setFinishError(false);
    try {
      await onComplete();
    } catch {
      setFinishError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease }}
        className="relative w-full max-w-[640px]"
      >
        <div
          className="relative overflow-hidden rounded-xl bg-card"
          style={{
            border: "0.5px solid var(--border)",
            boxShadow:
              "0 1px 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08), 0 24px 80px rgba(0,0,0,0.10)",
          }}
        >
          {confettiSeed > 0 ? <ConfettiBurst key={confettiSeed} /> : null}

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-8 pt-7">
            <span
              className="text-[10.5px] uppercase text-muted-foreground"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.18em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.step(String(stepIndex + 1).padStart(2, "0"), String(STEP_COUNT).padStart(2, "0"))}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish()}
              className="relative text-[11px] uppercase text-muted-foreground transition-colors before:absolute before:-inset-x-2 before:-inset-y-3 hover:text-foreground disabled:opacity-50"
              style={{ letterSpacing: "0.14em" }}
            >
              {t.skip}
            </button>
          </div>

          {/* Step body */}
          <div className="relative min-h-[380px] px-8 pb-2 pt-5">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                initial={{ opacity: 0, x: direction * 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -18 }}
                transition={stepTransition}
                className="flex flex-col gap-6"
              >
                {step === "welcome" && <WelcomeStep />}
                {step === "mic" && <MicStep active />}
                {step === "shortcuts" && (
                  <ShortcutsStep dictationParts={dictationParts} pttParts={pttParts} />
                )}
                {step === "signin" && (
                  <SignInStep signedInEmail={signedInEmail} isTrial={isTrial} apiBaseUrl={apiBaseUrl} />
                )}
                {step === "done" && (
                  <DoneStep signedInEmail={signedInEmail} dictationParts={dictationParts} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {finishError ? (
            <p role="alert" className="px-8 pb-3 text-[12px] text-destructive">
              {t.finishFailed}
            </p>
          ) : null}

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-4 px-8 py-5"
            style={{ borderTop: "0.5px solid var(--border)" }}
          >
            <Button
              type="button"
              variant="ghost"
              disabled={stepIndex === 0 || busy}
              onClick={goBack}
              className="h-10 gap-1.5 text-muted-foreground"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              {t.back}
            </Button>

            <div className="flex items-center gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-[3px] rounded-full transition-[width,background-color] duration-200 ease-out",
                    i === stepIndex
                      ? "w-7 bg-foreground"
                      : i < stepIndex
                        ? "w-3 bg-foreground/55"
                        : "w-3 bg-foreground/15",
                  )}
                />
              ))}
            </div>

            {step === "signin" && !signedInEmail ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={goNext} className="h-10 text-muted-foreground">
                {t.skipForNow}
              </Button>
            ) : stepIndex < STEP_COUNT - 1 ? (
              <Button type="button" disabled={busy} onClick={goNext} className="h-10 gap-1.5">
                {t.next}
                <ArrowRight size={14} strokeWidth={2} />
              </Button>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void finish()} className="h-10">
                {busy ? t.finishing : t.start}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step layout helpers
 * ------------------------------------------------------------------ */

function StepHeader({ numeral, title }: { numeral: string; title: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <div className="flex items-start gap-5">
      <span
        aria-hidden
        className="select-none text-muted-foreground/35"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "44px",
          lineHeight: 1,
          fontWeight: 300,
          letterSpacing: "-0.04em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {numeral}
      </span>
      <div className="flex-1 pt-1">
        <h2
          ref={headingRef}
          id="onboarding-title"
          tabIndex={-1}
          className="text-balance text-foreground outline-none"
          style={{
            fontSize: "28px",
            lineHeight: 1.1,
            fontWeight: 600,
            letterSpacing: "-0.03em",
          }}
        >
          {title}
        </h2>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Welcome
 * ------------------------------------------------------------------ */

function WelcomeStep() {
  const t = useCopy(onboardingCopy);
  return (
    <>
      <StepHeader numeral="01" title={t.welcomeTitle} />
      <p
        className="text-foreground/85"
        style={{ fontSize: "15px", lineHeight: 1.6, maxWidth: "52ch" }}
      >
        {t.welcomeBody}
      </p>
      <div
        className="mt-2 inline-flex items-center gap-2 self-start rounded-full px-3 py-1"
        style={{
          background: "var(--muted)",
          border: "0.5px solid var(--border)",
        }}
      >
        <Mic size={12} strokeWidth={2.4} className="text-muted-foreground" />
        <span
          className="text-[11px] text-muted-foreground"
          style={{ letterSpacing: "0.02em" }}
        >
          {t.welcomeBadge}
        </span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Microphone check
 * ------------------------------------------------------------------ */

function MicStep({ active }: { active: boolean }) {
  const t = useCopy(onboardingCopy);
  const { devices, defaultLabel, refresh, needsPermission } = useAudioDevices();
  const [deviceId, setDeviceId] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  // Bumped by Refresh so the level meter retries after a permission fix.
  const [retryKey, setRetryKey] = useState(0);
  const { level, error, hasSignal } = useMicLevel(active, deviceId || null, retryKey);

  useEffect(() => {
    let cancelled = false;
    void tauri
      .getFrontendState()
      .then((fs) => {
        if (!cancelled) setDeviceId(fs.selected_microphone ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDeviceChange = async (next: string) => {
    setDeviceId(next);
    try {
      // The label lets startup re-match the device after an unplug, as Settings does.
      const label = devices.find((d) => d.deviceId === next)?.label ?? null;
      await patchSettings({ selected_microphone: next || null, selected_microphone_label: next ? label : null });
    } catch {
      /* ignore — they can adjust in Settings */
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      setRetryKey((k) => k + 1);
    } finally {
      window.setTimeout(() => setRefreshing(false), 400);
    }
  };

  return (
    <>
      <StepHeader numeral="02" title={t.micTitle} />
      <p
        className="text-foreground/80"
        style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "52ch" }}
      >
        {t.micBody}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <select
            value={deviceId}
            aria-label={t.micDeviceLabel}
            onChange={(e) => void handleDeviceChange(e.target.value)}
            className="glass-input h-10 w-full rounded-md px-3 text-sm transition-colors"
          >
            <option value="">
              {defaultLabel ? `${t.micSystemDefault}: ${defaultLabel}` : t.micSystemDefault}
            </option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          aria-label={t.micRefresh}
          className="flex size-10 items-center justify-center rounded-md bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            className={refreshing ? "animate-spin" : ""}
          />
        </button>
      </div>

      {/* Live level meter */}
      <div
        className="rounded-lg p-5"
        style={{
          background: "var(--muted)",
          border: "0.5px solid var(--border)",
        }}
      >
        <MicBars level={level} active={active && !error} />
        <div className="mt-4 flex items-center justify-between gap-3 text-[12px]">
          <span role="status" aria-live="polite">
          {error ? (
            <span role="alert" className="text-destructive">{humanizeMicError(error, t)}</span>
          ) : needsPermission ? (
            <span className="text-muted-foreground">
              {t.micAllow}
            </span>
          ) : hasSignal ? (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Check size={12} strokeWidth={2.4} />
              {t.micHeard}
            </span>
          ) : (
            <span className="text-muted-foreground">{t.micSpeak}</span>
          )}
          </span>
          <span
            aria-hidden
            className="text-muted-foreground"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.04em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(level * 100)
              .toString()
              .padStart(2, "0")}
            %
          </span>
        </div>
      </div>
    </>
  );
}

function MicBars({ level, active }: { level: number; active: boolean }) {
  const BAR_COUNT = 28;
  const MIN_H = 4;
  const MAX_H = 44;
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const renderedRef = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, () => MIN_H),
  );
  const levelRef = useRef(level);
  levelRef.current = level;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let raf = 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      const lv = activeRef.current ? Math.max(0, Math.min(1, levelRef.current)) : 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
        const noise = 0.55 + Math.sin(i * 1.43) * 0.22;
        const pulse = still
          ? 0.8
          : 0.6 + Math.sin(now / 92 + i * 0.7) * 0.22 + Math.sin(now / 153 + i * 1.21) * 0.13;
        const idleBreath = still ? 0 : (Math.sin(now / 720 + i * 0.38) + 1) * 0.5 * 0.04;
        const voice = lv * (noise + center * 0.5) * pulse;
        const target = MIN_H + Math.max(idleBreath, voice) * (MAX_H - MIN_H);
        renderedRef.current[i] += (target - renderedRef.current[i]) * 0.32;
        const el = barsRef.current[i];
        if (el) el.style.height = `${renderedRef.current[i]}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="flex h-[52px] items-center justify-center"
      style={{ gap: "3px" }}
      aria-hidden
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const center = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
        return (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="rounded-full bg-foreground"
            style={{
              width: "3px",
              height: MIN_H,
              opacity: 0.32 + center * 0.45,
            }}
          />
        );
      })}
    </div>
  );
}

function useMicLevel(active: boolean, deviceId: string | null, retryKey: number) {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasSignal, setHasSignal] = useState(false);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      setHasSignal(false);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let signalSeen = false;

    (async () => {
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId
            ? {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;
        const sink = ctx.createGain();
        sink.gain.value = 0;
        source.connect(analyser);
        analyser.connect(sink);
        sink.connect(ctx.destination);

        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) {
            const c = (v - 128) / 128;
            sum += c * c;
          }
          const rms = Math.sqrt(sum / buf.length);
          const next = Math.min(1, rms * 6);
          setLevel((prev) => prev + (next - prev) * 0.28);
          if (!signalSeen && next > 0.08) {
            signalSeen = true;
            setHasSignal(true);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLevel(0);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
    };
  }, [active, deviceId, retryKey]);

  return { level, error, hasSignal };
}

/* ------------------------------------------------------------------ *
 * Shortcuts
 * ------------------------------------------------------------------ */

function ShortcutsStep({
  dictationParts,
  pttParts,
}: {
  dictationParts: string[];
  pttParts: string[];
}) {
  const t = useCopy(onboardingCopy);
  return (
    <>
      <StepHeader numeral="03" title={t.shortcutsTitle} />
      <p
        className="text-foreground/80"
        style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "52ch" }}
      >
        {t.shortcutsBody}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ShortcutCard
          label={t.dictationLabel}
          description={t.dictationHint}
          keys={dictationParts}
        />
        <ShortcutCard
          label={t.pttLabel}
          description={t.pttHint}
          keys={pttParts}
        />
      </div>
    </>
  );
}

function ShortcutCard({
  label,
  description,
  keys,
}: {
  label: string;
  description: string;
  keys: string[];
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{
        background: "var(--muted)",
        border: "0.5px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[11px] uppercase text-muted-foreground"
          style={{ letterSpacing: "0.12em" }}
        >
          {label}
        </span>
      </div>
      <ShortcutKbd keys={keys} />
      <p className="text-[12.5px] leading-snug text-muted-foreground">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sign in (optional)
 * ------------------------------------------------------------------ */

function SignInStep({
  signedInEmail,
  isTrial,
  apiBaseUrl,
}: {
  signedInEmail: string | null;
  isTrial: boolean;
  apiBaseUrl: string;
}) {
  const t = useCopy(onboardingCopy);
  const [waiting, setWaiting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(false);

  // The button that was focused unmounts when waiting starts or stops; move focus to its
  // counterpart instead of dropping it on <body>.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    (waiting ? reopenRef : continueRef).current?.focus();
  }, [waiting]);

  // Escape cancels the wait; past LONG_WAIT_MS, say what usually went wrong.
  useEffect(() => {
    if (!waiting) {
      setLongWait(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWaiting(false);
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => setLongWait(true), LONG_WAIT_MS);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [waiting]);

  // When the session lands, stop waiting.
  useEffect(() => {
    if (signedInEmail && waiting) setWaiting(false);
  }, [signedInEmail, waiting]);

  const openBrowser = async () => {
    if (opening) return;
    setError(null);
    setOpening(true);
    try {
      const base = (apiBaseUrl || "https://mushu.space").replace(/\/$/, "");
      await tauri.openExternalUrl(`${base}/login?from=app`);
      setWaiting(true);
    } catch (e) {
      setError(humanizeAuthError(e, t));
    } finally {
      setOpening(false);
    }
  };

  if (signedInEmail) {
    return (
      <>
        <StepHeader numeral="04" title={t.signedInTitle} />
        <p
          className="text-foreground/80"
          style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "52ch" }}
        >
          {t.signedInBefore}
          <span className="text-foreground font-medium">{signedInEmail}</span>
          {t.signedInMiddle}
          <span className="text-foreground">mushu.space</span>
          {t.signedInAfter}
        </p>
        {isTrial ? (
        <div
          className="inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5"
          style={{
            background: "var(--accent)",
            border: "0.5px solid var(--border)",
          }}
        >
          <Check size={12} strokeWidth={2.4} className="text-foreground" />
          <span
            className="text-[11.5px] text-foreground"
            style={{ letterSpacing: "0.02em" }}
          >
            {t.trialActive}
          </span>
        </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <StepHeader numeral="04" title={t.signInTitle} />
      <p
        className="text-foreground/80"
        style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "52ch" }}
      >
        {t.signInBefore}
        <span className="text-foreground">mushu.space</span>
        {t.signInAfter}
      </p>

      <div
        className="flex flex-col gap-3 rounded-lg p-5"
        style={{
          background: "var(--muted)",
          border: "0.5px solid var(--border)",
        }}
      >
        {waiting ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Loader2 size={16} strokeWidth={2.2} className="animate-spin text-foreground" />
              <div className="flex flex-col">
                <span
                  className="text-[13.5px] text-foreground"
                  style={{ fontWeight: 500 }}
                >
                  {t.waiting}
                </span>
                <span className="text-[11.5px] text-muted-foreground" aria-live="polite">
                  {longWait ? t.waitingLong : t.waitingHint}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                ref={reopenRef}
                type="button"
                variant="outline"
                disabled={opening}
                onClick={() => void openBrowser()}
                className="h-10 gap-1.5"
              >
                <ExternalLink size={13} strokeWidth={2.2} />
                {t.reopenBrowser}
              </Button>
              <button
                type="button"
                onClick={() => setWaiting(false)}
                className="relative text-[11.5px] text-muted-foreground transition-colors before:absolute before:-inset-x-2 before:-inset-y-3 hover:text-foreground"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <Button
              ref={continueRef}
              type="button"
              disabled={opening}
              onClick={() => void openBrowser()}
              className="h-10 gap-2 self-start"
            >
              {opening ? (
                <Loader2 size={14} strokeWidth={2.2} className="animate-spin motion-reduce:animate-none" />
              ) : (
                <ExternalLink size={14} strokeWidth={2.2} />
              )}
              {opening ? t.opening : t.continueInBrowser}
            </Button>
            <p className="text-[11.5px] text-muted-foreground" style={{ lineHeight: 1.5 }}>
              {t.newHereBefore}
              <span className="text-foreground">mushu.space</span>
              {t.newHereAfter}
            </p>
          </>
        )}
        {error ? (
          <p className="text-[12px] text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <p
        className="text-muted-foreground"
        style={{ fontSize: "11.5px", lineHeight: 1.5 }}
      >
        {t.skipSignInBefore}
        <span className="text-foreground">{t.settingsAccount}</span>
        {t.skipSignInAfter}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Done
 * ------------------------------------------------------------------ */

function DoneStep({
  signedInEmail,
  dictationParts,
}: {
  signedInEmail: string | null;
  dictationParts: string[];
}) {
  const t = useCopy(onboardingCopy);
  return (
    <>
      <StepHeader numeral="05" title={signedInEmail ? t.doneTitle : t.almostTitle} />
      <p
        className="text-foreground/80"
        style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "52ch" }}
      >
        {t.doneBefore}{" "}
        <span className="inline-flex translate-y-[1px] items-center align-middle">
          <ShortcutKbd keys={dictationParts} size="sm" />
        </span>{" "}
        {t.doneAfter}
      </p>

      <p
        className="text-muted-foreground"
        style={{ fontSize: "12.5px", lineHeight: 1.6 }}
      >
        {signedInEmail ? (
          <>
            {t.doneSignedInBefore}
            <span className="text-foreground">{signedInEmail}</span>
            {t.doneSignedInMiddle}
            <span className="text-foreground">{t.settingsAccount}</span>
            {t.doneSignedInAfter}
          </>
        ) : (
          <>
            {t.doneSignedOutBefore}
            <span className="text-foreground">{t.settingsAccount}</span>
            {t.doneSignedOutAfter}
          </>
        )}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Confetti (kept from previous impl, lightly refined)
 * ------------------------------------------------------------------ */

function ConfettiBurst() {
  const particles = Array.from({ length: 24 }, (_, i) => {
    const x = Math.round((Math.random() * 100 - 50) * 10) / 10;
    const y = Math.round((Math.random() * 45 + 55) * 10) / 10;
    const rotate = Math.round(Math.random() * 540 - 270);
    const duration = Math.round((Math.random() * 0.45 + 0.65) * 100) / 100;
    const delay = Math.round(Math.random() * 0.12 * 100) / 100;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return { x, y, rotate, duration, delay, color };
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden motion-reduce:hidden" aria-hidden>
      {particles.map((p, i) => {
        const confettiStyle: ConfettiStyle = {
          backgroundColor: p.color,
          animationName: "mushu-confetti-burst",
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
          animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          animationFillMode: "forwards",
          transform: "translate(-50%, 0)",
          "--tx": `${p.x}vw`,
          "--ty": `${p.y}%`,
          "--rot": `${p.rotate}deg`,
        };
        return (
          <span
            key={`${i}-${p.x}-${p.y}`}
            className="absolute left-1/2 top-12 h-2 w-1 rounded-sm"
            style={confettiStyle}
          />
        );
      })}
      <style>{`
        @keyframes mushu-confetti-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) rotate(0deg) scale(0.7);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--tx)), var(--ty)) rotate(var(--rot)) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function humanizeAuthError(err: unknown, t: T): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/network|fetch|timeout/i.test(raw)) return t.authNetwork;
  return t.authOpenFailed;
}

function humanizeMicError(raw: string, t: T): string {
  if (/permission|denied|notallowed/i.test(raw)) return t.micBlocked;
  if (/notfound|device/i.test(raw)) return t.micNotFound;
  return t.micFailed;
}
