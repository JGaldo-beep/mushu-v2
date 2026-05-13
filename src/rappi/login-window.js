import { BrowserWindow, session } from 'electron';

const RAPPI_URL = 'https://www.rappi.com.co';
const PARTITION = 'persist:rappi';
const AUTH_COOKIE_NAMES = ['sAccessToken', 'access_token', 'bearer', 'rappi_auth', 'st-access-token'];

export async function isAlreadyAuthenticated() {
  const cookies = await session.fromPartition(PARTITION).cookies.get({});
  return cookies.some(
    (c) => AUTH_COOKIE_NAMES.includes(c.name) && (c.value?.length ?? 0) > 10,
  );
}

export function openLoginWindow() {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 1024,
      height: 720,
      title: 'Conectar Rappi — Mushu',
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    win.loadURL(RAPPI_URL);

    let settled = false;

    const pollInterval = setInterval(async () => {
      if (settled || win.isDestroyed()) return;
      try {
        const cookies = await session.fromPartition(PARTITION).cookies.get({});
        const authed = cookies.some(
          (c) => AUTH_COOKIE_NAMES.includes(c.name) && (c.value?.length ?? 0) > 10,
        );
        if (authed) {
          settled = true;
          clearInterval(pollInterval);
          if (!win.isDestroyed()) win.close();
          resolve();
        }
      } catch {
        // session not ready yet
      }
    }, 1000);

    win.on('closed', () => {
      clearInterval(pollInterval);
      if (!settled) {
        settled = true;
        reject(new Error('Login de Rappi cancelado por el usuario.'));
      }
    });
  });
}
