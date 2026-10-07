// =============================================================================
// ENTIDADES: Apertura de Caja, Venta Suspendida, Bitácora de Caja
//
// Estas entidades soportan el flujo de Caja (Apertura → Venta/Suspensión →
// Cierre). No reemplazan a `Venta`: una venta suspendida NO descuenta stock
// ni genera movimientos de inventario hasta que se finaliza el cobro real
// a través de `ventas:crear`. La bitácora es un registro inmutable, igual
// que `MovimientoInventario` — nunca se edita ni se borra.
// =============================================================================

// --- Apertura de Caja ---
// Una apertura por día (por instancia local). Bloquea el acceso al POS
// hasta que exista una apertura vigente para la fecha actual.
export interface AperturaCaja {
  id:             number;
  fondo_inicial:  number;        // Centavos
  observaciones:  string | null;
  usuario:        string;        // No hay tabla de usuarios; identificador simple (ej. username de login)
  fecha:          string;        // 'YYYY-MM-DD' — fecha de la jornada de caja
  created_at:     string;
}

export type AperturaCajaInput = Omit<AperturaCaja, 'id' | 'created_at'>;

// --- Venta Suspendida ---
// Snapshot completo del carrito en curso. Persiste aunque la app se cierre.
// Los items se guardan serializados (no son `items_venta` reales) porque
// la venta aún no existe como transacción confirmada.
export interface ItemVentaSuspendida {
  producto_id:     number;
  cantidad:        number;
  precio_unitario: number;       // Snapshot del precio al momento de suspender
}

export type EstadoVentaSuspendida = 'suspendida' | 'recuperada' | 'finalizada' | 'eliminada';

export interface VentaSuspendida {
  id:             number;
  cliente_id:     number | null;
  items:          ItemVentaSuspendida[];
  descuento:      number;        // Centavos
  observaciones:  string | null;
  estado:         EstadoVentaSuspendida;
  usuario:        string;
  created_at:     string;
  updated_at:     string;
}

// Payload que llega desde el Renderer al suspender una venta
export interface VentaSuspendidaInput {
  cliente_id:     number | null;
  items:          ItemVentaSuspendida[];
  descuento?:     number;
  observaciones?: string | null;
  usuario:        string;
}

// --- Bitácora de Caja ---
// Historial inmutable de toda acción relevante de la sesión de caja.
export type TipoAccionBitacora =
  | 'apertura'
  | 'cierre'
  | 'venta_realizada'
  | 'venta_suspendida'
  | 'venta_recuperada'
  | 'venta_eliminada'
  | 'venta_anulada'
  | 'diferencia_caja';

export interface BitacoraCajaEntry {
  id:             number;
  accion:         TipoAccionBitacora;
  detalles:       string | null;   // Texto libre o JSON serializado con contexto adicional
  usuario:        string;
  referencia_id:  number | null;   // ID de Venta, VentaSuspendida o AperturaCaja según corresponda
  created_at:     string;
}

// Payload interno para registrar una entrada de bitácora
export type BitacoraCajaInput = Omit<BitacoraCajaEntry, 'id' | 'created_at'>;

// --- Control de Efectivo (Cierre) ---
// Usado al cerrar la caja para calcular sobrante/faltante.
export interface ControlEfectivo {
  efectivo_esperado: number;     // Fondo inicial + ventas en efectivo del día
  efectivo_contado:  number;     // Ingresado manualmente por el usuario al cerrar
  diferencia:        number;     // contado - esperado
  sobrante:          number;     // max(0, diferencia)
  faltante:          number;     // max(0, -diferencia)
}