# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm run dev          # Start renderer (Vite) + Electron concurrently
npm run build        # Build icons + TypeScript + Vite (output: dist/)
npm run dist:win     # Build + package as NSIS installer → release/Mushu-Setup.exe
npm run release:win  # Build + publish to GitHub Releases (requires $env:GH_TOKEN)
npx tsc --noEmit     # Type-check without building
```

No test suite exists. Verify changes by running `npm run dev`.

**Vite hot-reloads the renderer; `main.js` does not.** After editing `main.js`, `preload.cjs`, or anything in the main process, fully stop and restart `npm run dev` — the running Electron process keeps the old code.

## Architecture

### Process model
Mushu is an Electron app with three BrowserWindow instances:
- **main window** (`index.html`) — Settings, account, history, modes UI
- **overlay window** (`overlay.html`) — Always-on-top floating bar showing waveform + live transcript
- **explain window** (`explain.html`) — Popup for the "Explain" feature

All core application logic lives in **`main.js`** (the Electron main process). Renderer processes are React 19 apps built with Vite. There is no shared state library — React state is always derived from `FrontendState` returned by the main process.

`main.js` runs as an ES module (`"type": "module"` in `package.json`).

### IPC bridge
`preload.cjs` exposes a single `window.mushu` object with three methods:
- `invoke(command, args)` → async IPC call to `main.js` switch statement
- `on(event, callback)` → subscribes to main-process broadcasts (`broadcast()` helper in main.js)
- `emitAudioChunk(chunk)` → sends audio data from overlay renderer to main process

`src/lib/tauri.ts` wraps all `invoke` calls with typed signatures. `src/lib/events.ts` wraps `window.mushu.on` for typed event subscriptions. Add new IPC commands by: (1) adding a `case` in the `ipcMain.handle("mushu:invoke", ...)` switch in main.js, and (2) adding a typed wrapper in `src/lib/tauri.ts`.

**Sender trust check:** every `mushu:invoke` rejects calls whose `event.senderFrame.url` doesn't match the dev server origin (in dev) or `file://` (in prod). When adding a new BrowserWindow, load it from one of the existing HTML entry points (or the dev server) — arbitrary URLs will be refused.

### Audio pipeline
1. `useCaptureBridge` (overlay renderer) listens for `recording_started` → calls `getUserMedia` → creates a `MediaRecorder` (WebM/Opus, 250ms chunks) and an `AudioWorklet` (linear16, 16kHz) in parallel
2. Each chunk is sent to main via `window.mushu.emitAudioChunk()`
3. `main.js` handler (`mushu:audio-chunk`) pushes bytes to `capturedChunks[]` and simultaneously streams them over WebSocket

### Transcription flow
Two parallel paths are attempted when recording starts:
- **DeepGram direct** (`startDeepgramDirectStream`) — if `secrets.deepgram_api_key` exists, opens `wss://api.deepgram.com/v1/listen` with `nova-3`, `language=multi`, `smart_format`, `punctuate`, `numerals`, `vad_events`, `endpointing`. Token passed as `?token=` query param.
- **Backend proxy** (`startDeepgramStream`) — WebSocket to a separate stream service if no direct key (currently a Railway deployment configured via `MUSHU_STREAM_URL`).

When recording stops, `finishDeepgramStream()` waits up to 400ms for a final result, then falls back to the interim transcript. If neither stream produced output, falls back to `transcribeAudio()` (REST POST to `https://mushu.space/api/transcribe`).

### Settings and secrets
Stored as JSON files in `%APPDATA%/MushuV2Electron/`:
- `settings.json` — all non-sensitive settings (hotkeys, theme, provider, etc.)
- `secrets.json` — API keys (`deepgram_api_key`, `groq_api_key`)
- `history.json` — last 200 transcription entries

`DEFAULT_SETTINGS` in main.js is the canonical default; `FrontendState` in `src/lib/types.ts` is the TypeScript shape returned to renderers. When adding a new setting: add to `DEFAULT_SETTINGS`, add to `FrontendState`, add to `SaveSettingsInput`, handle in the `save_settings` IPC case **and** add the field to the explicit payload built inside `src/hooks/useSettings.ts` `save()` — that hook hand-picks fields rather than spreading `draft`, so a missing entry silently drops the value on save. `cycle_mode_hotkey` is the standing example of this gap: it lives in `DEFAULT_SETTINGS` and `FrontendState` but is missing from both `SaveSettingsInput` and the hook payload, so it currently cannot be edited from the UI.

### Auth and Mushu backend
Most cloud features (Groq formatting, the selection agent, the streaming-STT proxy, entitlements) go through the hosted Mushu backend at `https://mushu.space` (`settings.api_base_url`), authenticated with Supabase.

