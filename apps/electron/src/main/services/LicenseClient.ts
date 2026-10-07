import { BrowserWindow } from 'electron';
import { HwidService }   from './HwidService';
import type { OfflineTokenInput } from './OfflineTokenService';

// =============================================================================
// LicenseClient — Cliente HTTP hacia el backend de licencias
//
// Mismo estilo arquitectónico que BcvService: clase de métodos estáticos,
// fetch nativo con AbortController + timeout, fallback silencioso cuando
// no hay conexión (la app debe seguir operando offline), y emisión de un
// evento al Renderer cuando hay novedades relevantes.
//
// Este cliente NO decide el estado efectivo de la licencia ni persiste
// nada en disco — solo habla con el backend y devuelve la respuesta cruda
// (o null si no hubo conexión). La orquestación (combinar esta respuesta
// con el token offline local) es responsabilidad de LicenseService.
//
// BASE_URL es un placeholder hasta que exista un backend real desplegado.
// =============================================================================

const BASE_URL    = 'https://licencias.pos-minimarket.app/api/v1';
const FETCH_TIMEOUT_MS = 8000;

export interface ActivarRequest {
  clave:    string;   // Clave de licencia ingresada por el cliente
  hwid:     string;
  nombre_dispositivo?: string;
}

export interface ActivarResponse {
  ok:                  boolean;
  cliente?:             string;
  expira_at?:           string | null;
  dispositivo_id?:       string;
  expira_offline_at?:    string;
  emitido_at?:           string;
  error?:                string;   // Ej: 'licencia_no_existe', 'limite_dispositivos'
}

export interface ValidarRequest {
  clave:           string;
  hwid:            string;
  dispositivo_id:   string | null;
}

export type EstadoBackend = 'valid' | 'revoked' | 'suspended' | 'expired' | 'invalid';

export interface ValidarResponse {
  ok:                  boolean;
  estado:               EstadoBackend;
  cliente?:             string;
  expira_at?:           string | null;
  expira_offline_at?:    string;
  emitido_at?:           string;
  error?:                string;
}

export interface DispositivoInfo {
  dispositivo_id:  string;
  nombre:           string | null;
  hwid:             string;
  activado_at:      string;
  ultima_conexion:  string | null;
}

let ultimaValidacion: ValidarResponse | null = null;
let timer: NodeJS.Timeout | null = null;

export class LicenseClient {

  // ---------------------------------------------------------------------------
  // Activación
  // ---------------------------------------------------------------------------

  static async activar(clave: string, nombreDispositivo?: string): Promise<ActivarResponse | null> {
    const body: ActivarRequest = {
      clave,
      hwid: HwidService.get(),
      nombre_dispositivo: nombreDispositivo,
    };

    return this.post<ActivarResponse>('/activar', body);
  }

  // ---------------------------------------------------------------------------
  // Validación periódica
  // ---------------------------------------------------------------------------

  static async validar(clave: string, dispositivoId: string | null): Promise<ValidarResponse | null> {
    const body: ValidarRequest = {
      clave,
      hwid: HwidService.get(),
      dispositivo_id: dispositivoId,
    };

    const resp = await this.post<ValidarResponse>('/validar', body);
    if (resp) {
      ultimaValidacion = resp;
      this.emit(resp);
    }
    return resp;
  }

  /** Última respuesta de validación recibida del backend (cache en memoria) */
  static getUltimaValidacion(): ValidarResponse | null {
    return ultimaValidacion;
  }

  // ---------------------------------------------------------------------------
  // Revalidación periódica en segundo plano
  // ---------------------------------------------------------------------------

  static startAutoRevalidate(clave: string, dispositivoId: string | null, intervaloMs = 6 * 60 * 60 * 1000): void {
    this.validar(clave, dispositivoId);
    timer = setInterval(() => {
      this.validar(clave, dispositivoId);
    }, intervaloMs);
  }

  static stopAutoRevalidate(): void {
    if (timer) clearInterval(timer);
  }

  // ---------------------------------------------------------------------------
  // Dispositivos
  // ---------------------------------------------------------------------------

  static async listarDispositivos(clave: string): Promise<DispositivoInfo[] | null> {
    return this.post<DispositivoInfo[]>('/dispositivos/listar', { clave });
  }

  static async revocarDispositivo(clave: string, dispositivoId: string): Promise<boolean> {
    const resp = await this.post<{ ok: boolean }>('/dispositivos/revocar', { clave, dispositivo_id: dispositivoId });
    return resp?.ok ?? false;
  }

  // ---------------------------------------------------------------------------
  // Helper: construye el input para OfflineTokenService a partir de una
  // respuesta exitosa del backend (activación o validación).
  // ---------------------------------------------------------------------------

  static toOfflineTokenInput(
    resp: ActivarResponse | ValidarResponse,
    cliente: string
  ): OfflineTokenInput | null {
    if (!resp.ok || !resp.expira_offline_at || !resp.emitido_at) return null;

    return {
      hwid:               HwidService.get(),
      cliente,
      dispositivo_id:      'dispositivo_id' in resp ? (resp.dispositivo_id ?? null) : null,
      emitido_at:          resp.emitido_at,
      expira_at:           resp.expira_at ?? null,
      expira_offline_at:   resp.expira_offline_at,
    };
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private static async post<T>(endpoint: string, body: unknown): Promise<T | null> {
    try {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const resp = await globalThis.fetch(`${BASE_URL}${endpoint}`, {
        method:  'POST',
        signal:  ctrl.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(body),
      });
      clearTimeout(t);
      if (!resp.ok) {
        console.warn(`[LicenseClient] ${endpoint} respondió ${resp.status}`);
        return null;
      }
      return await resp.json() as T;
    } catch {
      console.warn(`[LicenseClient] Sin conexión al backend (${endpoint}) — operando offline.`);
      return null;
    }
  }

  private static emit(validacion: ValidarResponse): void {
    BrowserWindow.getAllWindows().forEach((w) =>
      w.webContents.send('license:status-changed', {
        estado:    validacion.estado === 'invalid' ? 'invalid' : validacion.estado,
        hwid:      HwidService.get(),
        expira_at: validacion.expira_at ?? null,
        cliente:   validacion.cliente ?? null,
      })
    );
  }
}