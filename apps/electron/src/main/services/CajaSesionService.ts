import type { AperturaCaja, AperturaCajaInput } from '@pos/shared';
import type { IAperturaCajaRepository } from '../repositories/interfaces/IAperturaCajaRepository';
import type { IBitacoraCajaRepository } from '../repositories/interfaces/IBitacoraCajaRepository';

// =============================================================================
// CajaSesionService — lógica de negocio de la sesión de Caja
//
// Responsabilidad: decidir si existe una apertura vigente para la jornada
// actual y registrar nuevas aperturas. No sabe nada de SQL ni de IPC.
// Depende de abstracciones (Dependency Inversion).
//
// Una apertura por jornada. Mientras no exista una apertura vigente para
// la fecha, el Renderer no debe permitir entrar al POS, crear ventas
// ni cobrar — esa restricción se aplica del lado del Renderer consultando
// `getAperturaDelDia`, este Service solo expone el dato y la operación.
// =============================================================================

export class CajaSesionService {
  constructor(
    private readonly aperturas: IAperturaCajaRepository,
    private readonly bitacora:  IBitacoraCajaRepository
  ) {}

  // ---------------------------------------------------------------------------
  // Consultas (sin efecto secundario)
  // ---------------------------------------------------------------------------

  getAperturaDelDia(fecha: string): AperturaCaja | null {
    const normalizada = this.normalizeFecha(fecha);
    return this.aperturas.findByFecha(normalizada);
  }

  // ---------------------------------------------------------------------------
  // Comandos (con efecto secundario)
  // ---------------------------------------------------------------------------

  abrir(data: AperturaCajaInput): AperturaCaja {
    const fecha = this.normalizeFecha(data.fecha);

    // Regla de negocio: no se puede abrir dos veces la misma jornada
    const existente = this.aperturas.findByFecha(fecha);
    if (existente) {
      throw new Error(`La caja ya fue abierta para la fecha ${fecha}.`);
    }

    if (data.fondo_inicial < 0) {
      throw new Error('El fondo inicial no puede ser negativo.');
    }

    if (!data.usuario.trim()) {
      throw new Error('El usuario es obligatorio para registrar la apertura.');
    }

    const apertura = this.aperturas.create({
      ...data,
      fecha,
      observaciones: data.observaciones?.trim() || null,
      usuario:       data.usuario.trim(),
    });

    this.bitacora.registrar({
      accion:        'apertura',
      detalles:      `Apertura de caja — fondo inicial: ${apertura.fondo_inicial}`,
      usuario:       apertura.usuario,
      referencia_id: apertura.id,
    });

    return apertura;
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private normalizeFecha(fecha: string): string {
    // Se espera 'YYYY-MM-DD' — se toma solo la porción de fecha si llega
    // con hora/timezone para mantener una clave de jornada consistente.
    return fecha.slice(0, 10);
  }
}