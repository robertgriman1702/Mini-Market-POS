export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
export type EstadoVenta = 'completada' | 'cancelada' | 'pendiente';
export interface Venta {
    id: number;
    total: number;
    descuento: number;
    metodo_pago: MetodoPago;
    estado: EstadoVenta;
    cajero_id: number | null;
    created_at: string;
}
export interface ItemVenta {
    id: number;
    venta_id: number;
    producto_id: number;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
}
export interface NuevaVentaPayload {
    items: Array<{
        producto_id: number;
        cantidad: number;
        precio_unitario: number;
    }>;
    metodo_pago: MetodoPago;
    descuento?: number;
}
export interface VentaConItems extends Venta {
    items: ItemVenta[];
}
//# sourceMappingURL=Venta.d.ts.map