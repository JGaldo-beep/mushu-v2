import { useEffect, useState, type CSSProperties } from "react";
import { ShortcutKbd } from "@/components/ShortcutKbd";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listen } from "@/lib/events";
import { tauri } from "@/lib/tauri";
import type { MushuAccount, NavSection } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_COUNT = 5;
const CONFETTI_COLORS = ["#0A0A0A", "#262626", "#525252", "#737373", "#A3A3A3", "#D4D4D4"];
type ConfettiStyle = CSSProperties & {
  "--tx": string;
  "--ty": string;
  "--rot": string;
};

type Props = {
  hotkey: string;
  pttHotkey: string;
  account: MushuAccount | null;
  onComplete: () => Promise<void>;
  onNavigateSettings: (section: NavSection) => void;
  onAuthChanged: () => void;
};

export function OnboardingWizard({
  hotkey,
  pttHotkey,
  account,
  onComplete,
  onNavigateSettings,
  onAuthChanged,
}: Props) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(account?.user.email || "");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const [signedInEmail, setSignedInEmail] = useState(account?.user.email || null);
  const [testText, setTestText] = useState<string>("");

  const dictationParts = hotkey.split("+");
  const pttParts = pttHotkey.split("+");

  useEffect(() => {
    let mounted = true;
    let off: (() => void) | null = null;
    void listen<{ text?: string }>("transcription_done", (event) => {
      if (!mounted) return;
      const text = String(event.payload?.text || "").trim();
      if (text) setTestText(text);
    }).then((u) => {
      if (!mounted) u();
      else off = u;
    });
    return () => {
      mounted = false;
      if (off) off();
    };
  }, []);

  const finish = async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      const next = await tauri.login(email, password);
      setSignedInEmail(next.account?.user.email || email);
      setPassword("");
      setConfettiSeed((s) => s + 1);
      onAuthChanged();
    } catch (e) {
      setAuthError(String(e));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <Card className="relative w-full max-w-lg border-border/80 p-6 shadow-lg">
        {confettiSeed > 0 ? <ConfettiBurst key={confettiSeed} /> : null}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Step {step + 1} of {STEP_COUNT}
            </p>
            <h2 id="onboarding-title" className="mt-1 text-lg font-semibold tracking-tight">
              Welcome to Mushu
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            disabled={busy}
            onClick={() => void finish()}
          >
            Skip
          </Button>
        </div>

        <div className="min-h-[200px] text-sm text-muted-foreground">
          {step === 0 && (
            <div className="space-y-3 text-foreground/90">
              <p>
                Mushu transcribes what you dictate with a{" "}
                <strong className="text-foreground">global shortcut</strong> and can rewrite
                the text based on the mode you pick (email, note, or raw voice).
              </p>
              <p>
                Your trial lives in your account now: sign in once and Mushu uses your
                available minutes without any extra configuration.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-foreground/90">
                There are two ways to record. Try the one that feels most natural.
              </p>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Dictation</p>
                <ShortcutKbd keys={dictationParts} />
                <p className="text-xs text-muted-foreground">
                  Quick tap to start recording; another tap or ESC to send.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Push-to-talk</p>
                <ShortcutKbd keys={pttParts} />
                <p className="text-xs text-muted-foreground">
                  Hold while you speak; release to send.
                </p>
              </div>
              <p className="text-xs">You can change them in Settings → Shortcuts.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-foreground/90">
              {signedInEmail ? (
                <div className="space-y-3">
                  <p>
                    You're signed in as{" "}
                    <strong className="text-foreground">{signedInEmail}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The first time you record, Windows may ask for microphone permission.
                    Accept it to continue.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p>
                    Sign in to activate your{" "}
                    <strong className="text-foreground">Mushu trial</strong>. No extra
                    configuration needed.
                  </p>
                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="space-y-2">
                      <Input
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={authBusy || busy}
                      />
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={authBusy || busy}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void handleLogin();
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || authBusy || !email.trim() || !password}
                      onClick={() => void handleLogin()}
                    >
                      {authBusy ? "Signing in…" : "Sign in"}
                    </Button>
                    {authError ? (
                      <p className="text-xs text-destructive" role="alert">
                        {authError}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-foreground/90">
                Let's make sure everything works. Hold the shortcut and say something:
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-foreground">Push-to-talk</p>
                  <ShortcutKbd keys={pttParts} size="sm" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Suggestion: say{" "}
                  <strong className="text-foreground">"Hello, how are you?"</strong>
                </p>
              </div>
              <div className="min-h-20 rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">Result</p>
                {testText ? (
                  <p className="text-sm text-foreground/90">
                    <span className="text-emerald-500">✓</span> &ldquo;{testText}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Waiting for your first dictation…
                  </p>
                )}
              </div>
              {testText ? (
                <p className="text-xs text-emerald-500">
                  It works! Continue when you're ready.
                </p>
              ) : null}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-foreground/90">
              {signedInEmail ? (
                <>
                  <p>
                    Trial active for{" "}
                    <strong className="text-foreground">{signedInEmail}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can check your remaining minutes in the Account section.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => {
                      void finish();
                      onNavigateSettings("account");
                    }}
                  >
                    Go to Account
                  </Button>
                </>
              ) : (
                <p>
                  Sign in any time from the sidebar to activate your trial.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 0 || busy}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          <div className="flex gap-2">
            {step < STEP_COUNT - 1 ? (
              <Button
                type="button"
                size="sm"
                disabled={busy || authBusy}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={busy} onClick={() => void finish()}>
                Get started
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-center gap-1">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i === step ? "bg-primary" : "bg-muted",
              )}
              aria-hidden
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

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
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
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
