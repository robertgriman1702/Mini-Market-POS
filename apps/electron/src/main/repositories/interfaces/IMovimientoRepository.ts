import type { MovimientoInventario, TipoMovimiento } from '@pos/shared';

// Payload para registrar un movimiento — lo usa solo VentaService e InventarioService
export interface MovimientoInsertPayload {
  producto_id:    number;
  tipo:           TipoMovimiento;
  cantidad:       number;
  stock_anterior: number;
  stock_nuevo:    number;
  motivo?:        string;
  referencia_id?: number;
}

// =============================================================================
// IMovimientoRepository
// Solo inserción y lectura — los movimientos NUNCA se editan ni eliminan.
// =============================================================================

export interface IMovimientoRepository {
  register(payload: MovimientoInsertPayload): MovimientoInventario;
  findByProducto(productoId: number): MovimientoInventario[];
}
