import { BrowserWindow, session } from 'electron';

const LOGIN_URL = 'https://www.rappi.com.co/login';
const PARTITION = 'persist:rappi';

// A URL is "post-login" when Rappi redirects away from /login after auth success.
function isPostLoginUrl(url) {
  return (
    url.includes('rappi.com') &&
    !url.includes('/login') &&
    !url.includes('/signup') &&
    !url.includes('/registro') &&
    !url.includes('/recover') &&
    !url.includes('/auth')
  );
}

// Broad check: any rappi.com cookie with a real value (not analytics like _ga/_gid).
export async function isAlreadyAuthenticated() {
  const cookies = await session.fromPartition(PARTITION).cookies.get({});
  const substantial = cookies.filter(
    (c) =>
      c.domain?.includes('rappi.com') &&
      !c.name.startsWith('_g') &&
      (c.value?.length ?? 0) > 20,
  );
  return substantial.length > 0;
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

    win.loadURL(LOGIN_URL);

    let settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      if (!win.isDestroyed()) win.close();
      resolve();
    }

    // Primary: detect the redirect away from /login that Rappi does after auth.
    win.webContents.on('did-navigate', (_event, url) => {
      if (isPostLoginUrl(url)) settle();
    });

    // Also catch client-side navigation (SPA pushState).
    win.webContents.on('did-navigate-in-page', (_event, url) => {
      if (isPostLoginUrl(url)) settle();
    });

    // Catch server-side redirects before they load.
    win.webContents.on('will-redirect', (_event, url) => {
      if (isPostLoginUrl(url)) settle();
    });

    win.on('closed', () => {
      if (!settled) {
        settled = true;
        reject(new Error('Login de Rappi cancelado por el usuario.'));
      }
    });
  });
}
