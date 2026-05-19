import { handle }              from '../helpers';
import type { CategoriaService } from '../../services/CatalogoService';
import type { ProveedorService }  from '../../services/CatalogoService';

// =============================================================================
// Catálogo Handler — Categorías y Proveedores
// =============================================================================

export function registerCategoriasHandlers(service: CategoriaService): void {
  handle('categorias:getAll',  ()           => service.getAll());
  handle('categorias:create',  (_e, data)   => service.crear(data));
  handle('categorias:delete',  (_e, id)     => service.eliminar(id));
}

export function registerProveedoresHandlers(service: ProveedorService): void {
  handle('proveedores:getAll', ()           => service.getAll());
  handle('proveedores:create', (_e, data)   => service.crear(data));
  handle('proveedores:delete', (_e, id)     => service.eliminar(id));
}
