import { handle }                       from '../helpers';
import type { IBitacoraCajaRepository } from '../../repositories/interfaces/IBitacoraCajaRepository';

// =============================================================================
// Bitácora de Caja Handler
// La bitácora es solo lectura desde el renderer.
// La escritura (registrar) la hacen CajaSesionService y VentaSuspendidaService
// internamente, como parte de las operaciones de Caja.
// =============================================================================

export function registerBitacoraCajaHandlers(repo: IBitacoraCajaRepository): void {
  handle('bitacoraCaja:listar', (_e, fecha) => repo.findByFecha(fecha));
}