import { app, BrowserWindow, net } from 'electron';
import { DatabaseConnection }  from './database/DatabaseConnection';
import { MigrationRunner }     from './database/MigrationRunner';
import { registerAllHandlers }  from './ipc/registry';
import { AutoUpdaterService }   from './services/AutoUpdaterService';
import { BcvService }            from './services/BcvService';
import { LicenseService }       from './services/LicenseService';
import { WindowFactory }       from './window/WindowFactory';
import type { LicenseStatus, LicenseEstado } from '@pos/shared';

// =============================================================================
// PATCH: Electron bloquea fetch() del Main Process a menos que se use
// el fetch nativo de Electron (net.fetch) o se configure correctamente.
// Reasignamos globalThis.fetch para usar el fetch de Node.js 20 que viene
// con Electron 30, que sí tiene acceso a internet sin restricciones CSP.
// =============================================================================
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
//   2. Validación obligatoria de licencia (LicenseService)
//   3. IPC (registrar todos los handlers) — solo si la licencia lo permite
//   4. Ventana principal (normal o de bloqueo, según el resultado de 2)
//
// No contiene lógica de negocio de dominio. Solo ciclo de vida + enforcement
// de licencia, que es responsabilidad exclusiva del Main Process.
//
// -----------------------------------------------------------------------------
// POLÍTICA DE BLOQUEO POR LICENCIA
// -----------------------------------------------------------------------------
// Estados que PERMITEN el arranque normal:
//   - 'valid'         : licencia vigente (online o verificada localmente)
//   - 'grace_period'  : sin contacto reciente con el backend, pero dentro de
//                        la ventana de tolerancia offline — debe poder seguir
//                        operando el negocio mientras no haya internet.
//
// Estados que BLOQUEAN el arranque (se muestra una ventana de bloqueo en
// lugar de la aplicación, y NO se registran los handlers IPC de negocio):
//   - 'invalid'   : firma o HWID no coinciden (archivo corrupto o copiado)
//   - 'revoked'   : el backend marcó la licencia como revocada
//   - 'suspended' : el backend marcó la licencia como suspendida
//   - 'expired'   : la licencia superó su fecha de expiración definitiva
//
// 'not_found' no forma parte de los requisitos de bloqueo de este cambio —
// se mantiene el comportamiento ya existente en el resto del sistema
// (Settings.tsx ya informa 'not_found' como licencia no activada). Para no
// dejar la aplicación inutilizable antes de la primera activación, en este
// caso se permite el arranque normal: es allí, dentro de la propia app
// (pantalla de Configuración), donde el usuario activa su licencia por
// primera vez.
// =============================================================================

const ESTADOS_BLOQUEANTES: LicenseEstado[] = ['invalid', 'revoked', 'suspended', 'expired'];

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

  // 2 — Validación obligatoria de licencia (online-first, offline-tolerant)
  const license = new LicenseService();
  const status  = await license.check();

  if (ESTADOS_BLOQUEANTES.includes(status.estado)) {
    console.warn(`[Main] Licencia bloqueada (estado: ${status.estado}) — arranque detenido.`);
    mainWindow = crearVentanaDeBloqueo(status);
    return;
  }

  console.log(`[Main] Licencia OK (estado: ${status.estado}) — continuando arranque.`);

  // 3 — IPC handlers (necesitan la DB lista). Solo se registran cuando la
  // licencia permite operar — así ningún canal de negocio queda accesible
  // mientras la app está bloqueada.
  registerAllHandlers(db);

  // Servicios en background
  BcvService.startAutoRefresh();
  if (process.env.NODE_ENV !== 'development') {
    AutoUpdaterService.init();
  }

  // 4 — Ventana principal
  mainWindow = WindowFactory.create();
}

// ---------------------------------------------------------------------------
// Ventana de bloqueo — se muestra cuando la licencia no permite operar.
// No depende de WindowFactory ni de ningún archivo adicional: el contenido
// se carga inline para mantener el bloqueo autocontenido en este archivo.
// ---------------------------------------------------------------------------

function crearVentanaDeBloqueo(status: LicenseStatus): BrowserWindow {
  const window = new BrowserWindow({
    width:           520,
    height:          420,
    resizable:       false,
    minimizable:      false,
    maximizable:      false,
    title:            'POS MiniMarket — Licencia',
    backgroundColor:  '#0f172a',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          true,
    },
  });

  const mensajes: Record<string, string> = {
    invalid:   'La licencia de esta instalación no es válida en este equipo.',
    revoked:   'Esta licencia fue revocada. Contacta a tu proveedor para más información.',
    suspended: 'Esta licencia está temporalmente suspendida. Contacta a tu proveedor.',
    expired:   'La licencia ha expirado. Renueva tu licencia para continuar usando el sistema.',
  };

  const mensaje = mensajes[status.estado] ?? 'No fue posible validar la licencia de este equipo.';

  const html = `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            margin: 0; height: 100vh; display: flex; flex-direction: column;
            align-items: center; justify-content: center; text-align: center;
            background: #0f172a; color: #e2e8f0;
            font-family: -apple-system, Segoe UI, Roboto, sans-serif;
            padding: 32px; box-sizing: border-box;
          }
          h1 { font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase; color: #f87171; margin-bottom: 16px; }
          p  { font-size: 14px; color: #94a3b8; line-height: 1.6; max-width: 380px; }
          .hwid { margin-top: 24px; font-family: monospace; font-size: 12px; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>Acceso bloqueado</h1>
        <p>${mensaje}</p>
        <p class="hwid">Equipo: ${status.hwid}</p>
      </body>
    </html>
  `;

  window.loadURL(`data:text/html,${encodeURIComponent(html)}`);
  window.once('ready-to-show', () => window.show());

  return window;
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