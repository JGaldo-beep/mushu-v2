import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Info,
  Keyboard,
  LifeBuoy,
  Mic,
  Plus,
  RefreshCw,
  Replace,
  Save,
  ShieldCheck,
  Volume2,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { GlassSelect } from "@/components/GlassSelect";
import { GlassToggle } from "@/components/GlassToggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { useAudioDevices } from "@/hooks/useAudioDevices";
import { useSettings } from "@/hooks/useSettings";
import { useSpokenLanguage } from "@/hooks/useSpokenLanguage";
import { tauri } from "@/lib/tauri";
import type { DeepgramReplacement } from "@/lib/types";

const APP_VERSION = "0.1.1";

const LANGUAGES = [
  { value: "auto", label: "Detectar automáticamente" },
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "fr", label: "Francés" },
  { value: "de", label: "Alemán" },
  { value: "pt", label: "Portugués" },
  { value: "it", label: "Italiano" },
];

function SectionHeader({
  title,
  icon: Icon,
  description,
}: {
  title: string;
  icon: LucideIcon;
  description?: string;
}) {
  return (
    <div className="mb-1 flex items-center gap-2.5 px-4 pt-4 pb-3">
      <Icon style={{ width: "15px", height: "15px", color: "var(--accent-primary)" }} strokeWidth={2.25} />
      <div>
        <p
          style={{
            fontFamily: "'Geist Variable', sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </p>
        {description && (
          <p
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "11.5px",
              fontWeight: 450,
              color: "var(--text-muted)",
              marginTop: "1px",
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  htmlFor,
  control,
  isLast,
}: {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  control: ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3"
      style={!isLast ? { borderBottom: "0.5px solid var(--glass-border-outer)" } : undefined}
    >
      <div className="min-w-0 flex-1">
        <Label
          htmlFor={htmlFor}
          style={{
            fontFamily: "'Geist Variable', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {label}
        </Label>
        {description && (
          <div
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "11.5px",
              fontWeight: 450,
              color: "var(--text-muted)",
              marginTop: "2px",
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function mapKey(key: string): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null;
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  const named: Record<string, string> = {
    Escape: "Escape", Tab: "Tab", Enter: "Return",
    Backspace: "Backspace", Delete: "Delete",
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
  };
  if (key in named) return named[key];
  if (/^F\d+$/.test(key)) return key;
  return null;
}

function buildCombo(e: React.KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  if (e.metaKey) mods.push("Meta");
  const k = mapKey(e.key);
  if (!k) return mods.length ? mods.join("+") : null;
  return [...mods, k].join("+");
}

function KeyChips({ combo, dim }: { combo: string; dim?: boolean }) {
  const parts = combo ? combo.split("+").filter(Boolean) : [];
  if (!parts.length) return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span style={{ color: "var(--text-muted)", fontSize: "11px", opacity: 0.6 }}>+</span>}
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: "5px",
              background: dim ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.09)",
              border: "0.5px solid rgba(255,255,255,0.13)",
              color: dim ? "var(--text-muted)" : "var(--text-primary)",
              letterSpacing: "0.01em",
              boxShadow: "0 1px 0 rgba(0,0,0,0.25)",
              display: "inline-block",
            }}
          >
            {p}
          </span>
        </span>
      ))}
    </span>
  );
}

function HotkeyCapture({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);

  const start = () => {
    setCapturing(true);
    setPreview("");
    setTimeout(() => btnRef.current?.focus(), 0);
  };

  const cancel = () => {
    setCapturing(false);
    setPreview("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") { cancel(); return; }
    const combo = buildCombo(e);
    if (combo) setPreview(combo);
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    const k = mapKey(e.key);
    if (!k || ["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    const combo = buildCombo(e);
    if (combo) {
      onChange(combo);
      setCapturing(false);
      setPreview("");
    }
  };

  if (capturing) {
    return (
      <button
        ref={btnRef}
        type="button"
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={cancel}
        style={{
          fontFamily: "'Geist Variable', sans-serif",
          fontSize: "12px",
          fontWeight: 500,
          padding: "6px 12px",
          borderRadius: "8px",
          background: "color-mix(in oklab, var(--primary) 10%, transparent)",
          border: "0.5px solid color-mix(in oklab, var(--primary) 42%, transparent)",
          color: "var(--primary)",
          cursor: "default",
          outline: "none",
          minWidth: "160px",
          textAlign: "center",
          animation: "pulse 1.4s ease-in-out infinite",
        }}
      >
        {preview ? <KeyChips combo={preview} dim /> : "Press the combination…"}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <KeyChips combo={value} />
      <button
        ref={btnRef}
        type="button"
        onClick={start}
        className="glass-btn rounded-lg px-2.5 py-1"
        style={{
          fontFamily: "'Geist Variable', sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--muted-foreground)",
        }}
      >
        Change
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { draft, loading, saving, isDirty, setField, save, reset, refresh } = useSettings();
  const { language, setLanguage } = useSpokenLanguage();
  const { devices: audioDevices, refresh: refreshAudioDevices } = useAudioDevices();
  const ready = !loading && !!draft;

  const [dgKeyInput, setDgKeyInput] = useState("");
  const [dgKeyVisible, setDgKeyVisible] = useState(false);
  const [dgKeySaving, setDgKeySaving] = useState(false);

  const onSaveDeepgramKey = async () => {
    setDgKeySaving(true);
    try {
      await tauri.saveDeepgramApiKey(dgKeyInput.trim());
      setDgKeyInput("");
      toast.success("Código de activación guardado");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDgKeySaving(false);
    }
  };

  const onDeleteDeepgramKey = async () => {
    setDgKeySaving(true);
    try {
      await tauri.saveDeepgramApiKey("");
      toast.success("Código de activación eliminado");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDgKeySaving(false);
    }
  };

  const replacements: DeepgramReplacement[] = draft?.deepgram_replacements ?? [];

  const addReplacement = () => {
    setField("deepgram_replacements", [...replacements, { from: "", to: "" }]);
  };

  const updateReplacement = (i: number, field: "from" | "to", value: string) => {
    const updated = replacements.map((r, idx) => (idx === i ? { ...r, [field]: value } : r));
    setField("deepgram_replacements", updated);
  };

  const removeReplacement = (i: number) => {
    setField("deepgram_replacements", replacements.filter((_, idx) => idx !== i));
  };

  const onSave = async () => {
    try {
      await save();
      toast.success("Ajustes guardados");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const onRefreshMics = async () => {
    await Promise.all([refresh(), refreshAudioDevices()]);
    toast.success("Lista de micrófonos actualizada");
  };

  const micOptions = [
    { value: "__default__", label: "Predeterminado del sistema" },
    ...audioDevices.map((d) => ({ value: d.deviceId, label: d.label })),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mushu-topbar flex items-center gap-3 px-5 py-3" style={{ flexShrink: 0 }}>
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
            Ajustes
          </p>
          <p
            style={{
              fontFamily: "'Geist Variable', sans-serif",
              fontSize: "12px",
              fontWeight: 450,
              color: "var(--text-muted)",
            }}
          >
            Tus preferencias se guardan en este equipo
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          className="mx-auto max-w-2xl space-y-4 px-5 py-5 pb-32"
          style={{
            opacity: ready ? 1 : 0.55,
            pointerEvents: ready ? "auto" : "none",
            transition: "opacity 0.18s ease-out",
          }}
        >
          {/* General */}
          <GlassCard className="overflow-hidden">
            <SectionHeader
              title="General"
              icon={Globe}
              description="Idioma de dictado, ayuda y about"
            />
            <SettingRow
              label="Idioma que hablas"
              description="Mejora la precisión cuando es siempre el mismo idioma."
              control={
                <GlassSelect
                  value={language}
                  options={LANGUAGES}
                  onChange={setLanguage}
                  className="w-56"
                />
              }
            />
            <SettingRow
              label="Ayuda"
              description="Documentación y atajos de Mushu."
              control={
                <a
                  href="https://github.com/JGaldo-beep/mushu-v2"
                  target="_blank"
                  rel="noreferrer"
                  className="glass-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    textDecoration: "none",
                  }}
                >
                  <LifeBuoy size={13} strokeWidth={2} />
                  Abrir
                  <ExternalLink size={11} strokeWidth={2} />
                </a>
              }
            />
            <SettingRow
              label="Acerca de Mushu"
              description={
                <span className="inline-flex items-center gap-2">
                  <Info size={12} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px" }}>
                    v{APP_VERSION} · Tauri + React
                  </span>
                </span>
              }
              isLast
              control={null}
            />
          </GlassCard>

          {/* Recording */}
          <GlassCard className="overflow-hidden">
            <SectionHeader
              title="Grabación"
              icon={Mic}
              description="Micrófono y feedback sonoro"
            />
            <SettingRow
              label="Micrófono"
              description="Predeterminado del sistema si no eliges uno."
              control={
                <div className="flex items-center gap-2">
                  <GlassSelect
                    value={draft?.selected_microphone ?? "__default__"}
                    options={micOptions}
                    onChange={(v) => setField("selected_microphone", v === "__default__" ? null : v)}
                    className="w-56"
                  />
                  <button
                    type="button"
                    className="glass-btn rounded-lg p-2"
                    onClick={onRefreshMics}
                    title="Actualizar lista"
                  >
                    <RefreshCw style={{ width: "14px", height: "14px" }} />
                  </button>
                </div>
              }
            />
            <SettingRow
              label="Efectos de sonido"
              description="Chime al empezar y terminar la grabación."
              control={
                <GlassToggle
                  value={draft?.sound_effects_enabled ?? true}
                  onChange={(v) => setField("sound_effects_enabled", v)}
                />
              }
            />
            <SettingRow
              label="Volumen"
              isLast
              control={
                <div className="flex w-44 items-center gap-2">
                  <Slider
                    value={[Math.round((draft?.sound_effects_volume ?? 0) * 100)]}
                    onValueChange={(v) => setField("sound_effects_volume", (v[0] ?? 0) / 100)}
                    min={0}
                    max={100}
                    step={1}
                    disabled={!draft?.sound_effects_enabled}
                  />
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      width: "32px",
                      textAlign: "right",
                    }}
                  >
                    {Math.round((draft?.sound_effects_volume ?? 0) * 100)}%
                  </span>
                </div>
              }
            />
          </GlassCard>

          {/* Transcription */}
          <GlassCard className="overflow-hidden">
            <SectionHeader
              title="Transcripción"
              icon={Waves}
              description="Convierte tu voz en texto mientras dictas"
            />
            <SettingRow
              label="Modo activo"
              description={
                draft?.has_deepgram_direct_key
                  ? "Transcripción mejorada activa: detecta idiomas automáticamente, puntuación y números."
                  : "Transcripción estándar. Activa el plan premium para más precisión."
              }
              control={
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    fontWeight: 700,
                    background: draft?.has_deepgram_direct_key
                      ? "color-mix(in oklab, var(--delta-green) 14%, transparent)"
                      : draft?.account
                        ? "color-mix(in oklab, var(--primary) 12%, transparent)"
                        : "color-mix(in oklab, var(--destructive) 12%, transparent)",
                    border: draft?.has_deepgram_direct_key
                      ? "0.5px solid color-mix(in oklab, var(--delta-green) 35%, transparent)"
                      : draft?.account
                        ? "0.5px solid color-mix(in oklab, var(--primary) 38%, transparent)"
                        : "0.5px solid color-mix(in oklab, var(--destructive) 35%, transparent)",
                    color: draft?.has_deepgram_direct_key
                      ? "var(--delta-green)"
                      : draft?.account
                        ? "var(--primary)"
                        : "var(--destructive)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {draft?.has_deepgram_direct_key ? "Premium" : draft?.account ? "Standard" : "Offline"}
                </span>
              }
            />
            <SettingRow
              label="Código de activación"
              description={
                draft?.has_deepgram_direct_key
                  ? "Código guardado. Ingresa uno nuevo para actualizarlo."
                  : "Ingresa tu código para activar la transcripción premium."
              }
              isLast
              control={
                <div className="flex items-center gap-2">
                  {draft?.has_deepgram_direct_key ? (
                    <button
                      type="button"
                      className="glass-btn rounded-lg px-3 py-1.5"
                      onClick={onDeleteDeepgramKey}
                      disabled={dgKeySaving}
                      style={{
                        fontFamily: "'Geist Variable', sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "rgb(251,146,60)",
                      }}
                    >
                      Desactivar
                    </button>
                  ) : null}
                  <div className="relative flex items-center">
                    <input
                      type={dgKeyVisible ? "text" : "password"}
                      value={dgKeyInput}
                      onChange={(e) => setDgKeyInput(e.target.value)}
                      placeholder="Código..."
                      className="glass-input rounded-lg pr-8"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "11px",
                        padding: "6px 28px 6px 10px",
                        width: "160px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setDgKeyVisible((v) => !v)}
                      className="absolute right-2 text-(--text-muted) hover:text-(--text-secondary)"
                      tabIndex={-1}
                    >
                      {dgKeyVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="glass-btn rounded-lg px-3 py-1.5"
                    onClick={onSaveDeepgramKey}
                    disabled={dgKeySaving || !dgKeyInput.trim()}
                    style={{
                      fontFamily: "'Geist Variable', sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    {dgKeySaving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              }
            />
          </GlassCard>

          {/* Find & Replace */}
          <GlassCard className="overflow-hidden">
            <SectionHeader
              title="Buscar y reemplazar"
              icon={Replace}
              description="Corrige palabras que Mushu transcribe mal — se aplican en tiempo real"
            />
            <div className="px-4 pb-3">
              {replacements.length === 0 && (
                <p
                  style={{
                    fontFamily: "'Geist Variable', sans-serif",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    paddingTop: "8px",
                    paddingBottom: "4px",
                  }}
                >
                  Sin reemplazos. Agrega pares para corregir palabras mal transcritas.
                </p>
              )}
              {replacements.map((r, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={r.from}
                    onChange={(e) => updateReplacement(i, "from", e.target.value)}
                    placeholder="buscar"
                    className="glass-input flex-1 rounded-lg"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "11px",
                      padding: "6px 10px",
                      outline: "none",
                    }}
                  />
                  <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>→</span>
                  <input
                    type="text"
                    value={r.to}
                    onChange={(e) => updateReplacement(i, "to", e.target.value)}
                    placeholder="reemplazar con"
                    className="glass-input flex-1 rounded-lg"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "11px",
                      padding: "6px 10px",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    className="glass-btn rounded-lg p-1.5"
                    onClick={() => removeReplacement(i)}
                    title="Eliminar"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="glass-btn mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                onClick={addReplacement}
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                <Plus size={13} />
                Agregar par
              </button>
            </div>
          </GlassCard>

          {/* Shortcuts */}
          <GlassCard className="overflow-hidden">
            <SectionHeader
              title="Atajos"
              icon={Keyboard}
              description="Presiona «Cambiar» y luego la combinación de teclas que quieras usar"
            />
            <SettingRow
              label="Dictado"
              description="Mantén pulsado para grabar; tap rápido para manos libres."
              control={
                <HotkeyCapture
                  value={draft?.hotkey ?? ""}
                  onChange={(v) => setField("hotkey", v)}
                />
              }
            />
            <SettingRow
              label="Push-to-talk"
              description="Mantén pulsado mientras hablás; al soltar se envía el texto."
              control={
                <HotkeyCapture
                  value={draft?.ptt_hotkey ?? ""}
                  onChange={(v) => setField("ptt_hotkey", v)}
                />
              }
            />
            <SettingRow
              label="Cambiar modo"
              description="Alterna entre General, Correo y Nota sin abrir la app."
              control={
                <HotkeyCapture
                  value={draft?.mode_hotkey ?? ""}
                  onChange={(v) => setField("mode_hotkey", v)}
                />
              }
            />
            <SettingRow
              label="Pausa"
              description="Pausa la grabación sin terminarla. Otra vez reanuda."
              isLast
              control={
                <HotkeyCapture
                  value={draft?.pause_hotkey ?? ""}
                  onChange={(v) => setField("pause_hotkey", v)}
                />
              }
            />
          </GlassCard>

          {/* Permissions */}
          <GlassCard className="overflow-hidden">
            <SectionHeader
              title="Permisos"
              icon={ShieldCheck}
              description="Acceso al hardware y al sistema"
            />
            <SettingRow
              label="Micrófono"
              description="Necesario para capturar tu voz. Si Mushu no escucha, revisa los permisos del sistema."
              isLast
              control={
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    fontWeight: 700,
                    background: "rgba(22,163,74,0.10)",
                    border: "0.5px solid rgba(22,163,74,0.30)",
                    color: "var(--delta-green)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  <Volume2 size={11} strokeWidth={2.5} />
                  Concedido
                </span>
              }
            />
          </GlassCard>
        </div>
      </ScrollArea>

      {/* Unsaved changes bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
            style={{
              background: "oklch(13% 0.08 209 / 0.94)",
              borderTop: "0.5px solid var(--glass-border)",
              backdropFilter: "blur(20px) saturate(140%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 -8px 24px rgba(0,0,0,0.30)",
            }}
          >
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3">
              <p
                style={{
                  fontFamily: "'Geist Variable', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                Tienes cambios sin guardar.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
                  Descartar
                </Button>
                <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5">
                  <Save className="size-3.5" strokeWidth={2.25} />
                  {saving ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
