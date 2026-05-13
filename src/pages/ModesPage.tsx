import { useEffect, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDictation } from "@/hooks/useDictation";
import { listen } from "@/lib/events";
import { tauri } from "@/lib/tauri";
import {
  MODE_COLORS,
  MODE_DESCRIPTIONS,
  MODE_ICONS,
  MODE_ICONS_BY_NAME,
  MODE_LABELS,
} from "@/lib/modes";
import type { ModeName } from "@/lib/types";

const TRANSCRIPTION_MODES: ModeName[] = ["DEFAULT", "EMAIL", "NOTE"];
const RAPPI_COLOR = "#ff6b1a";

export function ModesPage() {
  const { mode, setMode } = useDictation();
  const [rappiConnected, setRappiConnected] = useState(false);
  const [rappiConnecting, setRappiConnecting] = useState(false);

  useEffect(() => {
    tauri.getFrontendState().then((s) => {
      setRappiConnected(s.rappi_connected ?? false);
    }).catch(() => {});

    const off = listen<Record<string, unknown>>("frontend_state_changed", () => {
      tauri.getFrontendState().then((s) => {
        setRappiConnected(s.rappi_connected ?? false);
      }).catch(() => {});
    });

    return () => { off.then((fn) => fn()); };
  }, []);

  const isRappiActive = mode.name === "RAPPI";

  function handleRappiClick() {
    if (rappiConnecting) return;
    if (!rappiConnected) {
      setRappiConnecting(true);
      tauri.rappiConnect()
        .catch(() => {})
        .finally(() => setRappiConnecting(false));
    } else if (!isRappiActive) {
      setMode("RAPPI").catch(() => {});
    }
  }

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
              Modos
            </p>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12px",
                fontWeight: 450,
                color: "var(--text-muted)",
              }}
            >
              Elige cómo se procesa tu dictado
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {/* Transcription modes grid */}
        <div className="grid grid-cols-3 gap-3">
          {TRANSCRIPTION_MODES.map((name) => {
            const isActive = mode.name === name;
            const Icon = MODE_ICONS[MODE_ICONS_BY_NAME[name as ModeName]];
            const color = MODE_COLORS[name as ModeName];
            const label = MODE_LABELS[name as ModeName];
            const description = MODE_DESCRIPTIONS[name as ModeName];
            return (
              <button
                key={name}
                type="button"
                onClick={() => setMode(name as ModeName).catch(() => {})}
                className="group text-left"
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
              >
                <GlassCard
                  variant={isActive ? "strong" : "default"}
                  className="relative flex flex-col gap-3 p-5 transition-all"
                  style={{
                    minHeight: "180px",
                    border: isActive
                      ? `0.5px solid ${color}55`
                      : "0.5px solid var(--glass-border-outer)",
                    boxShadow: isActive
                      ? `inset 0 1px 0 var(--glass-border), 0 0 0 1px ${color}40, 0 8px 24px rgba(0,0,0,0.30)`
                      : "inset 0 1px 0 var(--glass-border), 0 1px 2px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.28)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: `${color}14`,
                        border: `0.5px solid ${color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={20} strokeWidth={2} style={{ color }} />
                    </div>
                    {isActive && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{
                          background: `${color}14`,
                          border: `0.5px solid ${color}40`,
                          color,
                          fontFamily: "'Space Mono', monospace",
                          fontSize: "9px",
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          fontWeight: 700,
                        }}
                      >
                        <Check size={10} strokeWidth={3} />
                        Activo
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3
                      style={{
                        fontFamily: "'Geist Variable', sans-serif",
                        fontSize: "16px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.01em",
                        marginBottom: "4px",
                      }}
                    >
                      {label}
                    </h3>
                    <p
                      style={{
                        fontFamily: "'Geist Variable', sans-serif",
                        fontSize: "12.5px",
                        fontWeight: 450,
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {description}
                    </p>
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>

        {/* Rappi agent card — full width, below the grid */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleRappiClick}
            disabled={rappiConnecting}
            className="group w-full text-left"
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: rappiConnecting ? "default" : "pointer",
            }}
          >
            <GlassCard
              variant={isRappiActive ? "strong" : "default"}
              className="relative flex items-center gap-4 p-5 transition-all"
              style={{
                border: isRappiActive
                  ? `0.5px solid ${RAPPI_COLOR}55`
                  : "0.5px solid var(--glass-border-outer)",
                boxShadow: isRappiActive
                  ? `inset 0 1px 0 var(--glass-border), 0 0 0 1px ${RAPPI_COLOR}40, 0 8px 24px rgba(0,0,0,0.30)`
                  : "inset 0 1px 0 var(--glass-border), 0 1px 2px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.28)",
                opacity: rappiConnecting ? 0.75 : 1,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: `${RAPPI_COLOR}14`,
                  border: `0.5px solid ${RAPPI_COLOR}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShoppingCart size={20} strokeWidth={2} style={{ color: RAPPI_COLOR }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h3
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                    marginBottom: "4px",
                  }}
                >
                  Rappi
                </h3>
                <p
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "12.5px",
                    fontWeight: 450,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {rappiConnecting
                    ? "Abriendo Rappi para hacer login…"
                    : rappiConnected
                      ? isRappiActive
                        ? "Asistente de voz activo para Rappi"
                        : "Conectado — haz clic para activar el modo"
                      : "Conéctate para habilitar el asistente de voz"}
                </p>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isRappiActive && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                    style={{
                      background: `${RAPPI_COLOR}14`,
                      border: `0.5px solid ${RAPPI_COLOR}40`,
                      color: RAPPI_COLOR,
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 700,
                    }}
                  >
                    <Check size={10} strokeWidth={3} />
                    Activo
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{
                    background: rappiConnected ? "#22c55e14" : "#8a8a9514",
                    border: `0.5px solid ${rappiConnected ? "#22c55e40" : "#8a8a9540"}`,
                    color: rappiConnected ? "#22c55e" : "#8a8a95",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "currentColor",
                      display: "inline-block",
                    }}
                  />
                  {rappiConnecting ? "Conectando…" : rappiConnected ? "Conectado" : "Desconectado"}
                </span>
              </div>
            </GlassCard>
          </button>
        </div>

        <p
          className="mt-5"
          style={{
            fontFamily: "'Geist Variable', sans-serif",
            fontSize: "11.5px",
            fontWeight: 450,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          El modo activo se aplica a todas las transcripciones. Para personalizar el comportamiento
          (formato, traducción, agente), abre{" "}
          <strong style={{ color: "var(--text-secondary)", fontWeight: 600 }}>AI Features</strong>.
        </p>
      </div>
    </div>
  );
}
