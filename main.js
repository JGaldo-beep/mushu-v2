import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  screen,
  session,
  shell,
  Tray,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { uIOhook, UiohookKey } from "uiohook-napi";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const devServerArg = process.argv.find((arg) => arg.startsWith("--dev-server="));
const devServerUrl = devServerArg ? devServerArg.split("=").slice(1).join("=") : null;
const appDataPath = process.env.APPDATA || path.join(process.env.USERPROFILE || __dirname, "AppData", "Roaming");

app.setName("Mushu");
app.setPath("userData", path.join(appDataPath, "MushuV2Electron"));
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disk-cache-size", "0");

const MODE_MAP = {
  DEFAULT: { name: "DEFAULT", label: "General", color: "#d1ff3a", icon: "Mic" },
  EMAIL: { name: "EMAIL", label: "Correo", color: "#5fb5d8", icon: "Mail" },
  NOTE: { name: "NOTE", label: "Nota", color: "#cfc0e5", icon: "StickyNote" },
};
const MODE_ORDER = ["DEFAULT", "EMAIL", "NOTE"];
const HANDS_OFF_TAP_THRESHOLD_MS = 250;
const DEFAULT_SETTINGS = {
  hotkey: "Ctrl+Space",
  mode_hotkey: "Ctrl+Shift+M",
  cycle_mode_hotkey: "Ctrl+Shift+,",
  pause_hotkey: "Ctrl+Shift+P",
  api_base_url: "http://localhost:3000",
  supabase_url: "",
  supabase_anon_key: "",
  model: "whisper-large-v3-turbo",
  processing_mode: "cloud_first",
  transcription_provider: "deepgram",
  selected_microphone: null,
  theme: "system",
  sound_effects_enabled: true,
  sound_effects_volume: 0.22,
  onboarding_completed: false,
};

let mainWindow = null;
let overlayWindow = null;
let explainWindow = null;
let agentWindow = null;
let agentTargetHandle = null;
let agentBusy = false;
let tray = null;
let settings = { ...DEFAULT_SETTINGS };
let secrets = {};
let historyStore = [];
let recording = false;
let paused = false;
let handsOff = false;
let currentMode = MODE_MAP.DEFAULT;
let recordingStartedAt = 0;
let audioLevelInterval = null;
let capturedChunks = [];
let explainAbort = null;
let updateTrayMenu = null;
let modeBannerTimer = null;
let primaryHotkeyDown = false;
let primaryHotkeyStartedAt = 0;
let uiohookStarted = false;
let deepgramSocket = null;
let deepgramSocketReady = false;
let deepgramSocketFailed = false;
let deepgramFinalTranscript = "";
let deepgramInterimTranscript = "";
let deepgramStreamDone = null;
let deepgramStreamSeconds = 0;
let accountCache = null;
let pendingDeepLinkUrl = null;
let isQuitting = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

function loadDotEnvFile() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fsSync.existsSync(envPath)) return;
    const content = fsSync.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const rawValue = trimmed.slice(eq + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    console.error("[env] failed to load .env:", error instanceof Error ? error.message : String(error));
  }
}

loadDotEnvFile();

function resolveDistPath(fileName) {
  return path.join(__dirname, "dist", fileName);
}

function getFrontendState() {
  return {
    mode: currentMode,
    has_groq_key: Boolean(accountCache),
    has_deepgram_key: Boolean(accountCache),
    microphones: ["Default microphone"],
    account: accountCache,
    ...settings,
  };
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function pasteClipboardToActiveApp() {
  if (process.platform !== "win32") return Promise.resolve();

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-STA",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ],
      { windowsHide: true },
      (error) => {
        if (error) reject(error);
        else resolve();
      },
    );
  });
}

function execPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      { windowsHide: true },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(String(stdout || "").trim());
      },
    );
  });
}

function sendCopyToActiveApp() {
  if (process.platform !== "win32") return Promise.resolve();
  return execPowerShell(
    "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')",
  );
}

