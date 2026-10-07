import type { Venta, VentaConItems, ItemVenta } from '@pos/shared';
import type { IBaseRepository } from './IBaseRepository';

// Payload interno que usa el repositorio para insertar la venta y sus items
export interface VentaInsertPayload {
  total:       number;
  descuento:   number;
  metodo_pago: string;
  cajero_id:   number | null;
  cliente_id:  number | null;
  items: Array<{
    producto_id:     number;
    cantidad:        number;
    precio_unitario: number;
  }>;
}

// =============================================================================
// IVentaRepository
// =============================================================================

export interface IVentaRepository
  extends Omit<IBaseRepository<Venta, VentaInsertPayload, never>, 'update'> {

  /** Retorna la venta con sus items incluidos */
  findByIdWithItems(id: number): VentaConItems | null;

  /** Últimas N ventas ordenadas por fecha descendente */
  findRecent(limit: number): Venta[];

  /** Marca una venta como cancelada (soft cancel) */
  cancel(id: number): boolean;

  /** Retorna los items de una venta específica */
  findItems(ventaId: number): ItemVenta[];

  /** Inserta un item de venta asociado a una venta ya creada */
  insertItem(
    ventaId: number,
    item: { producto_id: number; cantidad: number; precio_unitario: number }
  ): void;
}