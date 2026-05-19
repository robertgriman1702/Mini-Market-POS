import type { Producto, ProductoInput, ProductoUpdate } from '@pos/shared';
import type { IBaseRepository } from './IBaseRepository';

// =============================================================================
// IProductoRepository
//
// Extiende IBaseRepository con operaciones específicas del dominio de productos.
// Los servicios reciben esta interfaz, nunca la implementación SQLite.
// =============================================================================

export interface IProductoRepository
  extends IBaseRepository<Producto, ProductoInput, ProductoUpdate> {

  /** Búsqueda por código QR/barras (para el lector físico) */
  findByQR(codigo: string): Producto | null;

  /** Búsqueda de texto libre por nombre o código */
  search(termino: string): Producto[];

  /** Actualiza solo el campo stock — operación frecuente, separada para claridad */
  updateStock(id: number, nuevoStock: number): void;

  /** Retorna todos los productos con stock por debajo del mínimo configurado */
  findBelowMinStock(): Producto[];
}
