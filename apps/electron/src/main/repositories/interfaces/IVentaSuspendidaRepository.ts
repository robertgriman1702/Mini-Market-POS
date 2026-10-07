import type {
  VentaSuspendida,
  VentaSuspendidaInput,
  EstadoVentaSuspendida,
} from '@pos/shared';

// =============================================================================
// IVentaSuspendidaRepository
//
// Snapshot del carrito en curso. NO afecta stock ni movimientos de
// inventario — eso ocurre solo cuando la venta real se confirma vía
// IVentaRepository.create(). Aquí solo se persiste y recupera el estado
// intermedio de la venta.
// =============================================================================

export interface IVentaSuspendidaRepository {
  findById(id: number): VentaSuspendida | null;

  /** Lista únicamente las ventas en estado 'suspendida' (pendientes de continuar) */
  findPendientes(): VentaSuspendida[];

  create(data: VentaSuspendidaInput): VentaSuspendida;

  /** Cambia el estado de una venta suspendida (recuperada, finalizada, eliminada) */
  updateEstado(id: number, estado: EstadoVentaSuspendida): boolean;
}