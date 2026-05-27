<div align="center">
  <img src="public/mushu-logo.png" alt="Mushu" width="128" height="128" />

# Mushu

**Voice dictation and AI assistant for Windows.**
Hold a shortcut, speak, and your text appears transcribed and reformatted in any app — emails, notes, code, whatever.

[![Release](https://img.shields.io/github/v/release/JGaldo-beep/mushu-v2?style=flat-square)](https://github.com/JGaldo-beep/mushu-v2/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)](https://github.com/JGaldo-beep/mushu-v2/releases/latest)
[![Electron](https://img.shields.io/badge/electron-42-47848f?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#license)

[Download](https://github.com/JGaldo-beep/mushu-v2/releases/latest) · [Report a bug](https://github.com/JGaldo-beep/mushu-v2/issues) · [Request a feature](https://github.com/JGaldo-beep/mushu-v2/issues)

</div>

---

## What is Mushu

Mushu lives as a system tray icon and a floating overlay. Press a global shortcut to start dictating, release it to receive your text transcribed and formatted according to the **active mode** (formal email, quick note, etc.). It works on top of any application — no copy/pasting between windows required.

Under the hood it uses Deepgram for streaming transcription and cloud language models to reformat the text.

## Features

- **Global push-to-talk** from any app with a configurable shortcut
- **Real-time transcription** via Deepgram (streaming WebSocket)
- **Contextual modes** that reformat the text: General, Email, Note
- **Floating overlay** with waveform, processing indicator, and response
- **Automatic text insertion** into the active app (no copy/paste needed)
- **Guided onboarding** the first time you open the app
- **Local transcription history**
- **Customizable shortcuts** for recording, mode switching, and pause
- **Supabase auth** to sync settings across devices

## Installation

Download the latest installer from [Releases](https://github.com/JGaldo-beep/mushu-v2/releases/latest):

- **Windows**: `Mushu-x.y.z-Setup.exe`

> Windows SmartScreen may show a warning because the binary is not yet signed with an EV certificate. Click **More info → Run anyway**.

## Default Shortcuts

| Action                | Shortcut           |
| --------------------- | ------------------ |
| Record (push-to-talk) | `Ctrl + Space`     |
| Switch mode           | `Ctrl + Shift + M` |
| Cycle mode            | `Ctrl + Shift + ,` |
| Pause / resume        | `Ctrl + Shift + P` |

All shortcuts are configurable from **Settings**.

## Modes

| Mode        | Purpose                                                        |
| ----------- | -------------------------------------------------------------- |
| **General** | Direct transcription, no reformatting                          |
| **Email**   | Structures dictation as an email (greeting, body, sign-off)    |
| **Note**    | Cleans up filler words and produces a concise note             |

## Development

### Requirements

- Node.js 20+
- npm
- Windows (the app is optimized for Windows; other platforms are not yet supported)

### Setup

```bash
git clone https://github.com/JGaldo-beep/mushu-v2.git
cd mushu-v2
npm install
```

Create a `.env` file in the root with the required variables:

```ini
DEEPGRAM_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
API_BASE_URL=http://localhost:3000
```

### Running in development mode

```bash
npm run dev
```

This starts Vite (renderer at `http://localhost:1420`) and Electron in parallel with hot-reload.

### Production build

```bash
# Packaged folder (no installer)
npm run pack:win

# NSIS installer
npm run dist:win
```

The installer is output to `release/Mushu-<version>-Setup.exe`.

## Stack

- **Electron 42** — app runtime
- **React 19 + Vite 7** — renderer
- **Tailwind 4 + shadcn/ui + Radix UI** — UI
- **Framer Motion** — animations
- **uiohook-napi** — global hotkeys
- **Deepgram** — streaming transcription
- **Supabase** — auth and sync
- **electron-builder** — packaging and distribution

## Structure

```
mushu-v2/
├── main.js              # Electron main process (tray, hotkeys, IPC)
├── preload.cjs          # contextIsolation bridge
├── index.html           # Main window (settings, history, account)
├── overlay.html         # Floating overlay with waveform
├── agent.html           # Agent window
├── explain.html         # Explain window
├── src/                 # Renderer (React)
│   ├── pages/           # Home, Modes, AI Features, Settings, Account
│   ├── components/      # Shared UI + onboarding
│   ├── hooks/           # useTheme, useOnboarding, etc.
│   └── lib/             # Types, theme, utils
├── public/              # Static assets (icons, sounds)
└── build/               # Packaging resources (icon.ico)
```

## Roadmap

- [ ] macOS and Linux support
- [ ] Code signing with EV certificate
- [ ] Auto-update via electron-updater
- [ ] More modes (code, translation, formal/casual)
- [ ] On-device transcription models (whisper.cpp)

## Contributing

Issues and pull requests are welcome. For large changes, please open an issue first to discuss the scope.

## License

[MIT](LICENSE) © JGaldo
