import type { Producto, ProductoInput, ProductoUpdate } from '../entities/Producto';
import type { Venta, VentaConItems, NuevaVentaPayload } from '../entities/Venta';
import type { Categoria, CategoriaInput, Proveedor, ProveedorInput, MovimientoInventario } from '../entities/Catalogo';
import type { AppConfig, LicenseStatus, CierreCaja } from '../entities/Config';
export interface IPCChannels {
    'productos:getAll': {
        args: [];
        return: Producto[];
    };
    'productos:getById': {
        args: [id: number];
        return: Producto | null;
    };
    'productos:getByQR': {
        args: [codigo: string];
        return: Producto | null;
    };
    'productos:buscar': {
        args: [termino: string];
        return: Producto[];
    };
    'productos:create': {
        args: [data: ProductoInput];
        return: Producto;
    };
    'productos:update': {
        args: [data: ProductoUpdate];
        return: Producto;
    };
    'productos:delete': {
        args: [id: number];
        return: boolean;
    };
    'productos:ajustarStock': {
        args: [id: number, delta: number, motivo: string];
        return: Producto;
    };
    'categorias:getAll': {
        args: [];
        return: Categoria[];
    };
    'categorias:create': {
        args: [data: CategoriaInput];
        return: Categoria;
    };
    'categorias:delete': {
        args: [id: number];
        return: boolean;
    };
    'proveedores:getAll': {
        args: [];
        return: Proveedor[];
    };
    'proveedores:create': {
        args: [data: ProveedorInput];
        return: Proveedor;
    };
    'proveedores:delete': {
        args: [id: number];
        return: boolean;
    };
    'ventas:crear': {
        args: [payload: NuevaVentaPayload];
        return: VentaConItems;
    };
    'ventas:getById': {
        args: [id: number];
        return: VentaConItems | null;
    };
    'ventas:getRecientes': {
        args: [limite: number];
        return: Venta[];
    };
    'ventas:cancelar': {
        args: [id: number];
        return: boolean;
    };
    'movimientos:getByProducto': {
        args: [productoId: number];
        return: MovimientoInventario[];
    };
    'system:getHwid': {
        args: [];
        return: string;
    };
    'system:checkLicense': {
        args: [];
        return: LicenseStatus;
    };
    'system:activateLicense': {
        args: [key: string];
        return: LicenseStatus;
    };
    'config:get': {
        args: [];
        return: AppConfig;
    };
    'config:save': {
        args: [partial: Partial<AppConfig>];
        return: AppConfig;
    };
    'printer:ticket': {
        args: [ventaId: number];
        return: boolean;
    };
    'printer:test': {
        args: [];
        return: boolean;
    };
    'reportes:cierreCaja': {
        args: [fecha: string];
        return: CierreCaja;
    };
}
//# sourceMappingURL=channels.d.ts.map