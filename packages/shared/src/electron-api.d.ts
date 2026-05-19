import type { IPCChannels } from './ipc/channels';
import type { IPCEvents } from './ipc/events';
import type { ApiResponse } from './api/response';
export interface ElectronAPI {
    /**
     * Invoca un handler IPC tipado en el Main Process.
     * Siempre retorna ApiResponse<T> — nunca lanza excepciones.
     *
     * @example
     * const res = await window.electronAPI.invoke('productos:getAll');
     * if (res.success) console.log(res.data);
     */
    invoke<K extends keyof IPCChannels>(channel: K, ...args: IPCChannels[K]['args']): Promise<ApiResponse<IPCChannels[K]['return']>>;
    /**
     * Escucha eventos unidireccionales del Main Process.
     * Retorna un unsubscribe() para usar en el cleanup de useEffect.
     *
     * @example
     * useEffect(() => window.electronAPI.on('stock:alerta-minimo', handler), []);
     */
    on<K extends keyof IPCEvents>(event: K, handler: (payload: IPCEvents[K]) => void): () => void;
    readonly appVersion: string;
}
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
//# sourceMappingURL=electron-api.d.ts.map