import { handle }                  from '../helpers';
import type { CajaSesionService }  from '../../services/CajaSesionService';

// =============================================================================
// CajaSesion Handler — Apertura de Caja
// =============================================================================

export function registerCajaSesionHandlers(service: CajaSesionService): void {
  handle('cajaSesion:getAperturaDelDia', (_e, fecha) => service.getAperturaDelDia(fecha));
  handle('cajaSesion:abrir',             (_e, data)  => service.abrir(data));
}