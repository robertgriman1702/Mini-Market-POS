import type { BitacoraCajaEntry, BitacoraCajaInput } from '@pos/shared';

// =============================================================================
// IBitacoraCajaRepository
//
// Registro inmutable de auditoría de caja. Mismo principio que
// IMovimientoRepository: solo inserción y lectura — las entradas de
// bitácora NUNCA se editan ni se borran.
// =============================================================================

export interface IBitacoraCajaRepository {
  registrar(payload: BitacoraCajaInput): BitacoraCajaEntry;

  /** Entradas de bitácora correspondientes a una fecha ('YYYY-MM-DD') */
  findByFecha(fecha: string): BitacoraCajaEntry[];
}