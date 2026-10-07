// =============================================================================
// ENTIDAD: Cliente
// Cliente opcional asociado a ventas para facturacion simple e historial.
// =============================================================================

export interface Cliente {
  id:         number;
  cedula:     string;
  nombre:     string;
  apellido:   string;
  telefono:   string | null;
  created_at: string;
  updated_at: string;
}

export type ClienteInput = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;
export type ClienteUpdate = Partial<ClienteInput> & { id: number };