async function getForegroundWindowHandle() {
  if (process.platform !== "win32") return null;
  try {
    const out = await execPowerShell(
      `$sig='[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();'; Add-Type -MemberDefinition $sig -Namespace W -Name P; [W.P]::GetForegroundWindow().ToInt64()`,
    );
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function focusWindowAndPaste(handle) {
  if (process.platform !== "win32") return;
  const handleArg = handle ? `[System.IntPtr]::new(${handle})` : "[System.IntPtr]::Zero";
  const script = [
    "$sig = @'",
    "[DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(System.IntPtr hWnd);",
    "[DllImport(\"user32.dll\")] public static extern bool IsIconic(System.IntPtr hWnd);",
    "[DllImport(\"user32.dll\")] public static extern bool ShowWindow(System.IntPtr hWnd, int nCmdShow);",
    "'@",
    "Add-Type -MemberDefinition $sig -Namespace W -Name P",
    `$h = ${handleArg}`,
    "if ($h -ne [System.IntPtr]::Zero) {",
    "  if ([W.P]::IsIconic($h)) { [W.P]::ShowWindow($h, 9) | Out-Null }",
    "  [W.P]::SetForegroundWindow($h) | Out-Null",
    "  Start-Sleep -Milliseconds 70",
    "}",
    "Add-Type -AssemblyName System.Windows.Forms",
    "[System.Windows.Forms.SendKeys]::SendWait('^v')",
  ].join("\n");
  await execPowerShell(script);
}

async function captureSelectedTextFromActiveApp() {
  if (process.platform !== "win32") return "";
  const previous = clipboard.readText();
  const sentinel = `__mushu_capture_${Date.now()}__`;
  clipboard.writeText(sentinel);
  await sleep(40);
  try {
    await sendCopyToActiveApp();
  } catch (error) {
    console.error("[agent:copy] failed:", error instanceof Error ? error.message : String(error));
  }

  let captured = "";
  for (let i = 0; i < 14; i++) {
    await sleep(40);
    const cur = clipboard.readText();
    if (cur && cur !== sentinel) {
      captured = cur;
      break;
    }
  }

  if (previous) clipboard.writeText(previous);
  else clipboard.clear();

  return captured;
}

async function ensureStorageLoaded() {
  const base = app.getPath("userData");
  const settingsPath = path.join(base, "settings.json");
  const secretsPath = path.join(base, "secrets.json");
  const historyPath = path.join(base, "history.json");
  try {
    settings = { ...settings, ...JSON.parse(await fs.readFile(settingsPath, "utf-8")) };
  } catch {}
  try {
    secrets = JSON.parse(await fs.readFile(secretsPath, "utf-8"));
  } catch {}
  try {
    historyStore = JSON.parse(await fs.readFile(historyPath, "utf-8"));
  } catch {}
  settings = {
    ...settings,
    api_base_url:
      process.env.MUSHU_API_BASE_URL ||
      process.env.VITE_API_BASE_URL ||
      settings.api_base_url,
    supabase_url:
      process.env.MUSHU_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      settings.supabase_url,
    supabase_anon_key:
      process.env.MUSHU_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      settings.supabase_anon_key,
  };
}

async function persistState() {
  const base = app.getPath("userData");
  await fs.mkdir(base, { recursive: true });
  await fs.writeFile(path.join(base, "settings.json"), JSON.stringify(settings, null, 2));
  await fs.writeFile(path.join(base, "secrets.json"), JSON.stringify(secrets, null, 2));
  await fs.writeFile(path.join(base, "history.json"), JSON.stringify(historyStore, null, 2));
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function resolveMushuStreamUrl(apiBaseUrl) {
  const override = normalizeBaseUrl(process.env.MUSHU_STREAM_URL || process.env.VITE_MUSHU_STREAM_URL);
  if (override) return override;
  const url = new URL(apiBaseUrl);
  if (url.hostname === "localhost" && url.port === "3000") {
    url.port = "3001";
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/api/mushu/stream";
  url.search = "";
  return url.toString();
}

function findMushuDeepLink(argv = []) {
  return argv.find((arg) => String(arg || "").startsWith("mushu://")) || null;
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

async function handleMushuDeepLink(rawUrl) {
  if (!rawUrl) return false;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "mushu:") return false;
  if (url.hostname === "auth") {
    const encodedSession = url.searchParams.get("session");
    if (!encodedSession) return false;

    const session = JSON.parse(decodeBase64Url(encodedSession));
    if (!session?.access_token) return false;

    secrets.mushu_session = {
      ...session,
      token_type: session.token_type || "bearer",
    };
    accountCache = publicAccountFromSession(secrets.mushu_session, session.entitlement || null);
    await persistState();
    await refreshAccountFromBackend().catch((error) => {
      console.warn("[auth] deep link refresh failed:", error instanceof Error ? error.message : String(error));
    });
    broadcast("frontend_state_changed", {});
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
}

function requireAuthConfig() {
  const supabaseUrl = normalizeBaseUrl(settings.supabase_url);
  const supabaseAnonKey = String(settings.supabase_anon_key || "").trim();
  const apiBaseUrl = normalizeBaseUrl(settings.api_base_url);
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Falta configurar Supabase en .env (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).");
  }
  if (!apiBaseUrl) throw new Error("Falta configurar VITE_API_BASE_URL.");
  return { supabaseUrl, supabaseAnonKey, apiBaseUrl };
}

function publicAccountFromSession(session, entitlement = accountCache?.entitlement || null) {
  const user = session?.user;
  if (!session?.access_token || !user?.id) return null;
  return {
    user: {
      id: user.id,
      email: user.email || null,
      avatar_url: user.avatar_url || user.picture || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      full_name: user.full_name || user.name || user.user_metadata?.full_name || user.user_metadata?.name || null,
    },
    entitlement,
  };
}

async function refreshSupabaseSession() {
  const session = secrets.mushu_session;
  if (!session?.refresh_token) return null;
  const { supabaseUrl, supabaseAnonKey } = requireAuthConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) {
    secrets.mushu_session = null;
    accountCache = null;
    await persistState();
    return null;
  }
  const refreshed = await response.json();
  secrets.mushu_session = refreshed;
  accountCache = publicAccountFromSession(refreshed);
  await persistState();
  return refreshed;
}

async function getValidSession() {
  const session = secrets.mushu_session;
  if (!session?.access_token) return null;
  const expiresAtMs = Number(session.expires_at || 0) * 1000;
  if (expiresAtMs && Date.now() > expiresAtMs - 60_000) {
    return refreshSupabaseSession();
  }
  return session;
}

async function refreshAccountFromBackend() {
  const { apiBaseUrl } = requireAuthConfig();
  let session = await getValidSession();
  if (!session?.access_token) {
    accountCache = null;
    return null;
  }

  let response = await fetchWithBackendAuth(`${apiBaseUrl}/api/mushu/me`, session.access_token, {
    cache: "no-store",
  });

  if (response.status === 401) {
    session = await refreshSupabaseSession();
    if (!session?.access_token) {
      accountCache = null;
      return null;
    }
    response = await fetchWithBackendAuth(`${apiBaseUrl}/api/mushu/me`, session.access_token, {
      cache: "no-store",
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Backend Mushu ${response.status}: ${body || response.statusText}`);
  }

  accountCache = await response.json();
  return accountCache;
}

function applyConsumedSecondsToAccount(seconds) {
  const entitlement = accountCache?.entitlement;
  if (!entitlement || !Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return;
  const costSeconds = Math.max(1, Math.ceil(Number(seconds)));
  const usesSeconds =
    "trial_seconds_remaining" in entitlement ||
    "monthly_seconds_remaining" in entitlement;
  const cost = usesSeconds ? costSeconds : Math.max(1, Math.ceil(costSeconds / 60));
  const trialKey = usesSeconds ? "trial_seconds_remaining" : "trial_minutes_remaining";
  const monthlyKey = usesSeconds ? "monthly_seconds_remaining" : "monthly_minutes_remaining";
  const trial = Math.max(0, Number(entitlement[trialKey] || 0));
  const monthly = Math.max(0, Number(entitlement[monthlyKey] || 0));
  const nextTrial = Math.max(0, trial - cost);
  const nextMonthly = trial >= cost ? monthly : Math.max(0, monthly - (cost - trial));

  accountCache = {
    ...accountCache,
    entitlement: {
      ...entitlement,
      [trialKey]: nextTrial,
      [monthlyKey]: nextMonthly,
      updated_at: new Date().toISOString(),
    },
  };
}

function refreshAccountInBackground(delayMs = 1200) {
  setTimeout(() => {
    refreshAccountFromBackend()
      .then(() => broadcast("frontend_state_changed", {}))
      .catch((error) => {
        console.warn("[account] background refresh failed:", error instanceof Error ? error.message : String(error));
      });
  }, delayMs);
}

async function loginWithPassword(email, password) {
  const { supabaseUrl, supabaseAnonKey } = requireAuthConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: String(email || "").trim(),
      password: String(password || ""),
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Login Supabase ${response.status}: ${body || response.statusText}`);
  }
  secrets.mushu_session = await response.json();
  accountCache = publicAccountFromSession(secrets.mushu_session);
  await persistState();
  return refreshAccountFromBackend();
}

async function logoutAccount() {
  secrets.mushu_session = null;
  accountCache = null;
  await persistState();
}

async function getBackendAuthContext() {
  const { apiBaseUrl } = requireAuthConfig();
  const session = await getValidSession();
  if (!session?.access_token) {
    throw new Error("Inicia sesión en Mushu para usar el trial.");
  }
  return {
    apiBaseUrl,
    accessToken: session.access_token,
  };
}

async function fetchWithBackendAuth(url, accessToken, init = {}) {
  const headers = {
    ...(init.headers || {}),
    Authorization: `Bearer ${accessToken}`,
  };
  let response = await fetch(url, {
    ...init,
    headers,
    redirect: "manual",
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (location) {
      response = await fetch(new URL(location, url).toString(), {
        ...init,
        headers,
        redirect: "manual",
      });
    }
  }

  return response;
}

async function callMushuJson(pathname, body) {
  let { apiBaseUrl, accessToken } = await getBackendAuthContext();
  let response = await fetchWithBackendAuth(`${apiBaseUrl}${pathname}`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    const refreshed = await refreshSupabaseSession();
    if (!refreshed?.access_token) throw new Error("La sesión de Mushu expiró. Inicia sesión otra vez.");
    accessToken = refreshed.access_token;
    response = await fetchWithBackendAuth(`${apiBaseUrl}${pathname}`, accessToken, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Backend Mushu ${response.status}: ${parseGroqErrorBody(text)}`);
  }

  return response.json();
}

function createWindow(htmlFile, options) {
  const win = new BrowserWindow({
    show: false,
    backgroundColor: "#00000000",
    icon: path.join(__dirname, "public", "mushu-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    ...options,
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[window:${htmlFile}] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });
  win.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) console.error(`[renderer:${htmlFile}] ${message}`);
  });

  if (devServerUrl) {
    win.loadURL(`${devServerUrl.replace(/\/$/, "")}/${htmlFile}`);
  } else {
    win.loadFile(resolveDistPath(htmlFile));
  }
  return win;
}

function positionOverlay() {
  if (!overlayWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 500;
  const height = 86;
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2);
  const y = Math.round(display.workArea.y + display.workArea.height - height - 40);
  overlayWindow.setBounds({ x, y, width, height }, false);
}

function positionAgentWindow() {
  if (!agentWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 600;
  const height = 420;
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2);
  const y = Math.round(display.workArea.y + display.workArea.height - height - 110);
  agentWindow.setBounds({ x, y, width, height }, false);
}

async function openAgentFromSelection() {
  if (!agentWindow || agentWindow.isDestroyed()) return;
  if (agentBusy) return;
  if (agentWindow.isVisible()) {
    agentWindow.focus();
    return;
  }
  agentBusy = true;
  let selection = "";
  let error = null;

  try {
    if (!accountCache) {
      error = "Inicia sesión en Mushu para usar el agente.";
    } else {
      agentTargetHandle = await getForegroundWindowHandle();
      try {
        selection = await captureSelectedTextFromActiveApp();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      if (!selection && !error) {
        error = "No se detectó texto seleccionado. Selecciona algo y vuelve a intentarlo.";
      }
    }
  } finally {
    agentBusy = false;
  }

  positionAgentWindow();
  agentWindow.show();
  agentWindow.focus();
  // Renderer is already mounted (window is created at app start), so a tiny
  // delay is enough to ensure the listener is wired before we broadcast.
  setTimeout(() => {
    broadcast("agent_selection", { text: selection, error });
  }, 80);
}

function setupTray() {
  const iconPath = path.join(__dirname, "public", "mushu-icon.png");
  if (!fsSync.existsSync(iconPath)) return;
  tray = new Tray(iconPath);
  const showMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };
  const updateMenu = () => {
    const menu = Menu.buildFromTemplate([
      { label: `Mode: ${currentMode.label}`, enabled: false },
      { type: "separator" },
      { label: "Show Mushu", click: showMainWindow },
      { label: "Toggle Hands-off Dictation", click: () => toggleRecording() },
      { label: "Cycle Mode", click: () => cycleMode() },
      { label: "Quit", click: () => {
        isQuitting = true;
        app.quit();
      } },
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip("Mushu");
  };
  updateMenu();
  tray.on("click", showMainWindow);
  return updateMenu;
}

function normalizeAccelerator(value) {
  return String(value || "")
    .replace(/\bCtrl\b/gi, "CommandOrControl")
    .replace(/\s+/g, "");
}

function parseShortcutForHook(value) {
  const parts = String(value || "")
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const keyName = parts[parts.length - 1] || "space";
  const keyMap = {
    space: UiohookKey.Space,
    esc: UiohookKey.Escape,
    escape: UiohookKey.Escape,
    m: UiohookKey.M,
    p: UiohookKey.P,
  };
  return {
    ctrl: parts.includes("ctrl") || parts.includes("control") || parts.includes("cmdorctrl") || parts.includes("commandorcontrol"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command"),
    keycode: keyMap[keyName],
  };
}

function matchesShortcut(evt, shortcut) {
  if (!shortcut?.keycode || Number(evt.keycode) !== shortcut.keycode) return false;
  return (
    Boolean(evt.ctrlKey) === shortcut.ctrl &&
    Boolean(evt.shiftKey) === shortcut.shift &&
    Boolean(evt.altKey) === shortcut.alt &&
    Boolean(evt.metaKey) === shortcut.meta
  );
}

function showOverlayBanner() {
  positionOverlay();
  overlayWindow?.showInactive();
  broadcast("overlay_mode_banner", { active: true });
  if (modeBannerTimer) clearTimeout(modeBannerTimer);
  modeBannerTimer = setTimeout(() => {
    modeBannerTimer = null;
    broadcast("overlay_mode_banner", { active: false });
    if (!recording) overlayWindow?.hide();
  }, 1100);
}

function startAudioLevelEvents() {
  if (audioLevelInterval) clearInterval(audioLevelInterval);
  audioLevelInterval = setInterval(() => {
    if (!recording || paused) broadcast("audio_level", 0);
  }, 250);
}

function stopAudioLevelEvents() {
  if (audioLevelInterval) clearInterval(audioLevelInterval);
  audioLevelInterval = null;
  broadcast("audio_level", 0);
}

async function transformText(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return "";
  if (currentMode.name === "DEFAULT") return text;

  const instruction =
    currentMode.name === "EMAIL"
      ? "Reescribe el texto como correo profesional en espanol claro."
      : "Reescribe el texto como nota corta con bullets cuando convenga.";

  const data = await callMushuJson("/api/mushu/agent", {
    selectedText: text,
    instruction,
    mode: currentMode.name === "EMAIL" ? "email" : "summarize",
  });
  return String(data?.output || "").trim() || text;
}

function groqErrorMessage(prefix, error) {
  const raw = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${raw.replace(/^Error:\s*/i, "")}`;
}

function parseGroqErrorBody(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message || parsed?.err_msg || parsed?.message || body;
  } catch {
    return body;
  }
}

function makeAudioBlob(audioChunks, mimeType) {
  if (audioChunks.length === 0) {
    throw new Error("no se capturó audio del micrófono. Revisa permisos de micrófono en Windows.");
  }
  const audioBlob = new Blob(audioChunks, { type: mimeType || "audio/webm" });
  if (audioBlob.size < 128) {
    throw new Error("el audio capturado está vacío o es demasiado corto.");
  }
  return audioBlob;
}

function toAudioBytes(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value.type === "Buffer" && Array.isArray(value.data)) {
    return new Uint8Array(value.data);
  }
  return null;
}

function emitLiveTranscript() {
  const text = [deepgramFinalTranscript, deepgramInterimTranscript]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  broadcast("live_transcript", {
    text,
    isFinal: deepgramInterimTranscript.length === 0,
  });
}

function resetDeepgramStreamState() {
  deepgramFinalTranscript = "";
  deepgramInterimTranscript = "";
  deepgramStreamSeconds = 0;
  deepgramStreamDone = null;
  deepgramSocketFailed = false;
  broadcast("live_transcript", { text: "", isFinal: false });
}

function startDeepgramStream() {
  resetDeepgramStreamState();
  if (settings.transcription_provider !== "deepgram") {
    deepgramSocket = null;
    deepgramSocketReady = false;
    return;
  }

  void (async () => {
    try {
      const { apiBaseUrl, accessToken } = await getBackendAuthContext();
      const streamUrl = new URL(resolveMushuStreamUrl(apiBaseUrl));
      streamUrl.searchParams.set("language", "es");
      streamUrl.searchParams.set("content_type", "audio/webm");
      streamUrl.searchParams.set("access_token", accessToken);

      const socket = new WebSocket(streamUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      deepgramSocket = socket;
      deepgramStreamDone = new Promise((resolve) => {
        const done = () => resolve();
        socket.once("close", done);
        socket.once("error", done);
      });

      socket.on("open", () => {
        deepgramSocketReady = true;
        for (const chunk of capturedChunks) {
          if (chunk?.bytes instanceof Uint8Array && socket.readyState === WebSocket.OPEN) {
            socket.send(chunk.bytes);
          }
        }
      });

      socket.on("message", (raw) => {
        try {
          const data = JSON.parse(String(raw));
          if (data.type === "ready") {
            deepgramSocketReady = true;
            return;
          }
          if (data.type === "transcript") {
            const transcript = String(data.transcript || "").trim();
            if (!transcript) return;
            if (data.isFinal) {
              deepgramFinalTranscript = [deepgramFinalTranscript, transcript]
                .filter(Boolean)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
              deepgramInterimTranscript = "";
            } else {
              deepgramInterimTranscript = transcript;
            }
            emitLiveTranscript();
            return;
          }
          if (data.type === "done") {
            const transcript = String(data.transcript || "").trim();
            if (transcript) {
              deepgramFinalTranscript = transcript;
              deepgramInterimTranscript = "";
              emitLiveTranscript();
            }
            deepgramStreamSeconds = Number(data.seconds || 0);
            applyConsumedSecondsToAccount(deepgramStreamSeconds);
            broadcast("frontend_state_changed", {});
            refreshAccountInBackground();
            return;
          }
          if (data.type === "error") {
            deepgramSocketFailed = true;
            broadcast("transcription_error", String(data.message || "Deepgram stream error."));
          }
        } catch (error) {
          console.warn("[stt:stream] bad message:", error instanceof Error ? error.message : String(error));
        }
      });

      socket.on("close", () => {
        deepgramSocketReady = false;
      });
      socket.on("error", (error) => {
        deepgramSocketFailed = true;
        deepgramSocketReady = false;
        console.warn("[stt:stream] failed:", error instanceof Error ? error.message : String(error));
      });
    } catch (error) {
      deepgramSocketFailed = true;
      deepgramSocketReady = false;
      console.warn("[stt:stream] setup failed:", error instanceof Error ? error.message : String(error));
    }
  })();
}

async function finishDeepgramStream() {
  const socket = deepgramSocket;
  if (!socket) return deepgramFinalTranscript.trim();

  const done = deepgramStreamDone;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1600);
    Promise.resolve(done).then(() => {
      clearTimeout(timer);
      resolve();
    });
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "close" }));
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.once("open", () => socket.send(JSON.stringify({ type: "close" })));
      }
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });

  deepgramSocket = null;
  deepgramSocketReady = false;
  return (deepgramFinalTranscript || deepgramInterimTranscript).trim();
}

