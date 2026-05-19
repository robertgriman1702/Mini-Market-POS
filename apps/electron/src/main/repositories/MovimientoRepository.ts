import type Database from 'better-sqlite3';
import type { MovimientoInventario } from '@pos/shared';
import type {
  IMovimientoRepository,
  MovimientoInsertPayload,
} from './interfaces/IMovimientoRepository';

// =============================================================================
// MovimientoRepository — registro inmutable de auditoría
//
// Los movimientos NUNCA se editan ni se borran.
// Son el libro contable del inventario.
// =============================================================================

export class MovimientoRepository implements IMovimientoRepository {
  constructor(private readonly db: Database.Database) {}

  register(payload: MovimientoInsertPayload): MovimientoInventario {
    const result = this.db
      .prepare(`
        INSERT INTO movimientos_inventario
          (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_id)
        VALUES
          (@producto_id, @tipo, @cantidad, @stock_anterior, @stock_nuevo,
           @motivo, @referencia_id)
      `)
      .run({
        producto_id:    payload.producto_id,
        tipo:           payload.tipo,
        cantidad:       payload.cantidad,
        stock_anterior: payload.stock_anterior,
        stock_nuevo:    payload.stock_nuevo,
        motivo:         payload.motivo  ?? null,
        referencia_id:  payload.referencia_id ?? null,
      });

    return this.db
      .prepare<[number], MovimientoInventario>(
        'SELECT * FROM movimientos_inventario WHERE id = ?'
      )
      .get(result.lastInsertRowid as number)!;
  }

  findByProducto(productoId: number): MovimientoInventario[] {
    return this.db
      .prepare<[number], MovimientoInventario>(`
        SELECT * FROM movimientos_inventario
        WHERE producto_id = ?
        ORDER BY created_at DESC
      `)
      .all(productoId);
  }
}
