import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, IPCChannels, IPCEvents } from '@pos/shared';

const INVOKE_WHITELIST = new Set<keyof IPCChannels>([
  // Productos
  'productos:getAll',
  'productos:getById',
  'productos:getByQR',
  'productos:buscar',
  'productos:create',
  'productos:update',
  'productos:delete',
  'productos:ajustarStock',

  // Catálogo compartido
  'catalogo:buscarPorCodigo',
  'catalogo:sugerirCategoria',
  'catalogo:agregar',
  'catalogo:listar',
  'catalogo:exportar',
  'catalogo:importar',

  // Catálogos auxiliares
  'categorias:getAll',
  'categorias:create',
  'categorias:delete',
  'proveedores:getAll',
  'proveedores:create',
  'proveedores:delete',

  // Ventas
  'ventas:crear',
  'ventas:getById',
  'ventas:getRecientes',
  'ventas:cancelar',

  // Movimientos
  'movimientos:getByProducto',

  // Sistema
  'system:getHwid',
  'system:checkLicense',
  'system:activateLicense',
  'system:refreshLicense',

  // Config
  'config:get',
  'config:save',

  // Impresora
  'printer:ticket',
  'printer:test',

  // Reportes
  'reportes:cierreCaja',
  'system:downloadUpdate',
  'system:installUpdate',
  'clientes:buscarPorCedula',
  'clientes:getByCedula',
  'clientes:buscar',
  'clientes:registrar',
  'clientes:actualizar',
  'clientes:getAll',
  'bcv:getTasa',
  'clientes:create',
  'clientes:update',
  'clientes:getRecientes',

  // Apertura / Sesión de Caja
  'cajaSesion:getAperturaDelDia',
  'cajaSesion:abrir',

  // Ventas Suspendidas
  'ventasSuspendidas:crear',
  'ventasSuspendidas:listar',
  'ventasSuspendidas:getById',
  'ventasSuspendidas:eliminar',
  'ventasSuspendidas:recuperar',
  'ventasSuspendidas:finalizar',

  // Bitácora de Caja
  'bitacoraCaja:listar',
]);

const EVENTS_WHITELIST = new Set<keyof IPCEvents>([
  'stock:alerta-minimo',
  'db:error',
  'app:version',
  'updater:available',
  'updater:progress',
  'updater:ready',
  'bcv:tasa',
]);

const api: ElectronAPI = {
  invoke<K extends keyof IPCChannels>(
    channel: K,
    ...args: IPCChannels[K]['args']
  ) {
    if (!INVOKE_WHITELIST.has(channel)) {
      return Promise.reject(new Error(`Canal IPC no permitido: "${channel}"`));
    }
    return ipcRenderer.invoke(channel, ...args) as ReturnType<ElectronAPI['invoke']>;
  },

  on<K extends keyof IPCEvents>(
    event: K,
    handler: (payload: IPCEvents[K]) => void
  ): () => void {
    if (!EVENTS_WHITELIST.has(event)) {
      console.warn(`[Preload] Evento no permitido: "${event}"`);
      return () => {};
    }
    const wrapped = (
      _ipcEvent: Electron.IpcRendererEvent,
      payload: IPCEvents[K]
    ) => handler(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },

  appVersion: process.env.npm_package_version ?? '0.0.0',
};

contextBridge.exposeInMainWorld('electronAPI', api);
console.log('[Preload] Context Bridge listo.');