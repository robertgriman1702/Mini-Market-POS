import type Database from 'better-sqlite3';
import type { Producto, ProductoInput, ProductoUpdate } from '@pos/shared';
import type { IProductoRepository } from './interfaces/IProductoRepository';

// =============================================================================
// ProductoRepository — implementación SQLite de IProductoRepository
//
// Responsabilidad única: traducir operaciones de dominio a SQL.
// No tiene lógica de negocio. No sabe qué es un carrito ni una venta.
// =============================================================================

export class ProductoRepository implements IProductoRepository {
  constructor(private readonly db: Database.Database) {}

  // ---------------------------------------------------------------------------
  // Lecturas
  // ---------------------------------------------------------------------------

  findAll(): Producto[] {
    return this.db
      .prepare<[], Producto>(
        'SELECT * FROM productos WHERE activo = 1 ORDER BY nombre ASC'
      )
      .all();
  }

  findById(id: number): Producto | null {
    return (
      this.db
        .prepare<[number], Producto>(
          'SELECT * FROM productos WHERE id = ? AND activo = 1'
        )
        .get(id) ?? null
    );
  }

  findByQR(codigo: string): Producto | null {
    return (
      this.db
        .prepare<[string], Producto>(
          'SELECT * FROM productos WHERE codigo_qr = ? AND activo = 1'
        )
        .get(codigo) ?? null
    );
  }

  search(termino: string): Producto[] {
    const like = `%${termino}%`;
    return this.db
      .prepare<[string, string], Producto>(`
        SELECT * FROM productos
        WHERE activo = 1
          AND (nombre LIKE ? OR codigo_qr LIKE ?)
        ORDER BY nombre ASC
        LIMIT 50
      `)
      .all(like, like);
  }

  findBelowMinStock(): Producto[] {
    return this.db
      .prepare<[], Producto>(
        'SELECT * FROM productos WHERE activo = 1 AND stock <= stock_minimo ORDER BY stock ASC'
      )
      .all();
  }

  // ---------------------------------------------------------------------------
  // Escrituras
  // ---------------------------------------------------------------------------

  create(data: ProductoInput): Producto {
    const result = this.db
      .prepare(`
        INSERT INTO productos
          (nombre, codigo_qr, precio, precio_costo, stock, stock_minimo,
           categoria_id, proveedor_id, unidad_medida, activo)
        VALUES
          (@nombre, @codigo_qr, @precio, @precio_costo, @stock, @stock_minimo,
           @categoria_id, @proveedor_id, @unidad_medida, @activo)
      `)
      .run({
        ...data,
        // better-sqlite3 no convierte boolean → 1/0 con named params
        activo: data.activo ? 1 : 0,
      });

    return this.findById(result.lastInsertRowid as number)!;
  }

  update(data: ProductoUpdate): Producto {
    const { id, ...fields } = data;
    const sets = Object.keys(fields)
      .map((k) => `${k} = @${k}`)
      .join(', ');

    this.db.prepare(`UPDATE productos SET ${sets} WHERE id = @id`).run(data);
    return this.findById(id)!;
  }

  updateStock(id: number, nuevoStock: number): void {
    this.db
      .prepare('UPDATE productos SET stock = ? WHERE id = ?')
      .run(nuevoStock, id);
  }

  delete(id: number): boolean {
    // Soft delete: preserva el historial de ventas
    const result = this.db
      .prepare('UPDATE productos SET activo = 0 WHERE id = ?')
      .run(id);
    return result.changes > 0;
  }
}