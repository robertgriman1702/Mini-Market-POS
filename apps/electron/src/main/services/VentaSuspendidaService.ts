import type {
  VentaSuspendida,
  VentaSuspendidaInput,
} from '@pos/shared';
import type { IVentaSuspendidaRepository } from '../repositories/interfaces/IVentaSuspendidaRepository';
import type { IBitacoraCajaRepository }    from '../repositories/interfaces/IBitacoraCajaRepository';

// =============================================================================
// VentaSuspendidaService — lógica de negocio de Ventas Suspendidas
//
// Responsabilidad: orquestar la suspensión, recuperación y eliminación de
// ventas en curso. No sabe nada de SQL ni de IPC. Depende de abstracciones.
//
// IMPORTANTE: una venta suspendida es solo un snapshot del carrito. NO
// descuenta stock ni genera movimientos de inventario — eso ocurre
// exclusivamente cuando la venta se confirma de verdad a través de
// VentaService.crear(). Este Service nunca debe tocar IProductoRepository
// ni IMovimientoRepository.
// =============================================================================

export class VentaSuspendidaService {
  constructor(
    private readonly suspendidas: IVentaSuspendidaRepository,
    private readonly bitacora:    IBitacoraCajaRepository
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas (sin efecto secundario)
  // ---------------------------------------------------------------------------

  listar(): VentaSuspendida[] {
    return this.suspendidas.findPendientes();
  }

  getById(id: number): VentaSuspendida {
    const venta = this.suspendidas.findById(id);
    if (!venta) throw new Error(`Venta suspendida con id ${id} no encontrada.`);
    return venta;
  }

  // ---------------------------------------------------------------------------
  // Comandos (con efecto secundario)
  // ---------------------------------------------------------------------------

  suspender(data: VentaSuspendidaInput): VentaSuspendida {
    if (!data.items.length) {
      throw new Error('No se puede suspender una venta sin productos.');
    }

    if (!data.usuario.trim()) {
      throw new Error('El usuario es obligatorio para suspender la venta.');
    }

    const venta = this.suspendidas.create({
      ...data,
      descuento:     data.descuento ?? 0,
      observaciones: data.observaciones?.trim() || null,
      usuario:       data.usuario.trim(),
    });

    this.bitacora.registrar({
      accion:        'venta_suspendida',
      detalles:      `Venta suspendida con ${venta.items.length} item(s)`,
      usuario:       venta.usuario,
      referencia_id: venta.id,
    });

    return venta;
  }

  /** Marca la venta suspendida como recuperada — se llama al continuarla en el POS */
  recuperar(id: number, usuario: string): VentaSuspendida {
    const venta = this.getById(id);

    const actualizado = this.suspendidas.updateEstado(id, 'recuperada');
    if (!actualizado) {
      throw new Error(`No se pudo recuperar la venta suspendida ${id}.`);
    }

    this.bitacora.registrar({
      accion:        'venta_recuperada',
      detalles:      `Venta suspendida #${id} recuperada en el POS`,
      usuario:       usuario.trim() || venta.usuario,
      referencia_id: id,
    });

    return this.getById(id);
  }

  /** Marca la venta suspendida como finalizada — se llama tras confirmar el cobro real */
  finalizar(id: number, usuario: string): boolean {
    this.getById(id); // Valida que exista

    const actualizado = this.suspendidas.updateEstado(id, 'finalizada');
    if (actualizado) {
      this.bitacora.registrar({
        accion:        'venta_realizada',
        detalles:      `Venta suspendida #${id} finalizada tras cobro`,
        usuario:       usuario.trim(),
        referencia_id: id,
      });
    }

    return actualizado;
  }

  eliminar(id: number, usuario: string): boolean {
    const venta = this.getById(id);

    const eliminado = this.suspendidas.updateEstado(id, 'eliminada');
    if (eliminado) {
      this.bitacora.registrar({
        accion:        'venta_eliminada',
        detalles:      `Venta suspendida #${id} eliminada (${venta.items.length} item(s))`,
        usuario:       usuario.trim() || venta.usuario,
        referencia_id: id,
      });
    }

    return eliminado;
  }
}