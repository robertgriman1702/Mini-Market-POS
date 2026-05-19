import { BrowserWindow, shell } from 'electron';
import path from 'path';

// =============================================================================
// WindowFactory
//
// Responsabilidad única: crear y configurar la ventana principal.
// No sabe nada de DB ni de IPC.
// =============================================================================

export class WindowFactory {
  static create(): BrowserWindow {
    const window = new BrowserWindow({
      width:           1280,
      height:          800,
      minWidth:        960,
      minHeight:       600,
      show:            false,      // Evita flash blanco durante carga
      title:           'POS MiniMarket',
      backgroundColor: '#0f172a',
      webPreferences: {
        preload:          path.join(__dirname, '../../preload/index.js'),
        nodeIntegration:  false,   // El renderer NO tiene acceso a Node
        contextIsolation: true,    // Aísla el preload del renderer
        sandbox:          false,   // Necesario para que el preload use ipcRenderer
        webSecurity:      process.env.NODE_ENV !== 'development',
      },
    });

    WindowFactory.loadContent(window);
    WindowFactory.setupEvents(window);

    return window;
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private static loadContent(window: BrowserWindow): void {
    if (process.env.NODE_ENV === 'development') {
      window.loadURL('http://localhost:5173');
      window.webContents.openDevTools({ mode: 'detach' });
    } else {
      window.loadFile(
        path.join(__dirname, '../../renderer/index.html')
      );
    }
  }

  private static setupEvents(window: BrowserWindow): void {
    // Mostrar la ventana solo cuando el DOM esté listo (sin flash blanco)
    window.once('ready-to-show', () => {
      window.show();
      window.focus();
    });

    // Links externos se abren en el navegador del sistema, no en Electron
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:')) shell.openExternal(url);
      return { action: 'deny' };
    });
  }
}
