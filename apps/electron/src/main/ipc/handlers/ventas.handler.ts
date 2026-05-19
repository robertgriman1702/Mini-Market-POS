import { handle }         from '../helpers';
import type { VentaService } from '../../services/VentaService';

// =============================================================================
// Ventas Handler
// =============================================================================

export function registerVentasHandlers(service: VentaService): void {
  handle('ventas:crear',        (_e, payload) => service.crear(payload));
  handle('ventas:getById',      (_e, id)      => service.getById(id));
  handle('ventas:getRecientes', (_e, limite)  => service.getRecientes(limite));
  handle('ventas:cancelar',     (_e, id)      => service.cancelar(id));
}
