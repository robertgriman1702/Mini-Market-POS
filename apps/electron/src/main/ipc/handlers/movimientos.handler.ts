import { handle }                from '../helpers';
import type { IMovimientoRepository } from '../../repositories/interfaces/IMovimientoRepository';

// =============================================================================
// Movimientos Handler
// Los movimientos son solo lectura desde el renderer.
// La escritura la hacen ProductoService y VentaService internamente.
// =============================================================================

export function registerMovimientosHandlers(repo: IMovimientoRepository): void {
  handle('movimientos:getByProducto', (_e, productoId) =>
    repo.findByProducto(productoId)
  );
}
