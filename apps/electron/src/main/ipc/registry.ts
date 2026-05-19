import type Database from 'better-sqlite3';

import { ProductoRepository }   from '../repositories/ProductoRepository';
import { VentaRepository }      from '../repositories/VentaRepository';
import { CategoriaRepository,
         ProveedorRepository }  from '../repositories/CatalogoRepository';
import { MovimientoRepository } from '../repositories/MovimientoRepository';

import { ProductoService }                    from '../services/ProductoService';
import { VentaService }                       from '../services/VentaService';
import { CategoriaService, ProveedorService } from '../services/CatalogoService';
import { LicenseService }                     from '../services/LicenseService';
import { ConfigService }                      from '../services/ConfigService';
import { SharedCatalogService }               from '../services/SharedCatalogService';

import { registerProductosHandlers }     from './handlers/productos.handler';
import { registerVentasHandlers }        from './handlers/ventas.handler';
import { registerCategoriasHandlers,
         registerProveedoresHandlers }   from './handlers/catalogo.handler';
import { registerMovimientosHandlers }   from './handlers/movimientos.handler';
import { registerSystemHandlers }        from './handlers/system.handler';
import { registerSharedCatalogHandlers } from './handlers/shared-catalog.handler';

export function registerAllHandlers(db: Database.Database): void {
  const productoRepo   = new ProductoRepository(db);
  const ventaRepo      = new VentaRepository(db);
  const categoriaRepo  = new CategoriaRepository(db);
  const proveedorRepo  = new ProveedorRepository(db);
  const movimientoRepo = new MovimientoRepository(db);

  const productoService  = new ProductoService(productoRepo, movimientoRepo);
  const ventaService     = new VentaService(db, ventaRepo, productoRepo, movimientoRepo);
  const categoriaService = new CategoriaService(categoriaRepo);
  const proveedorService = new ProveedorService(proveedorRepo);

  const licenseService   = new LicenseService();
  const configService    = new ConfigService();
  const sharedCatalogSvc = new SharedCatalogService(db);
  sharedCatalogSvc.ensureTable();

  registerProductosHandlers(productoService);
  registerVentasHandlers(ventaService);
  registerCategoriasHandlers(categoriaService);
  registerProveedoresHandlers(proveedorService);
  registerMovimientosHandlers(movimientoRepo);
  registerSystemHandlers(db, ventaRepo, configService, licenseService);
  registerSharedCatalogHandlers(sharedCatalogSvc);

  console.log('[IPC] Todos los handlers registrados.');
}