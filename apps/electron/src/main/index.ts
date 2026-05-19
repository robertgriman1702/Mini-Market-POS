import { app, BrowserWindow, net } from 'electron';
import { DatabaseConnection }  from './database/DatabaseConnection';
import { MigrationRunner }     from './database/MigrationRunner';
import { registerAllHandlers }  from './ipc/registry';
import { AutoUpdaterService }   from './services/AutoUpdaterService';
import { BcvService }            from './services/BcvService';
import { WindowFactory }       from './window/WindowFactory';

// =============================================================================
// PATCH: Electron bloquea fetch() del Main Process a menos que se use
// el fetch nativo de Electron (net.fetch) o se configure correctamente.
// Reasignamos globalThis.fetch para usar el fetch de Node.js 20 que viene
// con Electron 30, que sí tiene acceso a internet sin restricciones CSP.
// =============================================================================
// Si fetch no está disponible o está siendo interceptado, usar net.fetch de Electron
if (!globalThis.fetch) {
  console.warn('[Main] fetch no disponible — usando net.fetch de Electron');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = (input: unknown, init?: unknown) =>
    net.fetch(input as string, init as Parameters<typeof net.fetch>[1]);
}

// =============================================================================
// Main Process — punto de entrada de Electron
//
// Responsabilidad: orquestar el arranque de los tres subsistemas en orden:
//   1. Base de datos (conexión + migraciones)
//   2. IPC (registrar todos los handlers)
//   3. Ventana principal
//
// No contiene lógica de negocio. Solo ciclo de vida.
// =============================================================================

// --- Single instance lock: evitar que el usuario abra la app dos veces ---
if (!app.requestSingleInstanceLock()) {
  console.warn('[Main] Ya hay una instancia corriendo. Cerrando esta.');
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  // 1 — Base de datos
  const dbConn = DatabaseConnection.getInstance();
  const db     = dbConn.open();
  new MigrationRunner(db).run();

  // 2 — IPC handlers (necesitan la DB lista)
  registerAllHandlers(db);

  // Servicios en background
  BcvService.startAutoRefresh();
  if (process.env.NODE_ENV !== 'development') {
    AutoUpdaterService.init();
  }

  // 3 — Ventana principal
  mainWindow = WindowFactory.create();
}

// ---------------------------------------------------------------------------
// Ciclo de vida de Electron
// ---------------------------------------------------------------------------

app.whenReady().then(bootstrap).catch((err) => {
  console.error('[Main] Error crítico en el arranque:', err);
  app.quit();
});

// En macOS: re-crear la ventana si el usuario hace clic en el dock
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = WindowFactory.create();
  }
});

// Windows/Linux: cerrar la app cuando se cierran todas las ventanas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Traer al frente si el usuario intenta abrir una segunda instancia
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Liberar recursos al salir — importante para que SQLite guarde correctamente
app.on('will-quit', () => {
  DatabaseConnection.getInstance().close();
});

// ---------------------------------------------------------------------------
// Manejo global de errores no capturados
// ---------------------------------------------------------------------------

process.on('uncaughtException',   (err)    => console.error('[Main] Uncaught:', err));
process.on('unhandledRejection',  (reason) => console.error('[Main] Unhandled rejection:', reason));