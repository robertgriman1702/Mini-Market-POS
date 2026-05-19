// =============================================================================
// ENTIDAD: Venta e Items de Venta
// Una venta es una transacción completa de caja. Tiene uno o más items.
// Los items capturan un snapshot del precio al momento de la venta para
// que los reportes históricos sean precisos aunque el precio cambie después.
// =============================================================================

export type MetodoPago  = 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
export type EstadoVenta = 'completada' | 'cancelada' | 'pendiente';

export interface Venta {
  id:          number;
  total:       number;       // Total en centavos (ya descontado el descuento)
  descuento:   number;       // Descuento aplicado en centavos
  metodo_pago: MetodoPago;
  estado:      EstadoVenta;
  cajero_id:   number | null;
  created_at:  string;
}

export interface ItemVenta {
  id:              number;
  venta_id:        number;
  producto_id:     number;
  cantidad:        number;
  precio_unitario: number;   // Snapshot del precio al momento de la venta
  subtotal:        number;   // Calculado: cantidad × precio_unitario
}

// Payload que llega desde el Renderer para crear una venta
export interface NuevaVentaPayload {
  items: Array<{
    producto_id:     number;
    cantidad:        number;
    precio_unitario: number;
  }>;
  metodo_pago: MetodoPago;
  descuento?:  number;
}

// Resultado enriquecido que se retorna al Renderer
export interface VentaConItems extends Venta {
  items: ItemVenta[];
}
