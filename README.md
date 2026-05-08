<div align="center">
  <img src="public/mushu-logo.png" alt="Mushu" width="128" height="128" />

# Mushu

**Dictado por voz y asistente de IA para Windows.**
Mantenés presionado un atajo, hablás, y el texto aparece transcrito y reformateado en cualquier app — correos, notas, código, lo que sea.

[![Release](https://img.shields.io/github/v/release/JGaldo-beep/mushu-v2?style=flat-square)](https://github.com/JGaldo-beep/mushu-v2/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)](https://github.com/JGaldo-beep/mushu-v2/releases/latest)
[![Electron](https://img.shields.io/badge/electron-42-47848f?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](#licencia)

[Descargar](https://github.com/JGaldo-beep/mushu-v2/releases/latest) · [Reportar bug](https://github.com/JGaldo-beep/mushu-v2/issues) · [Pedir feature](https://github.com/JGaldo-beep/mushu-v2/issues)

</div>

---

## Qué es Mushu

Mushu vive como un ícono en la bandeja del sistema y un overlay flotante. Con un atajo global empezás a dictar, y al soltar el atajo recibís el texto transcrito y formateado según el **modo activo** (correo formal, nota rápida, etc.). Funciona encima de cualquier aplicación — no hay que copiar/pegar entre ventanas.

Bajo el capó usa Deepgram para transcripción en streaming y modelos de lenguaje en la nube para reformatear el texto.

## Características

- **Push-to-talk global** desde cualquier app con un atajo configurable
- **Transcripción en tiempo real** vía Deepgram (streaming WebSocket)
- **Modos contextuales** que reformatean el texto: General, Correo, Nota
- **Overlay flotante** con waveform, indicador de procesamiento y respuesta
- **Inserción automática** del texto en la app activa (sin copiar/pegar)
- **Onboarding guiado** la primera vez que abrís la app
- **Historial local** de transcripciones
- **Atajos personalizables** para grabación, cambio de modo y pausa
- **Auth con Supabase** para sincronizar configuración entre dispositivos

## Instalación

Descargá el último instalador desde [Releases](https://github.com/JGaldo-beep/mushu-v2/releases/latest):

- **Windows**: `Mushu-x.y.z-Setup.exe`

> Windows SmartScreen puede mostrar un aviso porque el binario aún no está firmado con un certificado EV. Hacé clic en **Más información → Ejecutar de todas formas**.

## Atajos por defecto

| Acción                | Atajo              |
| --------------------- | ------------------ |
| Grabar (push-to-talk) | `Ctrl + Space`     |
| Cambiar de modo       | `Ctrl + Shift + M` |
| Ciclar modo           | `Ctrl + Shift + ,` |
| Pausar / reanudar     | `Ctrl + Shift + P` |

Todos son configurables desde **Settings**.

## Modos

| Modo        | Para qué sirve                                                  |
| ----------- | --------------------------------------------------------------- |
| **General** | Transcripción directa, sin reformateo                           |
| **Correo**  | Estructura el dictado como un email (saludo, cuerpo, despedida) |
| **Nota**    | Limpia muletillas y deja una nota concisa                       |

## Desarrollo

### Requisitos

- Node.js 20+
- npm
- Windows (la app está optimizada para Windows; otras plataformas no están soportadas todavía)

### Setup

```bash
git clone https://github.com/JGaldo-beep/mushu-v2.git
cd mushu-v2
npm install
```

Creá un archivo `.env` en la raíz con las variables necesarias:

```ini
DEEPGRAM_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
API_BASE_URL=http://localhost:3000
```

### Correr en modo desarrollo

```bash
npm run dev
```

Esto levanta Vite (renderer en `http://localhost:1420`) y Electron en paralelo con hot-reload.

### Build de producción

```bash
# Carpeta empaquetada (sin instalador)
npm run pack:win

# Instalador NSIS
npm run dist:win
```

El instalador queda en `release/Mushu-<version>-Setup.exe`.

## Stack

- **Electron 42** — runtime de la app
- **React 19 + Vite 7** — renderer
- **Tailwind 4 + shadcn/ui + Radix UI** — UI
- **Framer Motion** — animaciones
- **uiohook-napi** — hotkeys globales
- **Deepgram** — transcripción en streaming
- **Supabase** — auth y sincronización
- **electron-builder** — empaquetado y distribución

## Estructura

```
mushu-v2/
├── main.js              # Proceso principal de Electron (tray, hotkeys, IPC)
├── preload.cjs          # Bridge contextIsolation
├── index.html           # Ventana principal (settings, historial, account)
├── overlay.html         # Overlay flotante con waveform
├── agent.html           # Ventana del agente
├── explain.html         # Ventana de explain
├── src/                 # Renderer (React)
│   ├── pages/           # Home, Modes, AI Features, Settings, Account
│   ├── components/      # UI compartida + onboarding
│   ├── hooks/           # useTheme, useOnboarding, etc.
│   └── lib/             # Tipos, theme, utils
├── public/              # Assets estáticos (íconos, sonidos)
└── build/               # Recursos para empaquetar (icon.ico)
```

## Roadmap

- [ ] Soporte para macOS y Linux
- [ ] Firma de código con certificado EV
- [ ] Auto-update vía electron-updater
- [ ] Más modos (código, traducción, formal/casual)
- [ ] Modelos de transcripción on-device (whisper.cpp)

## Contribuir

Issues y pull requests son bienvenidos. Para cambios grandes, abrí primero un issue para discutir el alcance.

## Licencia

[MIT](LICENSE) © JGaldo
