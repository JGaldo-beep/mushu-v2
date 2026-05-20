import { BrowserWindow, screen } from 'electron';

const RAPPI_URL = 'https://www.rappi.com.co';
const PARTITION = 'persist:rappi';

export function createBackgroundWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = 390;
  const height = Math.min(820, workArea.height);
  const x = workArea.x + workArea.width - width;
  const y = workArea.y;

  const win = new BrowserWindow({
    show: false,
    width,
    height,
    x,
    y,
    title: 'Rappi — Sofía',
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadURL(RAPPI_URL);
  return win;
}
