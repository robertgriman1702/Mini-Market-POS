// =============================================================================
// ENTIDAD: Producto
// Un producto es cualquier artículo que el negocio vende o gestiona.
// Los precios se almacenan en centavos (enteros) para evitar errores de
// punto flotante en sumas del carrito.
//   Ejemplo: precio = 1250 → $12.50
// =============================================================================

export type UnidadMedida =
  | 'unidad'
  | 'kg'
  | 'gramo'
  | 'litro'
  | 'ml'
  | 'caja'
  | 'paquete';

export interface Producto {
  id:            number;
  nombre:        string;
  codigo_qr:     string;       // Código de barras / QR único
  precio:        number;       // Precio de venta en centavos
  precio_costo:  number;       // Precio de costo en centavos
  stock:         number;       // Unidades disponibles
  stock_minimo:  number;       // Umbral para alerta de reposición
  categoria_id:  number | null;
  proveedor_id:  number | null;
  unidad_medida: UnidadMedida;
  activo:        boolean;
  created_at:    string;       // ISO 8601
  updated_at:    string;       // ISO 8601
}

// Tipos derivados para operaciones CRUD
export type ProductoInput  = Omit<Producto, 'id' | 'created_at' | 'updated_at'>;
export type ProductoUpdate = Partial<ProductoInput> & { id: number };
