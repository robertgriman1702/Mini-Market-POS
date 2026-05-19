import { handle }          from '../helpers';
import type { ProductoService } from '../../services/ProductoService';

// =============================================================================
// Productos Handler
//
// Responsabilidad única: recibir mensajes IPC y delegarlos al servicio.
// Sin lógica de negocio. Sin SQL. Solo traducir args → service → return.
// =============================================================================

export function registerProductosHandlers(service: ProductoService): void {
  handle('productos:getAll',       ()               => service.getAll());
  handle('productos:getById',      (_e, id)         => service.getById(id));
  handle('productos:getByQR',      (_e, codigo)     => service.getByQR(codigo));
  handle('productos:buscar',       (_e, termino)    => service.buscar(termino));
  handle('productos:create',       (_e, data)       => service.crear(data));
  handle('productos:update',       (_e, data)       => service.actualizar(data));
  handle('productos:delete',       (_e, id)         => service.eliminar(id));
  handle('productos:ajustarStock', (_e, id, delta, motivo) =>
    service.ajustarStock(id, delta, motivo)
  );
}