async function transcribeAudio(audioChunks, mimeType) {
  const audioBlob = makeAudioBlob(audioChunks, mimeType);
  const { apiBaseUrl, accessToken } = await getBackendAuthContext();
  const durationMs = recordingStartedAt ? Math.max(1, Date.now() - recordingStartedAt) : 1000;
  const contentType = mimeType || "audio/webm";

  console.info(`[stt:backend] sending ${audioBlob.size} bytes (${contentType})`);

  let response = await fetchWithBackendAuth(`${apiBaseUrl}/api/mushu/transcribe`, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Mushu-Duration-Ms": String(durationMs),
      "X-Mushu-Language": "es",
    },
    body: audioBlob,
  });

  if (response.status === 401) {
    const refreshed = await refreshSupabaseSession();
    if (!refreshed?.access_token) throw new Error("La sesión de Mushu expiró. Inicia sesión otra vez.");
    response = await fetchWithBackendAuth(`${apiBaseUrl}/api/mushu/transcribe`, refreshed.access_token, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-Mushu-Duration-Ms": String(durationMs),
        "X-Mushu-Language": "es",
      },
      body: audioBlob,
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Backend Mushu ${response.status}: ${parseGroqErrorBody(body)}`);
  }

  const data = await response.json();
  applyConsumedSecondsToAccount(Number(data?.seconds || 0));
  broadcast("frontend_state_changed", {});
  refreshAccountInBackground();
  return String(data?.transcript || "").trim();
}

async function processRecording() {
  broadcast("dictation_processing", { active: true });
  try {
    await sleep(settings.transcription_provider === "deepgram" ? 80 : 180);
    const textChunks = capturedChunks
      .filter((it) => typeof it.text === "string")
      .map((it) => it.text);
    const audioChunks = capturedChunks
      .filter((it) => it.bytes instanceof Uint8Array)
      .map((it) => it.bytes);
    const mimeType = capturedChunks.find((it) => it.mimeType)?.mimeType || "audio/webm";
    console.info(
      `[recording] textChunks=${textChunks.length} audioChunks=${audioChunks.length} mime=${mimeType}`,
    );
    const rawText =
      textChunks.join(" ").trim() ||
      (settings.transcription_provider === "deepgram" ? await finishDeepgramStream() : "") ||
      (await transcribeAudio(audioChunks, mimeType).catch((error) => {
        const providerLabel =
          settings.transcription_provider === "deepgram" ? "Deepgram" : "Groq";
        throw new Error(groqErrorMessage(`Transcripción ${providerLabel}`, error));
      }));
    if (!rawText) {
      broadcast("transcription_done", { text: "", mode: currentMode });
      return;
    }
    let transformed = rawText;
    try {
      transformed = await transformText(rawText);
    } catch (error) {
      const message = groqErrorMessage("Transformación Groq", error);
      console.error(message);
      broadcast("groq_error", message);
      // Si ya hay transcripción, no bloqueamos el flujo: pegamos el texto crudo.
      transformed = rawText;
    }
    clipboard.writeText(transformed);
    await sleep(80);
    await pasteClipboardToActiveApp().catch((error) => {
      console.error("[paste] failed:", error instanceof Error ? error.message : String(error));
    });
    historyStore.unshift({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      raw_text: rawText,
      processed_text: transformed,
      mode_used: currentMode.name,
      duration_ms: Date.now() - recordingStartedAt,
    });
    historyStore = historyStore.slice(0, 200);
    await persistState();
    broadcast("transcription_done", { text: transformed, mode: currentMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[recording] failed:", message);
    broadcast("groq_error", message);
    broadcast("transcription_error", message);
  } finally {
    broadcast("dictation_processing", { active: false });
  }
}

function cycleMode() {
  const idx = MODE_ORDER.indexOf(currentMode.name);
  const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
  currentMode = MODE_MAP[next];
  updateTrayMenu?.();
  broadcast("mode_changed", currentMode);
  broadcast("mode_switch_ok", currentMode);
  showOverlayBanner();
}

function startRecording({ handsOffMode = false } = {}) {
  if (recording) return;
  recording = true;
  paused = false;
  handsOff = handsOffMode;
  positionOverlay();
  overlayWindow?.showInactive();
  capturedChunks = [];
  recordingStartedAt = Date.now();
  broadcast("recording_started", currentMode);
  broadcast("hands_off_changed", handsOff);
  broadcast("dictation_paused", false);
  startAudioLevelEvents();
  startDeepgramStream();
}

function stopRecording({ cancel = false } = {}) {
  if (!recording) return;
  recording = false;
  paused = false;
  handsOff = false;
  primaryHotkeyDown = false;
  stopAudioLevelEvents();

  if (cancel) {
    capturedChunks = [];
    void finishDeepgramStream();
    resetDeepgramStreamState();
    broadcast("dictation_cancelled", {});
    broadcast("hands_off_changed", false);
    broadcast("dictation_paused", false);
    overlayWindow?.hide();
    return;
  }

  broadcast("recording_stopped", {});
  broadcast("hands_off_changed", false);
  broadcast("dictation_paused", false);
  void processRecording().finally(() => {
    overlayWindow?.hide();
  });
}

function toggleRecording() {
  if (recording) {
    stopRecording();
  } else {
    startRecording({ handsOffMode: true });
  }
}

function togglePause() {
  if (!recording) return;
  paused = !paused;
  broadcast("dictation_paused", paused);
  if (paused) {
    broadcast("audio_level", 0);
  }
}

function setHotkeys() {
  globalShortcut.unregisterAll();
  const hotkey = normalizeAccelerator(settings.hotkey);
  const agentHotkey = normalizeAccelerator(settings.mode_hotkey);
  const cycleModeHotkey = normalizeAccelerator(settings.cycle_mode_hotkey);
  const pauseHotkey = normalizeAccelerator(settings.pause_hotkey);
  const primaryShortcut = parseShortcutForHook(settings.hotkey);

  if (
    hotkey &&
    !globalShortcut.register(hotkey, () => {
      if (primaryHotkeyDown) return;
      primaryHotkeyDown = true;
      primaryHotkeyStartedAt = Date.now();
      if (!recording) startRecording({ handsOffMode: false });
    })
  ) {
    console.error(`No se pudo registrar hotkey principal: ${hotkey}`);
  }
  if (
    agentHotkey &&
    !globalShortcut.register(agentHotkey, () => {
      void openAgentFromSelection();
    })
  ) {
    console.error(`No se pudo registrar hotkey de agente: ${agentHotkey}`);
  }
  if (cycleModeHotkey && !globalShortcut.register(cycleModeHotkey, cycleMode)) {
    console.error(`No se pudo registrar hotkey de modo: ${cycleModeHotkey}`);
  }
  if (
    pauseHotkey &&
    !globalShortcut.register(pauseHotkey, () => {
      togglePause();
    })
  ) {
    console.error(`No se pudo registrar hotkey de pausa: ${pauseHotkey}`);
  }

  try {
    uIOhook.removeAllListeners("keydown");
    uIOhook.removeAllListeners("keyup");
    uIOhook.on("keydown", (evt) => {
      const key = Number(evt.keycode);
      if (matchesShortcut(evt, primaryShortcut) && !globalShortcut.isRegistered(hotkey)) {
        if (primaryHotkeyDown) return;
        primaryHotkeyDown = true;
        primaryHotkeyStartedAt = Date.now();
        if (!recording) startRecording({ handsOffMode: false });
        return;
      }
      if (recording && key === UiohookKey.Escape) {
        stopRecording({ cancel: true });
      }
    });
    uIOhook.on("keyup", (evt) => {
      if (!matchesShortcut(evt, primaryShortcut)) return;
      const heldForMs = Date.now() - primaryHotkeyStartedAt;
      primaryHotkeyDown = false;

      if (!recording) return;
      if (handsOff) {
        stopRecording();
        return;
      }
      if (heldForMs <= HANDS_OFF_TAP_THRESHOLD_MS) {
        handsOff = true;
        broadcast("hands_off_changed", true);
        return;
      }
      stopRecording();
    });
    if (!uiohookStarted) {
      uIOhook.start();
      uiohookStarted = true;
    }
  } catch {
    // ignore hook failures on unsupported platforms
  }
}

function registerIpc(updateTrayMenu) {
  ipcMain.handle("mushu:invoke", async (event, command, args = {}) => {
    const senderUrl = event.senderFrame?.url || "";
    const trusted = devServerUrl
      ? senderUrl.startsWith(devServerUrl.replace(/\/$/, "") + "/")
      : senderUrl.startsWith("file://");
    if (!trusted) throw new Error("Sender no confiable.");
    switch (command) {
      case "get_frontend_state":
        return getFrontendState();
      case "auth_login":
        await loginWithPassword(args.email, args.password);
        broadcast("frontend_state_changed", {});
        return getFrontendState();
      case "auth_logout":
        await logoutAccount();
        broadcast("frontend_state_changed", {});
        return getFrontendState();
      case "auth_refresh":
        await refreshAccountFromBackend();
        broadcast("frontend_state_changed", {});
        return getFrontendState();
      case "complete_onboarding":
        settings.onboarding_completed = true;
        await persistState();
        broadcast("frontend_state_changed", {});
        return getFrontendState();
      case "save_settings":
        settings = { ...settings, ...(args.input || {}) };
        await persistState();
        setHotkeys();
        broadcast("mushu_sound_prefs", {
          enabled: settings.sound_effects_enabled,
          volume: settings.sound_effects_volume,
        });
        broadcast("frontend_state_changed", {});
        return getFrontendState();
      case "test_groq":
        return accountCache ? "Groq listo desde el backend de Mushu." : "Inicia sesión para usar Groq desde backend.";
      case "test_deepgram":
        return accountCache
          ? "Deepgram listo desde el backend de Mushu. El streaming usa MUSHU_STREAM_URL o el proxy local :3001."
          : "Inicia sesión para usar Deepgram desde backend.";
      case "get_history":
        return historyStore;
      case "clear_history":
        historyStore = [];
        await persistState();
        broadcast("frontend_state_changed", {});
        return;
      case "copy_to_clipboard":
        clipboard.writeText(String(args.text || ""));
        return;
      case "open_external_url": {
        const url = String(args.url || "").trim();
        if (!/^https?:\/\//i.test(url)) throw new Error("URL no soportada.");
        await shell.openExternal(url);
        return;
      }
      case "set_mode":
        currentMode = MODE_MAP[String(args.mode || "DEFAULT")] || MODE_MAP.DEFAULT;
        updateTrayMenu?.();
        broadcast("mode_changed", currentMode);
        broadcast("mode_switch_ok", currentMode);
        showOverlayBanner();
        return;
      case "window_minimize":
        mainWindow?.minimize();
        return;
      case "window_toggle_maximize":
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
        return;
      case "window_close":
        mainWindow?.close();
        return;
      case "close_explain_window":
        explainWindow?.hide();
        return;
      case "agent_open_from_selection":
        await openAgentFromSelection();
        return { ok: true };
      case "agent_cancel":
        if (agentWindow && !agentWindow.isDestroyed()) agentWindow.hide();
        agentTargetHandle = null;
        broadcast("agent_processing", { active: false });
        return { ok: true };
      case "close_agent_window":
        if (agentWindow && !agentWindow.isDestroyed()) agentWindow.hide();
        agentTargetHandle = null;
        return;
      case "agent_submit": {
        const selectedText = String(args.selectedText || "").trim();
        const instruction = String(args.instruction || "").trim();
        const allowedModes = new Set(["agent", "email", "translate", "summarize"]);
        const mode = allowedModes.has(String(args.mode)) ? String(args.mode) : "agent";
        if (!selectedText) {
          broadcast("agent_error", { message: "No hay texto seleccionado." });
          return { ok: false, message: "no_selection" };
        }
        if (!instruction) {
          broadcast("agent_error", { message: "Falta la instrucción." });
          return { ok: false, message: "no_instruction" };
        }
        if (!accountCache) {
          broadcast("agent_error", { message: "Inicia sesión en Mushu para usar el agente." });
          return { ok: false, message: "no_session" };
        }

        broadcast("agent_processing", { active: true });
        try {
          const data = await callMushuJson("/api/mushu/agent", {
            selectedText,
            instruction,
            mode,
          });
          const output = String(data?.output || "").trim();
          if (!output) throw new Error("Respuesta vacía del agente.");

          const beforePaste = clipboard.readText();
          clipboard.writeText(output);

          const targetHandle = agentTargetHandle;
          agentTargetHandle = null;
          if (agentWindow && !agentWindow.isDestroyed()) agentWindow.hide();
          await sleep(90);

          try {
            if (targetHandle) {
              await focusWindowAndPaste(targetHandle);
            } else {
              await pasteClipboardToActiveApp();
            }
          } catch (pasteError) {
            console.error(
              "[agent:paste] failed:",
              pasteError instanceof Error ? pasteError.message : String(pasteError),
            );
          }

          await sleep(180);
          if (beforePaste) clipboard.writeText(beforePaste);

          broadcast("agent_done", { output });
          await refreshAccountFromBackend().catch(() => {});
          broadcast("frontend_state_changed", {});
          return { ok: true };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[agent] failed:", message);
          broadcast("agent_error", { message });
          return { ok: false, message };
        } finally {
          broadcast("agent_processing", { active: false });
        }
      }
      case "explain_stream":
        explainAbort?.abort?.();
        explainAbort = new AbortController();
        broadcast("explain_reset", {});
        const explainData = await callMushuJson("/api/mushu/agent", {
          selectedText: String(args.text || ""),
          instruction: "Explica el texto de forma simple y corta en espanol.",
          mode: "summarize",
        });
        broadcast("explain_chunk", String(explainData?.output || ""));
        broadcast("explain_done", {});
        return;
      default:
        throw new Error(`Comando no soportado: ${command}`);
    }
  });

  ipcMain.on("mushu:audio-chunk", (_event, payload) => {
    if (typeof payload?.level === "number") {
      broadcast("audio_level", Math.max(0, Math.min(1, payload.level)));
      return;
    }
    if (typeof payload?.error === "string") {
      broadcast("transcription_error", payload.error);
      return;
    }
    if (!recording || paused) return;
    const bytes = toAudioBytes(payload?.bytes);
    if (bytes) {
      capturedChunks.push({
        bytes,
        mimeType: payload.mimeType,
        ts: payload.ts,
      });
      if (
        settings.transcription_provider === "deepgram" &&
        deepgramSocketReady &&
        deepgramSocket?.readyState === WebSocket.OPEN
      ) {
        deepgramSocket.send(bytes);
      }
      return;
    }
    capturedChunks.push(payload);
  });
}

function isTrustedMediaPermission(webContents) {
  const url = webContents.getURL();
  return devServerUrl ? url.startsWith(devServerUrl.replace(/\/$/, "") + "/") : url.startsWith("file://");
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
pendingDeepLinkUrl = findMushuDeepLink(process.argv);

if (process.defaultApp) {
  app.setAsDefaultProtocolClient("mushu", process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient("mushu");
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  pendingDeepLinkUrl = url;
  void handleMushuDeepLink(url);
});

app.on("second-instance", (_event, argv) => {
  const deepLinkUrl = findMushuDeepLink(argv);
  if (deepLinkUrl) {
    void handleMushuDeepLink(deepLinkUrl);
    return;
  }
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  await ensureStorageLoaded();
  await refreshAccountFromBackend().catch((error) => {
    console.warn("[auth] account refresh skipped:", error instanceof Error ? error.message : String(error));
  });
  Menu.setApplicationMenu(null);

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" && isTrustedMediaPermission(webContents));
  });

  mainWindow = createWindow("index.html", {
    width: 1260,
    height: 780,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    autoHideMenuBar: true,
  });
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  overlayWindow = createWindow("overlay.html", {
    width: 500,
    height: 86,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
  });
  explainWindow = createWindow("explain.html", {
    width: 520,
    height: 460,
    minWidth: 420,
    minHeight: 320,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
  });
  agentWindow = createWindow("agent.html", {
    width: 600,
    height: 420,
    minWidth: 480,
    minHeight: 320,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
  });

  updateTrayMenu = setupTray();
  registerIpc(updateTrayMenu);
  setHotkeys();
  positionOverlay();
  overlayWindow.hide();
  explainWindow.hide();
  agentWindow.hide();
  if (pendingDeepLinkUrl) {
    await handleMushuDeepLink(pendingDeepLinkUrl);
    pendingDeepLinkUrl = null;
  }
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow("index.html", {});
    mainWindow?.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  try {
    if (uiohookStarted) uIOhook.stop();
  } catch {}
});
}
