// =============================================================================
// ENTIDAD: Configuración del sistema
// =============================================================================

export interface FeatureFlags {
  impresora:        boolean;   // Impresora térmica activa
  iva:              boolean;   // Mostrar/calcular IVA
  mostrar_bs:       boolean;   // Mostrar equivalente en Bs junto al precio en $
}

export interface AppConfig {
  local_nombre:      string;
  local_rif:         string;
  local_direccion:   string;
  local_telefono:    string;
  moneda:            string;        // 'Bs', '$', etc.
  iva_porcentaje:    number;        // 16 = 16%
  impresora_puerto:  string;        // 'USB' | 'COM3' | etc.
  impresora_modo:    'generic' | 'fiscal';
  flags:             FeatureFlags;
  pin:               string;        // SHA-256 del PIN de acceso
}

export const DEFAULT_CONFIG: AppConfig = {
  local_nombre:     'Mi MiniMarket',
  local_rif:        'J-00000000-0',
  local_direccion:  '',
  local_telefono:   '',
  moneda:           '$',
  iva_porcentaje:   16,
  impresora_puerto: 'USB',
  impresora_modo:   'generic',
  // SHA-256 de "admin"
  pin:              '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  flags: {
    impresora:        false,
    iva:              true,
    mostrar_bs:       true,
  },
};

// =============================================================================
// ENTIDAD: Licencia / HWID
// =============================================================================

export type LicenseEstado = 'valid' | 'invalid' | 'expired' | 'not_found';

export interface LicenseStatus {
  estado:     LicenseEstado;
  hwid:       string;
  expira_at:  string | null;   // ISO 8601 o null si es permanente
  cliente:    string | null;
}

// =============================================================================
// ENTIDAD: Cierre de Caja
// =============================================================================

export interface ResumenMetodoPago {
  efectivo:      number;
  tarjeta:       number;
  transferencia: number;
  mixto:         number;
}

export interface CierreCaja {
  fecha:               string;
  total_ventas:        number;   // Suma de todos los totales en centavos
  cantidad_ventas:     number;   // Número de transacciones
  total_items:         number;   // Unidades vendidas
  por_metodo:          ResumenMetodoPago;
  venta_promedio:      number;
  hora_pico:           string | null;  // '14:00' la hora con más ventas
}