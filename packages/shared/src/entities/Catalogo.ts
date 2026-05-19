// =============================================================================
// ENTIDADES: Categoria, Proveedor, MovimientoInventario
// =============================================================================

// --- Categoría ---
export interface Categoria {
  id:          number;
  nombre:      string;
  descripcion: string | null;
  created_at:  string;
}

export type CategoriaInput = Omit<Categoria, 'id' | 'created_at'>;

// --- Proveedor ---
export interface Proveedor {
  id:         number;
  nombre:     string;
  contacto:   string | null;
  telefono:   string | null;
  email:      string | null;
  created_at: string;
}

export type ProveedorInput = Omit<Proveedor, 'id' | 'created_at'>;

// --- Movimiento de Inventario ---
// Auditoría completa de cada cambio de stock. Nunca se borra.
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'venta';

export interface MovimientoInventario {
  id:             number;
  producto_id:    number;
  tipo:           TipoMovimiento;
  cantidad:       number;      // Positivo = entrada, negativo = salida
  stock_anterior: number;
  stock_nuevo:    number;
  motivo:         string | null;
  referencia_id:  number | null; // ID de Venta u Orden de Compra
  created_at:     string;
}
