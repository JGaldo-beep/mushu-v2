import { ExternalLink } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { ShortcutKbd } from "@/components/ShortcutKbd";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listen } from "@/lib/events";
import { tauri } from "@/lib/tauri";
import type { MushuAccount, NavSection } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEP_COUNT = 5;
const CONFETTI_COLORS = ["#22c55e", "#60a5fa", "#f59e0b", "#a78bfa", "#f43f5e", "#14b8a6"];
type ConfettiStyle = CSSProperties & {
  "--tx": string;
  "--ty": string;
  "--rot": string;
};

type Props = {
  hotkey: string;
  pttHotkey: string;
  account: MushuAccount | null;
  apiBaseUrl: string;
  onComplete: () => Promise<void>;
  onNavigateSettings: (section: NavSection) => void;
};

export function OnboardingWizard({
  hotkey,
  pttHotkey,
  account,
  apiBaseUrl,
  onComplete,
  onNavigateSettings,
}: Props) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState(0);
  const [signedInEmail, setSignedInEmail] = useState(account?.user.email || null);
  const [testText, setTestText] = useState<string>("");
  const webBaseUrl = apiBaseUrl.replace(/\/$/, "");

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

  // Actualizar signedInEmail cuando la cuenta cambie (por deep link)
  useEffect(() => {
    if (account?.user.email && account.user.email !== signedInEmail) {
      setSignedInEmail(account.user.email);
      setConfettiSeed((s) => s + 1);
    }
  }, [account, signedInEmail]);

  const finish = async () => {
    setBusy(true);
    try {
      await onComplete();
    } finally {
      setBusy(false);
    }
  };

  const openWebLogin = async () => {
    try {
      await tauri.openExternalUrl(`${webBaseUrl}/mushu/login`);
    } catch {
      // silently ignore
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
              Paso {step + 1} de {STEP_COUNT}
            </p>
            <h2 id="onboarding-title" className="mt-1 text-lg font-semibold tracking-tight">
              Bienvenido a Mushu
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
            Saltar
          </Button>
        </div>

        <div className="min-h-[200px] text-sm text-muted-foreground">
          {step === 0 && (
            <div className="space-y-3 text-foreground/90">
              <p>
                Mushu transcribe lo que dictas con un <strong className="text-foreground">atajo global</strong> y
                puede reescribir el texto según el modo que elijas (correo, nota o voz directa).
              </p>
              <p>
                Ahora el trial vive en tu cuenta: inicias sesión una vez y Mushu usa tus minutos disponibles sin pedirte API keys.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-foreground/90">
                Tenés dos formas de grabar. Probá la que te resulte más cómoda.
              </p>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Dictado</p>
                <ShortcutKbd keys={dictationParts} />
                <p className="text-xs text-muted-foreground">
                  Tap rápido para arrancar a grabar; otro tap o ESC para enviar lo dictado.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">Push-to-talk</p>
                <ShortcutKbd keys={pttParts} />
                <p className="text-xs text-muted-foreground">
                  Mantenelo pulsado mientras hablás; al soltar se envía.
                </p>
              </div>
              <p className="text-xs">Puedes cambiarlos en Ajustes → Atajos de teclado.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-foreground/90">
              {signedInEmail ? (
                <div className="space-y-3">
                  <p>
                    Ya iniciaste sesión como <strong className="text-foreground">{signedInEmail}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    La primera vez que grabes, Windows puede pedir permiso para usar el micrófono. Aceptá para continuar.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p>
                    Conectá tu cuenta para activar tu <strong className="text-foreground">trial de Mushu</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Se abrirá el navegador para que inicies sesión. Tu cuenta se sincronizará automáticamente.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={busy}
                    onClick={() => void openWebLogin()}
                  >
                    <ExternalLink size={14} strokeWidth={2} />
                    Sincronizar con la web
                  </Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-foreground/90">
                Probemos que todo funciona. Mantené el atajo y decí algo:
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-foreground">Push-to-talk</p>
                  <ShortcutKbd keys={pttParts} size="sm" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sugerencia: decí <strong className="text-foreground">"Hola, ¿cómo estás?"</strong>
                </p>
              </div>
              <div className="min-h-20 rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">Resultado</p>
                {testText ? (
                  <p className="text-sm text-foreground/90">
                    <span className="text-emerald-500">✓</span> &ldquo;{testText}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Esperando tu primer dictado…</p>
                )}
              </div>
              {testText ? (
                <p className="text-xs text-emerald-500">¡Funciona! Continuá cuando quieras.</p>
              ) : null}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-foreground/90">
              {signedInEmail ? (
                <>
                  <p>
                    Trial activado para <strong className="text-foreground">{signedInEmail}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Podés revisar tus minutos restantes en la sección Cuenta.
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
                    Ir a Cuenta
                  </Button>
                </>
              ) : (
                <p>Iniciá sesión cuando quieras desde la barra lateral para activar tu trial.</p>
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
            Atrás
          </Button>
          <div className="flex gap-2">
            {step < STEP_COUNT - 1 ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => setStep((s) => s + 1)}
              >
                Siguiente
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={busy} onClick={() => void finish()}>
                Empezar
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
