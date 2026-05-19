import type { Categoria, CategoriaInput, Proveedor, ProveedorInput } from '@pos/shared';
import type { ICategoriaRepository } from '../repositories/interfaces/ICatalogoRepository';
import type { IProveedorRepository }  from '../repositories/interfaces/ICatalogoRepository';

// =============================================================================
// CategoriaService
// =============================================================================

export class CategoriaService {
  constructor(private readonly categorias: ICategoriaRepository) {}

  getAll(): Categoria[] {
    return this.categorias.findAll();
  }

  crear(data: CategoriaInput): Categoria {
    const existente = this.categorias.findByNombre(data.nombre);
    if (existente) {
      throw new Error(`Ya existe una categoría llamada "${data.nombre}".`);
    }
    return this.categorias.create(data);
  }

  eliminar(id: number): boolean {
    const existente = this.categorias.findById(id);
    if (!existente) throw new Error(`Categoría con id ${id} no encontrada.`);
    return this.categorias.delete(id);
  }
}

// =============================================================================
// ProveedorService
// =============================================================================

export class ProveedorService {
  constructor(private readonly proveedores: IProveedorRepository) {}

  getAll(): Proveedor[] {
    return this.proveedores.findAll();
  }

  crear(data: ProveedorInput): Proveedor {
    if (data.email) {
      const existente = this.proveedores.findByEmail(data.email);
      if (existente) {
        throw new Error(`Ya existe un proveedor con el email "${data.email}".`);
      }
    }
    return this.proveedores.create(data);
  }

  eliminar(id: number): boolean {
    const existente = this.proveedores.findById(id);
    if (!existente) throw new Error(`Proveedor con id ${id} no encontrado.`);
    return this.proveedores.delete(id);
  }
}
