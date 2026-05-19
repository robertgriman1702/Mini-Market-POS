import type { IPCChannels, ApiResponse } from '@pos/shared';

// =============================================================================
// ipc.ts — cliente IPC del renderer
//
// Capa fina sobre window.electronAPI que hace el unwrap de ApiResponse<T>
// y convierte los errores en excepciones para que los hooks los capturen.
//
// Los hooks NO llaman a window.electronAPI directamente — usan esta capa.
// Así toda la lógica de error handling está en un solo lugar.
// =============================================================================

export async function ipcInvoke<K extends keyof IPCChannels>(
  channel: K,
  ...args: IPCChannels[K]['args']
): Promise<IPCChannels[K]['return']> {
  const response = (await window.electronAPI.invoke(
    channel,
    ...args
  )) as ApiResponse<IPCChannels[K]['return']>;

  if (!response.success) {
    throw new IPCError(response.error, response.code);
  }

  return response.data;
}

// Error tipado para que los componentes puedan distinguirlo
export class IPCError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'IPCError';
  }
}
