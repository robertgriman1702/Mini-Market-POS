import { autoUpdater }  from 'electron-updater';
import { BrowserWindow } from 'electron';

// =============================================================================
// AutoUpdaterService — sin electron-log para evitar dependencia extra
// =============================================================================

export class AutoUpdaterService {
  private static initialized = false;

  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoDownload         = false;

    autoUpdater.on('update-available', (info) => {
      console.log(`[Updater] Nueva versión: ${info.version}`);
      this.emit('updater:available', {
        version: info.version,
        notes:   (info.releaseNotes as string) ?? '',
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[Updater] App actualizada.');
    });

    autoUpdater.on('download-progress', (p) => {
      this.emit('updater:progress', Math.round(p.percent));
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[Updater] v${info.version} lista.`);
      this.emit('updater:ready', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.warn('[Updater]', err.message);
    });

    // Revisar 30s después de arrancar, luego cada 4h
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 30_000);
    setInterval(()  => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  }

  static download(): void {
    autoUpdater.downloadUpdate().catch((err) =>
      console.error('[Updater] Error al descargar:', err.message)
    );
  }

  static installAndRestart(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  private static emit(event: string, payload?: unknown): void {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send(event, payload)
    );
  }
}