import { handle }                    from '../helpers';
import type { SharedCatalogService } from '../../services/SharedCatalogService';

// =============================================================================
// Shared Catalog Handler
// =============================================================================

export function registerSharedCatalogHandlers(service: SharedCatalogService): void {
  handle('catalogo:buscarPorCodigo',  (_e, codigo)  => service.buscarPorCodigo(codigo));
  handle('catalogo:sugerirCategoria', (_e, nombre)  => service.sugerirCategoria(nombre));
  handle('catalogo:agregar',          (_e, data)    => service.agregar(data));
  handle('catalogo:listar',           ()            => service.listar());
  handle('catalogo:exportar',         ()            => service.exportar());
  handle('catalogo:importar',         (_e, json)    => service.importar(json));
}