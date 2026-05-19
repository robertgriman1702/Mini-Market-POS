import { useEffect } from 'react';
import type { IPCEvents } from '@pos/shared';

// =============================================================================
// useIPCEvent — suscripción a eventos del Main Process
//
// Limpia el listener automáticamente cuando el componente se desmonta.
//
// @example
// useIPCEvent('stock:alerta-minimo', (producto) => {
//   toast.warning(`Stock bajo: ${producto.nombre}`);
// });
// =============================================================================

export function useIPCEvent<K extends keyof IPCEvents>(
  event: K,
  handler: (payload: IPCEvents[K]) => void
): void {
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(event, handler);
    return unsubscribe; // cleanup automático al desmontar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
