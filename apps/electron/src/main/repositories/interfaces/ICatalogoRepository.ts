import type { Categoria, CategoriaInput,
              Proveedor,  ProveedorInput } from '@pos/shared';
import type { IBaseRepository } from './IBaseRepository';

// =============================================================================
// ICategoriaRepository
// =============================================================================

export interface ICategoriaRepository
  extends IBaseRepository<Categoria, CategoriaInput, Partial<CategoriaInput> & { id: number }> {
  findByNombre(nombre: string): Categoria | null;
}

// =============================================================================
// IProveedorRepository
// =============================================================================

export interface IProveedorRepository
  extends IBaseRepository<Proveedor, ProveedorInput, Partial<ProveedorInput> & { id: number }> {
  findByEmail(email: string): Proveedor | null;
}
