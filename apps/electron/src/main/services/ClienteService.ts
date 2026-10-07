import type { Cliente, ClienteInput, ClienteUpdate } from '@pos/shared';
import type { ClienteRepository } from '../repositories/ClienteRepository';

// =============================================================================
// ClienteService - reglas de negocio para clientes
// =============================================================================

export class ClienteService {
  constructor(private readonly clientes: ClienteRepository) {}

  getAll(): Cliente[] {
    return this.clientes.findAll();
  }

  getRecientes(limite: number): Cliente[] {
    return this.clientes.findRecent(limite);
  }

  buscarPorCedula(cedula: string): Cliente | null {
    const normalizada = this.normalizeCedula(cedula);
    if (!normalizada) return null;
    return this.clientes.findByCedula(normalizada);
  }

  getByCedula(cedula: string): Cliente | null {
    return this.buscarPorCedula(cedula);
  }

  buscar(termino: string): Cliente[] {
    const value = termino.trim();
    if (value.length < 2) return [];
    return this.clientes.search(value);
  }

  registrar(data: ClienteInput): Cliente {
    const input = this.normalizeInput(data);
    const existente = this.clientes.findByCedula(input.cedula);
    if (existente) {
      throw new Error(`Ya existe un cliente con la cedula "${input.cedula}".`);
    }
    return this.clientes.create(input);
  }

  create(data: ClienteInput): Cliente {
    return this.registrar(data);
  }

  actualizar(data: ClienteUpdate): Cliente {
    const actual = this.clientes.findById(data.id);
    if (!actual) throw new Error(`Cliente con id ${data.id} no encontrado.`);

    if (data.cedula) {
      const cedula = this.normalizeCedula(data.cedula);
      const existente = this.clientes.findByCedula(cedula);
      if (existente && existente.id !== data.id) {
        throw new Error(`La cedula "${cedula}" ya esta en uso.`);
      }
      data = { ...data, cedula };
    }

    return this.clientes.update(data);
  }

  update(data: ClienteUpdate): Cliente {
    return this.actualizar(data);
  }

  private normalizeInput(data: ClienteInput): ClienteInput {
    const cedula = this.normalizeCedula(data.cedula);
    const nombre = data.nombre.trim();
    const apellido = data.apellido.trim();

    if (!cedula) throw new Error('La cedula del cliente es obligatoria.');
    if (!nombre) throw new Error('El nombre del cliente es obligatorio.');
    if (!apellido) throw new Error('El apellido del cliente es obligatorio.');

    return {
      cedula,
      nombre,
      apellido,
      telefono: data.telefono?.trim() || null,
    };
  }

  private normalizeCedula(cedula: string): string {
    return cedula.replace(/[^0-9]/g, '');
  }
}
