export type { Producto, ProductoInput, ProductoUpdate, UnidadMedida } from './entities/Producto';
export type { Venta, ItemVenta, NuevaVentaPayload, VentaConItems,
              MetodoPago, EstadoVenta }                               from './entities/Venta';
export type { Categoria, CategoriaInput,
              Proveedor, ProveedorInput,
              MovimientoInventario, TipoMovimiento }                  from './entities/Catalogo';
export type { AppConfig, FeatureFlags, LicenseStatus, LicenseEstado,
              CierreCaja, ResumenMetodoPago }                            from './entities/Config';
export { DEFAULT_CONFIG }                                             from './entities/Config';
export type { ProductoLookupResult, LookupFuente }                    from './entities/Lookup';
export type { CatalogoProducto, CatalogoProductoInput }               from './entities/CatalogoProducto';
export type { Cliente, ClienteInput, ClienteUpdate }                  from './entities/Cliente';
export type { AperturaCaja, AperturaCajaInput,
              BitacoraCajaEntry, BitacoraCajaInput,
              ControlEfectivo,
              EstadoVentaSuspendida, ItemVentaSuspendida,
              TipoAccionBitacora,
              VentaSuspendida, VentaSuspendidaInput }                 from './entities/CajaSesion';

export type { IPCChannels }  from './ipc/channels';
export type { IPCEvents }    from './ipc/events';
export type { ApiResponse }  from './api/response';
export { ok, fail }          from './api/response';
export type { ElectronAPI }  from './electron-api';
