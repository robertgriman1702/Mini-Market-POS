import { useState, useEffect, useCallback, useRef } from 'react';
import { ipcInvoke, IPCError }                      from '@/lib/ipc';
import type { IPCChannels }                         from '@pos/shared';

// =============================================================================
// useQuery — hook para lecturas IPC reactivas
//
// - Ejecuta automáticamente el invoke al montar
// - Re-ejecuta si cambian los argumentos
// - Expone refetch() para recargas manuales
// - Nunca actualiza el estado si el componente ya se desmontó
//
// @example
// const { data, isLoading, error } = useQuery('productos:getAll');
// const { data: prod } = useQuery('productos:getById', 5);
// =============================================================================

interface QueryState<T> {
  data:      T | null;
  isLoading: boolean;
  error:     string | null;
}

export function useQuery<K extends keyof IPCChannels>(
  channel: K,
  ...args: IPCChannels[K]['args']
) {
  type TData = IPCChannels[K]['return'];

  const [state, setState] = useState<QueryState<TData>>({
    data:      null,
    isLoading: true,
    error:     null,
  });

  const isMounted = useRef(true);
  // Serializar args para detectar cambios como dependencia de useEffect
  const argsKey   = JSON.stringify(args);

  const fetch = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const data = await ipcInvoke(channel, ...args);
      if (isMounted.current) setState({ data, isLoading: false, error: null });
    } catch (err) {
      if (!isMounted.current) return;
      const message = err instanceof IPCError ? err.message : 'Error inesperado';
      setState({ data: null, isLoading: false, error: message });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, argsKey]);

  useEffect(() => {
    isMounted.current = true;
    fetch();
    return () => { isMounted.current = false; };
  }, [fetch]);

  return { ...state, refetch: fetch };
}
