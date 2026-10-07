import type { AperturaCaja, AperturaCajaInput } from '@pos/shared';

// =============================================================================
// IAperturaCajaRepository
//
// Una apertura por jornada. Solo inserción y lectura — una apertura no se
// edita ni se elimina una vez registrada.
// =============================================================================

export interface IAperturaCajaRepository {
  findByFecha(fecha: string): AperturaCaja | null;
  create(data: AperturaCajaInput): AperturaCaja;
}