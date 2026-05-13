// BrowserView was deprecated in Electron 30+. We use a hidden BrowserWindow
// with the same persist:rappi partition to achieve the same result.
import { BrowserWindow } from 'electron';

const RAPPI_URL = 'https://www.rappi.com.co';
const PARTITION = 'persist:rappi';

export function createBackgroundWindow() {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // CDP debugger requires sandbox disabled
    },
  });

  win.loadURL(RAPPI_URL);
  return win;
}
