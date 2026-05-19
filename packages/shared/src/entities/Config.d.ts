export interface FeatureFlags {
  impresora:        boolean;   // Impresora térmica activa
  iva:              boolean;   // Mostrar/calcular IVA
  mostrar_bs:       boolean;   // Mostrar equivalente en Bs junto al precio en $
}
export interface AppConfig {
    local_nombre: string;
    local_rif: string;
    local_direccion: string;
    local_telefono: string;
    moneda: string;
    iva_porcentaje: number;
    impresora_puerto: string;
    impresora_modo: 'generic' | 'fiscal';
    flags: FeatureFlags;
}
export declare const DEFAULT_CONFIG: AppConfig;
export type LicenseEstado = 'valid' | 'invalid' | 'expired' | 'not_found';
export interface LicenseStatus {
    estado: LicenseEstado;
    hwid: string;
    expira_at: string | null;
    cliente: string | null;
}
export interface ResumenMetodoPago {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    mixto: number;
}
export interface CierreCaja {
    fecha: string;
    total_ventas: number;
    cantidad_ventas: number;
    total_items: number;
    por_metodo: ResumenMetodoPago;
    venta_promedio: number;
    hora_pico: string | null;
}
//# sourceMappingURL=Config.d.ts.map