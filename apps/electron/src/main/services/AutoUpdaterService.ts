import { autoUpdater }  from 'electron-updater';
import { BrowserWindow } from 'electron';

export class AutoUpdaterService {
  private static initialized = false;
  private static availableVersion: string | null = null;

  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.autoDownload = false;

    autoUpdater.on('update-available', (info) => {
      this.availableVersion = info.version;

      console.log(`[Updater] Nueva version: ${info.version}`);
      this.emit('updater:available', {
        version: info.version,
        notes: (info.releaseNotes as string) ?? '',
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[Updater] App actualizada.');
    });

    autoUpdater.on('download-progress', (p) => {
      const percent = Math.min(99, Math.max(1, Math.round(p.percent)));
      this.emit('updater:progress', percent);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[Updater] v${info.version} lista.`);
      this.emit('updater:progress', 100);
      this.emit('updater:ready', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.warn('[Updater]', err.message);
    });

    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10_000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  }

  static download(): void {
    this.emit('updater:progress', 1);

    autoUpdater.downloadUpdate()
      .then(() => {
        if (this.availableVersion) {
          this.emit('updater:progress', 100);
          this.emit('updater:ready', this.availableVersion);
        }
      })
      .catch((err) => {
        console.error('[Updater] Error al descargar:', err.message);
      });
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