// =============================================================================
// CatalogoProducto — Entrada del catálogo compartido
// Contiene info universal del producto (nombre, marca, categoría)
// SIN datos de negocio (precio, stock) — eso vive en pos.db
// =============================================================================

export interface CatalogoProducto {
  id:            number;
  codigo:        string;          // EAN-13 / UPC-A / código de barras
  nombre:        string;
  marca:         string | null;
  categoria:     string | null;
  cantidad:      string | null;   // "600 ml", "150 g", etc.
  unidad_medida: string;          // 'unidad' | 'kg' | 'litro' | etc.
  created_at:    string;
}

export type CatalogoProductoInput = Omit<CatalogoProducto, 'id' | 'created_at'>;