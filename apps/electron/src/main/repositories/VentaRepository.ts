import type Database from 'better-sqlite3';
import type { Venta, VentaConItems, ItemVenta } from '@pos/shared';
import type { IVentaRepository, VentaInsertPayload } from './interfaces/IVentaRepository';

// =============================================================================
// VentaRepository — implementación SQLite de IVentaRepository
// =============================================================================

export class VentaRepository implements IVentaRepository {
  constructor(private readonly db: Database.Database) {}

  findAll(): Venta[] {
    return this.db
      .prepare<[], Venta>('SELECT * FROM ventas ORDER BY created_at DESC')
      .all();
  }

  findById(id: number): Venta | null {
    return (
      this.db
        .prepare<[number], Venta>('SELECT * FROM ventas WHERE id = ?')
        .get(id) ?? null
    );
  }

  findByIdWithItems(id: number): VentaConItems | null {
    const venta = this.findById(id);
    if (!venta) return null;
    return { ...venta, items: this.findItems(id) };
  }

  findRecent(limit: number): Venta[] {
    return this.db
      .prepare<[number], Venta>(
        'SELECT * FROM ventas ORDER BY created_at DESC LIMIT ?'
      )
      .all(limit);
  }

  findItems(ventaId: number): ItemVenta[] {
    return this.db
      .prepare<[number], ItemVenta>(
        'SELECT * FROM items_venta WHERE venta_id = ?'
      )
      .all(ventaId);
  }

  // La creación de una venta incluye sus items — se hace fuera (en VentaService)
  // porque necesita manejar la transacción junto con el stock.
  // Este método solo inserta la cabecera.
  create(data: VentaInsertPayload): Venta {
    const result = this.db
      .prepare(`
        INSERT INTO ventas (total, descuento, metodo_pago, cajero_id)
        VALUES (@total, @descuento, @metodo_pago, @cajero_id)
      `)
      .run({
        total:       data.total,
        descuento:   data.descuento,
        metodo_pago: data.metodo_pago,
        cajero_id:   data.cajero_id,
      });

    return this.findById(result.lastInsertRowid as number)!;
  }

  insertItem(
    ventaId: number,
    item: { producto_id: number; cantidad: number; precio_unitario: number }
  ): void {
    this.db
      .prepare(`
        INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)
      `)
      .run(ventaId, item.producto_id, item.cantidad, item.precio_unitario);
  }

  cancel(id: number): boolean {
    const result = this.db
      .prepare("UPDATE ventas SET estado = 'cancelada' WHERE id = ? AND estado != 'cancelada'")
      .run(id);
    return result.changes > 0;
  }

  // No se permite actualizar ventas directamente — se cancelan y se rehacen
  update(): never {
    throw new Error('Las ventas no se modifican. Use cancel() si corresponde.');
  }

  delete(): never {
    throw new Error('Las ventas no se eliminan. Son registros permanentes.');
  }
}
