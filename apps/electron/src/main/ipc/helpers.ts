import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { ok, fail, type ApiResponse }       from '@pos/shared';
import type { IPCChannels }                 from '@pos/shared';

// =============================================================================
// IPC Helpers
//
// safeHandler: envuelve cualquier handler en try/catch y garantiza que el
// renderer SIEMPRE recibe ApiResponse<T>, nunca una Promise rechazada.
//
// handle: registra un handler tipado contra IPCChannels.
// Cada archivo de handlers lo importa para registrar su dominio.
// =============================================================================

type HandlerFn<T> = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => T | Promise<T>;

export function safeHandler<T>(fn: HandlerFn<T>) {
  return async (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<ApiResponse<T>> => {
    try {
      const data = await fn(event, ...args);
      return ok(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      const code    = (err as NodeJS.ErrnoException).code;
      console.error('[IPC Error]', message);
      return fail(message, code);
    }
  };
}

export function handle<K extends keyof IPCChannels>(
  channel: K,
  fn: (
    event: IpcMainInvokeEvent,
    ...args: IPCChannels[K]['args']
  ) => IPCChannels[K]['return'] | Promise<IPCChannels[K]['return']>
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ipcMain.handle(channel, safeHandler(fn as any));
}
