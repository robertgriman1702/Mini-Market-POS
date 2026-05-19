import type { Producto, ProductoInput, ProductoUpdate }        from '../entities/Producto';
import type { Venta, VentaConItems, NuevaVentaPayload }        from '../entities/Venta';
import type { Categoria, CategoriaInput,
              Proveedor, ProveedorInput,
              MovimientoInventario }                           from '../entities/Catalogo';
import type { AppConfig, LicenseStatus, CierreCaja }          from '../entities/Config';
import type { CatalogoProducto, CatalogoProductoInput }        from '../entities/CatalogoProducto';

export interface IPCChannels {
  // Productos
  'productos:getAll':          { args: [];                                           return: Producto[] };
  'productos:getById':         { args: [id: number];                                 return: Producto | null };
  'productos:getByQR':         { args: [codigo: string];                             return: Producto | null };
  'productos:buscar':          { args: [termino: string];                            return: Producto[] };
  'productos:create':          { args: [data: ProductoInput];                        return: Producto };
  'productos:update':          { args: [data: ProductoUpdate];                       return: Producto };
  'productos:delete':          { args: [id: number];                                 return: boolean };
  'productos:ajustarStock':    { args: [id: number, delta: number, motivo: string];  return: Producto };

  // Catálogo compartido
  'catalogo:buscarPorCodigo':  { args: [codigo: string];                             return: CatalogoProducto | null };
  'catalogo:sugerirCategoria': { args: [nombre: string];                             return: string | null };
  'catalogo:agregar':          { args: [data: CatalogoProductoInput];                return: boolean };
  'catalogo:listar':           { args: [];                                            return: CatalogoProducto[] };
  'catalogo:exportar':         { args: [];                                            return: string };
  'catalogo:importar':         { args: [json: string];                               return: number };

  // Categorías
  'categorias:getAll':         { args: [];                                            return: Categoria[] };
  'categorias:create':         { args: [data: CategoriaInput];                        return: Categoria };
  'categorias:delete':         { args: [id: number];                                  return: boolean };

  // Proveedores
  'proveedores:getAll':        { args: [];                                            return: Proveedor[] };
  'proveedores:create':        { args: [data: ProveedorInput];                        return: Proveedor };
  'proveedores:delete':        { args: [id: number];                                  return: boolean };

  // Ventas
  'ventas:crear':              { args: [payload: NuevaVentaPayload];                  return: VentaConItems };
  'ventas:getById':            { args: [id: number];                                  return: VentaConItems | null };
  'ventas:getRecientes':       { args: [limite: number];                              return: Venta[] };
  'ventas:cancelar':           { args: [id: number];                                  return: boolean };

  // Movimientos
  'movimientos:getByProducto': { args: [productoId: number];                         return: MovimientoInventario[] };

  // Sistema / Licencia
  'system:checkLicense':       { args: [];                                            return: LicenseStatus };
  'system:getHwid':            { args: [];                                            return: string };
  'system:activateLicense':    { args: [key: string];                                 return: LicenseStatus };
  'system:downloadUpdate':     { args: [];                                            return: boolean };
  'system:installUpdate':      { args: [];                                            return: void };

  // Configuración
  'config:get':                { args: [];                                            return: AppConfig };
  'config:save':               { args: [config: Partial<AppConfig>];                  return: AppConfig };

  // Impresora
  'printer:ticket':            { args: [ventaId: number];                             return: boolean };
  'printer:test':              { args: [];                                             return: boolean };

  // Reportes
  'reportes:cierreCaja':       { args: [fecha: string];                               return: CierreCaja };

  // BCV
  'bcv:getTasa':               { args: [];                                            return: { tasa: number; actualizadoEl: string } | null };
}