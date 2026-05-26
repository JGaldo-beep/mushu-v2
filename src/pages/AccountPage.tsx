import {
  CreditCard,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
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

const WAITING_TIMEOUT_MS = 5 * 60 * 1000;

export function AccountPage() {
  const { state, loading, refresh } = useSettings();
  const [busy, setBusy] = useState(false);
  const [waitingForLogin, setWaitingForLogin] = useState(false);
  const account = state?.account ?? null;

  // Auto-clear the waiting state as soon as the deep link delivers a session.
  useEffect(() => {
    if (account && waitingForLogin) {
      setWaitingForLogin(false);
      const label = account.user.full_name || account.user.email || "your account";
      toast.success(`Signed in as ${label}`);
    }
  }, [account, waitingForLogin]);

  // Bail out after a long stall — the browser might be closed or the user wandered off.
  useEffect(() => {
    if (!waitingForLogin) return;
    const t = window.setTimeout(() => setWaitingForLogin(false), WAITING_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [waitingForLogin]);
  const minutes = remainingMinutes(account?.entitlement ?? null);
  const minuteBarMax = Math.max(minutes ?? 0, account?.entitlement?.status === "trial" ? 120 : 60);
  const minutePercent =
    minutes === null ? 0 : minuteBarMax > 0 ? Math.min(100, Math.round((minutes / minuteBarMax) * 100)) : 0;
  const webBaseUrl = (state?.api_base_url || "https://mushu.space").replace(/\/$/, "");

  const logout = async () => {
    setBusy(true);
    try {
      await tauri.logout();
      await refresh();
      toast.success("Signed out");
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
      toast.success("Account refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const openWebLogin = async () => {
    try {
      await tauri.openExternalUrl(`${webBaseUrl}/login`);
      setWaitingForLogin(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const openWebSignup = async () => {
    try {
      await tauri.openExternalUrl(`${webBaseUrl}/signup`);
      setWaitingForLogin(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const cancelWaiting = async () => {
    setWaitingForLogin(false);
    // Best-effort: also refetch in case the session landed between the click and the cancel.
    try {
      await refresh();
    } catch {
      /* ignore */
    }
  };

  const openWebDashboard = async () => {
    try {
      await tauri.openExternalUrl(`${webBaseUrl}/dashboard`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
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
              Account
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
              Managed on the web — synced to your desktop
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <GlassCard className="p-5">
            <div className="flex items-center gap-4">
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "color-mix(in oklab, var(--primary) 14%, transparent)",
                  border: "0.5px solid color-mix(in oklab, var(--primary) 42%, transparent)",
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
                      color: "var(--primary)",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "14px",
                      fontWeight: 700,
                    }}
                  >
                    {initialsFromAccount(account)}
                  </span>
                ) : (
                  <User size={22} strokeWidth={2} style={{ color: "var(--primary)" }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {account?.user.full_name || account?.user.email || "Not signed in"}
                </h3>
                {account?.user.full_name && account.user.email ? (
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      color: "var(--muted-foreground)",
                      marginTop: "2px",
                    }}
                  >
                    {account.user.email}
                  </p>
                ) : null}
                <p
                  className="tracking-widest"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    color: "var(--muted-foreground)",
                    textTransform: "uppercase",
                    marginTop: "2px",
                  }}
                >
                  {account
                    ? account.entitlement
                      ? `Plan ${account.entitlement.status || "trial"} · ${minutes} min available`
                      : "Account connected · sync pending"
                    : "Connect your account to activate the trial"}
                </p>
                {account ? (
                  <div className="mt-3">
                    <div
                      className="h-2 overflow-hidden rounded-full"
                      style={{
                        background: "color-mix(in oklab, var(--foreground) 10%, transparent)",
                      }}
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${minutePercent}%` }}
                      />
                    </div>
                    <div
                      className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <span>
                        {minutes === null ? "Syncing minutes" : `${minutes} minutes remaining`}
                      </span>
                      <span>{minutePercent}%</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </GlassCard>

          {!account && waitingForLogin ? (
            <GlassCard className="p-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "999px",
                    background: "color-mix(in oklab, var(--primary) 12%, transparent)",
                    border: "0.5px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Loader2
                    size={22}
                    strokeWidth={2}
                    className="animate-spin"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "17px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1.2,
                    }}
                  >
                    Waiting for sign-in…
                  </h3>
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "13px",
                      fontWeight: 450,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.55,
                      marginTop: "6px",
                      maxWidth: "380px",
                    }}
                  >
                    Finish signing in in your browser. We'll detect it automatically and
                    sync your session — no need to come back here.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => void openWebLogin()}
                    className="glass-btn inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2"
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    <ExternalLink size={12} strokeWidth={2.2} />
                    Reopen browser
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelWaiting()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2"
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--muted-foreground)",
                      background: "transparent",
                      border: "0.5px solid transparent",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--foreground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--muted-foreground)";
                    }}
                  >
                    <X size={12} strokeWidth={2.2} />
                    Cancel
                  </button>
                </div>
              </div>
            </GlassCard>
          ) : !account ? (
            <GlassCard className="p-6">
              <div className="mb-5 flex flex-col items-center gap-3 text-center">
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "999px",
                    background: "color-mix(in oklab, var(--primary) 14%, transparent)",
                    border: "0.5px solid color-mix(in oklab, var(--primary) 38%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ExternalLink size={18} strokeWidth={2} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <h3
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1.2,
                    }}
                  >
                    Sign in on the web
                  </h3>
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "13px",
                      fontWeight: 450,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.55,
                      marginTop: "6px",
                      maxWidth: "420px",
                    }}
                  >
                    Account, billing and plans live on mushu.space. Sign in there and your
                    browser hands the session back to this desktop app automatically — no
                    second password to manage.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void openWebLogin()}
                disabled={busy || loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "12px 20px",
                  borderRadius: "999px",
                  background: "var(--foreground)",
                  color: "var(--background)",
                  border: "none",
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: busy || loading ? "not-allowed" : "pointer",
                  opacity: busy || loading ? 0.55 : 1,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!(busy || loading)) e.currentTarget.style.opacity = "0.88";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <ExternalLink size={15} strokeWidth={2.2} />
                Sign in via the web
              </button>

              <p
                className="tracking-widest"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "9.5px",
                  textTransform: "uppercase",
                  color: "var(--muted-foreground)",
                  textAlign: "center",
                  marginTop: "14px",
                }}
              >
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => void openWebSignup()}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "var(--primary)",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    letterSpacing: "inherit",
                    textTransform: "inherit",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Create one on the web
                </button>
              </p>
            </GlassCard>
          ) : null}

          <GlassCard className="p-5">
            <div className="mb-4 flex items-start gap-3">
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "color-mix(in oklab, var(--primary) 14%, transparent)",
                  border: "0.5px solid color-mix(in oklab, var(--primary) 38%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Sparkles size={18} strokeWidth={2} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  Trial active
                </h3>
                <p
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "12.5px",
                    fontWeight: 450,
                    color: "var(--muted-foreground)",
                    lineHeight: 1.5,
                    marginTop: "4px",
                  }}
                >
                  {minutes === null
                    ? "Refresh to see your available minutes."
                    : `You have ${minutes} minutes available. Each dictation deducts seconds from your plan.`}
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
                Refresh minutes
              </span>
            </button>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard size={18} strokeWidth={2} style={{ color: "var(--muted-foreground)" }} />
                <div>
                  <h3
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      color: "var(--foreground)",
                    }}
                  >
                    Billing & plans
                  </h3>
                  <p
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      fontWeight: 450,
                      color: "var(--muted-foreground)",
                    }}
                  >
                    Managed on the web. The desktop just consumes your active plan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void openWebDashboard()}
                className="glass-btn inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                Open on web
                <ExternalLink size={11} strokeWidth={2.2} />
              </button>
            </div>
          </GlassCard>

          {account ? (
            <GlassCard className="p-5">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 py-1"
                onClick={() => void logout()}
                disabled={busy || loading}
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--destructive)",
                  background: "transparent",
                  border: "none",
                  cursor: busy || loading ? "not-allowed" : "pointer",
                  opacity: busy || loading ? 0.55 : 1,
                }}
              >
                <LogOut size={15} strokeWidth={2} />
                Sign out
              </button>
            </GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
