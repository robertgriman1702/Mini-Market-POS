import { useState, useCallback } from 'react';
import { ipcInvoke, IPCError }   from '@/lib/ipc';
import type { IPCChannels }      from '@pos/shared';

// =============================================================================
// useMutation — hook para escrituras IPC imperativas
//
// Retorna una función `mutate` que se llama cuando el usuario dispara
// una acción (click en guardar, confirmar venta, etc.)
//
// @example
// const { mutate, isLoading, error } = useMutation('productos:create', {
//   onSuccess: (producto) => { refetch(); toast('Producto creado'); },
//   onError:   (msg)      => toast.error(msg),
// });
// <button onClick={() => mutate(formData)}>Guardar</button>
// =============================================================================

interface MutationOptions<TReturn> {
  onSuccess?: (data: TReturn)  => void;
  onError?:   (error: string)  => void;
}

interface MutationState<TReturn> {
  data:      TReturn | null;
  isLoading: boolean;
  error:     string | null;
}

export function useMutation<K extends keyof IPCChannels>(
  channel: K,
  options?: MutationOptions<IPCChannels[K]['return']>
) {
  type TReturn = IPCChannels[K]['return'];

  const [state, setState] = useState<MutationState<TReturn>>({
    data:      null,
    isLoading: false,
    error:     null,
  });

  const mutate = useCallback(
    async (...args: IPCChannels[K]['args']): Promise<TReturn | null> => {
      setState({ data: null, isLoading: true, error: null });
      try {
        const data = await ipcInvoke(channel, ...args);
        setState({ data, isLoading: false, error: null });
        options?.onSuccess?.(data);
        return data;
      } catch (err) {
        const message = err instanceof IPCError ? err.message : 'Error inesperado';
        setState({ data: null, isLoading: false, error: message });
        options?.onError?.(message);
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel]
  );

  return { ...state, mutate };
}
