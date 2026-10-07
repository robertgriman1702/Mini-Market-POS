import { handle }                       from '../helpers';
import type { VentaSuspendidaService }  from '../../services/VentaSuspendidaService';

// =============================================================================
// Ventas Suspendidas Handler
//
// No hay tabla de usuarios real en el sistema (login es un PIN único) — los
// comandos del Service que requieren `usuario` para la bitácora reciben un
// identificador por defecto cuando el canal IPC no lo provee explícitamente.
// =============================================================================

const USUARIO_DEFECTO = 'cajero';

export function registerVentasSuspendidasHandlers(service: VentaSuspendidaService): void {
  handle('ventasSuspendidas:crear',     (_e, data) => service.suspender(data));
  handle('ventasSuspendidas:listar',    ()         => service.listar());

  handle('ventasSuspendidas:getById', (_e, id) => {
    try {
      return service.getById(id);
    } catch {
      return null;
    }
  });

  handle('ventasSuspendidas:eliminar', (_e, id) => service.eliminar(id, USUARIO_DEFECTO));

  handle('ventasSuspendidas:recuperar', (_e, id) => service.recuperar(id, USUARIO_DEFECTO));

  handle('ventasSuspendidas:finalizar', (_e, id) => service.finalizar(id, USUARIO_DEFECTO));
}