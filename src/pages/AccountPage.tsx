import { CreditCard, ExternalLink, LogIn, LogOut, RefreshCw, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSettings } from "@/hooks/useSettings";
import { tauri } from "@/lib/tauri";
import type { MushuAccount, MushuEntitlement } from "@/lib/types";

function remainingMinutes(entitlement: MushuEntitlement | null): number | null {
  if (!entitlement) return null;
  if (
    typeof entitlement.trial_minutes_remaining === "number" ||
    typeof entitlement.monthly_minutes_remaining === "number"
  ) {
    return Math.max(
      0,
      (entitlement.trial_minutes_remaining || 0) +
        (entitlement.monthly_minutes_remaining || 0),
    );
  }
  return Math.ceil(
    Math.max(
      0,
      (entitlement.trial_seconds_remaining || 0) +
        (entitlement.monthly_seconds_remaining || 0),
    ) / 60,
  );
}

function initialsFromAccount(account: MushuAccount | null): string {
  const source = account?.user.full_name || account?.user.email || "Mushu";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "M";
}

export function AccountPage() {
  const { state, loading, refresh } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const account = state?.account ?? null;
  const minutes = remainingMinutes(account?.entitlement ?? null);
  const minuteBarMax = Math.max(minutes ?? 0, account?.entitlement?.status === "trial" ? 120 : 60);
  const minutePercent = minutes === null ? 0 : minuteBarMax > 0 ? Math.min(100, Math.round((minutes / minuteBarMax) * 100)) : 0;
  const webBaseUrl = (state?.api_base_url || "https://juangaldo.com").replace(/\/$/, "");

  const login = async () => {
    if (!email.trim() || !password) {
      toast.error("Escribe correo y contraseña");
      return;
    }
    setBusy(true);
    try {
      await tauri.login(email, password);
      setPassword("");
      await refresh();
      toast.success("Sesión iniciada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await tauri.logout();
      await refresh();
      toast.success("Sesión cerrada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const refreshAccount = async () => {
    setBusy(true);
    try {
      await tauri.refreshAccount();
      await refresh();
      toast.success("Cuenta actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const openWebLogin = async () => {
    try {
      await tauri.openExternalUrl(`${webBaseUrl}/mushu/login`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="mushu-topbar flex items-center justify-between px-5 py-3"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-3">
          <SidebarTrigger style={{ color: "var(--text-secondary)" }} />
          <div>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              Cuenta
            </p>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12px",
                fontWeight: 450,
                color: "var(--text-muted)",
              }}
            >
              Tu plan y sesión
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <GlassCard className="p-5">
            <div className="flex items-center gap-4">
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "rgba(209,255,58,0.14)",
                  border: "0.5px solid rgba(209,255,58,0.42)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {account?.user.avatar_url ? (
                  <img
                    src={account.user.avatar_url}
                    alt={account.user.full_name || account.user.email || "Avatar"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : account ? (
                  <span
                    style={{
                      color: "#d1ff3a",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {initialsFromAccount(account)}
                  </span>
                ) : (
                  <User size={22} strokeWidth={2} style={{ color: "#d1ff3a" }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {account?.user.full_name || account?.user.email || "Inicia sesión"}
                </h3>
                {account?.user.full_name && account.user.email ? (
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    {account.user.email}
                  </p>
                ) : null}
                <p
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginTop: "2px",
                  }}
                >
                  {account
                    ? account.entitlement
                      ? `Plan ${account.entitlement.status || "trial"} · ${minutes} min disponibles`
                      : "Sesion conectada · sincronizacion pendiente"
                    : "Conecta tu cuenta para activar el trial"}
                </p>
                {account ? (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#d1ff3a] transition-all duration-500"
                        style={{ width: `${minutePercent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                      <span>{minutes === null ? "Sincronizando minutos" : `${minutes} minutos restantes`}</span>
                      <span>{minutePercent}%</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </GlassCard>

          {!account ? (
            <GlassCard className="p-5">
              <div className="mb-4 flex items-start gap-3">
                <LogIn size={18} strokeWidth={2} style={{ color: "#d1ff3a" }} />
                <div>
                  <h3
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    Entrar al beta
                  </h3>
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12.5px",
                      fontWeight: 450,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                      marginTop: "4px",
                    }}
                  >
                    Entra con correo y contrasena o crea tu cuenta desde la web.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@dominio.com"
                  autoComplete="email"
                  disabled={busy || loading}
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  disabled={busy || loading}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void login();
                  }}
                />
                <Button className="w-full gap-2" disabled={busy || loading} onClick={() => void login()}>
                  <LogIn size={15} strokeWidth={2} />
                  {busy ? "Entrando..." : "Iniciar sesión"}
                </Button>
                <button
                  type="button"
                  className="glass-btn flex w-full items-center justify-center gap-2 rounded-lg py-2.5"
                  onClick={() => void openWebLogin()}
                  disabled={busy || loading}
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    opacity: busy || loading ? 0.55 : 1,
                  }}
                >
                  <ExternalLink size={14} strokeWidth={2} />
                  Crear cuenta en la web
                </button>
              </div>
            </GlassCard>
          ) : null}

          <GlassCard className="p-5">
            <div className="mb-4 flex items-start gap-3">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(209,255,58,0.14)",
                  border: "0.5px solid rgba(209,255,58,0.38)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={18} strokeWidth={2} style={{ color: "#d1ff3a" }} />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Trial activo
                </h3>
                <p
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "12.5px",
                    fontWeight: 450,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginTop: "4px",
                  }}
                >
                  {minutes === null
                    ? "Tu sesion llego desde la web. Revisa la conexion del backend para traer tus minutos."
                    : `Tienes ${minutes} minutos disponibles. Cada dictado con Deepgram descuenta segundos del trial y se sincroniza con tu dashboard.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="glass-btn w-full rounded-lg py-2.5"
              onClick={() => void refreshAccount()}
              disabled={busy || loading || !account}
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                opacity: busy || loading || !account ? 0.55 : 1,
                cursor: busy || loading || !account ? "not-allowed" : "pointer",
              }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCw size={14} strokeWidth={2} />
                Actualizar minutos
              </span>
            </button>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard size={18} strokeWidth={2} style={{ color: "var(--text-secondary)" }} />
                <div>
                  <h3
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    Facturación
                  </h3>
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      fontWeight: 450,
                      color: "var(--text-muted)",
                    }}
                  >
                    No necesitas método de pago para el trial.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 py-1"
              onClick={() => void logout()}
              disabled={busy || loading || !account}
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--delta-red)",
                background: "transparent",
                border: "none",
                cursor: busy || loading || !account ? "not-allowed" : "pointer",
                opacity: busy || loading || !account ? 0.55 : 1,
              }}
            >
              <LogOut size={15} strokeWidth={2} />
              Cerrar sesión
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