Endpoints called by the client:
- `GET /api/me` — account + entitlement refresh
- `POST /api/transcribe` — audio-to-text fallback (REST)
- `POST /api/translate` — text translation
- `POST /api/agent` — selection agent and explain mode
- `GET /api/releases/latest` — future auto-update (not yet wired; see TODO in `main.js`)

The WebSocket stream URL is a separate service. By default `resolveMushuStreamUrl()` derives it from `api_base_url` by swapping `http→ws` and appending `/api/mushu/stream`; in practice this is overridden by the `MUSHU_STREAM_URL` env var that points at the Railway deployment.

- **Login flow:** the user authenticates in their browser; the backend redirects to `mushu://auth?session=<base64url-JSON>`. Electron's single-instance lock (`gotSingleInstanceLock`) captures the URL out of `argv`, and `handleMushuDeepLink()` decodes it into `secrets.mushu_session` and mirrors it as the runtime `accountCache`. Don't add a second `requestSingleInstanceLock` caller or the protocol breaks.
- **Backend calls:** always use `callMushuJson()` / `fetchWithBackendAuth()`. They auto-refresh the Supabase access token via `getValidSession()` on 401. Direct `fetch()` against the backend will silently break when tokens expire.

### .env loading
`loadDotEnvFile()` reads a `.env` file adjacent to `main.js` at startup and fills any `VITE_*` keys not already in `process.env`. The settings UI fields `supabase_url`, `supabase_anon_key`, and `api_base_url` fall back to `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` respectively when empty. The `.env` file is packaged into the installer via `build.files` in `package.json` — treat it as the source of defaults for distributed builds, not a secret store.

### Visual identity
The canonical palette and brand assets live in the sibling `mushu-landing` repo. Tokens defined in `src/index.css` (`:root` light + `.dark` block) and mirrored in `src/overlay/overlay.css`. Logos: `public/mini-logo.svg` (badge / icon), `public/logo.svg` (wordmark). `scripts/generate-icon.cjs` regenerates `build/icon.ico` and the PNG icon set from `public/mini-logo.svg`.

Component-level utilities in `src/styles/design-tokens.css` consume the canonical tokens via `var(--primary)` etc. and via backward-compat aliases (`--text-primary`, `--glass-bg`, …) so legacy inline-style consumers keep working. Long-term those should migrate to canonical token names directly.

### Hotkey system
Two layers:
- **`globalShortcut`** (Electron) — registered in `setHotkeys()` for: primary hotkey, `mode_hotkey`, `cycle_mode_hotkey`, `pause_hotkey`
- **`uIOhook`** (low-level native hook) — handles PTT (`ptt_hotkey`) and hold-vs-tap logic for the primary hotkey, since `globalShortcut` can't distinguish hold from tap

`normalizeAccelerator()` converts `Ctrl+X` → `CommandOrControl+X` for Electron's format. `parseShortcutForHook()` converts to uIOhook keycodes. Both run in `setHotkeys()` which is called after every settings save.

### Mode system
Three modes: `DEFAULT` (raw dictation), `EMAIL` (AI-formatted as email), `NOTE` (AI-summarized). `cycleMode()` rotates through them. The current mode affects post-processing but not the transcription itself. Mode is stored in runtime variable `currentMode` (not persisted to disk).

### Agent intercepts in `processRecording`
After the transcript is finalized, `processRecording()` runs a chain of intercepts before falling through to normal text injection:
1. **Selection agent** (`agentSelection && accountCache`) — calls the Mushu backend's `/api/agent` with the captured selection as context.
2. Otherwise → translate/format → clipboard → paste.

**Invariant:** every early-return branch in `processRecording()` must still `broadcast("transcription_done", { text, mode: currentMode })` (use `try/finally`). The overlay listens for this event to reset from the "processing" state — skipping it leaves the pill stuck and visually breaks the next recording even though the audio pipeline still works.

### WhatsApp agent (moved to `feat/whatsapp`)
The voice-driven WhatsApp send feature lives on the `feat/whatsapp` branch. It includes `whatsapp-web.js` + puppeteer for the WhatsApp Web client, Anthropic Haiku for intent parsing, and a QR-pairing flow. Checkout `feat/whatsapp` to resume work on it. Do not re-add WhatsApp code to `main` without coordinating with the branch.

### Publishing a release
Set `GH_TOKEN` env var (GitHub classic token with `repo` scope), then run `npm run release:win`. electron-builder creates a GitHub Release tagged `v{version}` with `Mushu-Setup.exe` as the asset. Bump `version` in `package.json` before releasing.
