import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { HwidService }        from './HwidService';
import type { LicenseStatus } from '@pos/shared';

// =============================================================================
// OfflineTokenService — Token offline firmado para tolerancia sin internet
//
// Responsabilidad aislada: persistir, leer, verificar firma/expiración y
// calcular el estado efectivo de un token offline emitido por el backend
// de licencias. No orquesta activación ni revalidación contra el backend
// (eso es responsabilidad de LicenseService) — este servicio solo sabe
// trabajar con el token que ya tiene en disco.
//
// Formato del archivo offline.token (en userData):
//   BASE64( JSON({ hwid, cliente, dispositivo_id, emitido_at, expira_at,
//                  expira_offline_at, signature }) )
//
// Mismo esquema de firma que LicenseService (HMAC-SHA256 + comparación
// timing-safe), pero el SECRET de este token está pensado para ser el
// secret del backend, no uno embebido en el binario cliente — en este
// archivo se mantiene una constante local solo como placeholder hasta
// que LicenseClient.ts conecte con el backend real.
//
// Diferencia clave respecto a expira_at de LicenseService:
//   - expira_at         : vigencia real de la licencia (la decide el backend)
//   - expira_offline_at : hasta cuándo este token sigue siendo válido SIN
//                          poder contactar al backend (ventana de gracia offline)
// =============================================================================

const SECRET = 'pos-minimarket-offline-token-secret-2024';

const GRACE_PERIOD_DIAS = 3;       // Ventana de tolerancia tras expirar el token offline
const TOKEN_FILENAME    = 'offline.token';

export interface OfflineTokenPayload {
  hwid:               string;
  cliente:            string;
  dispositivo_id:      string | null;  // Identificador de activación devuelto por el backend
  emitido_at:          string;          // ISO 8601 — momento en que el backend firmó el token
  expira_at:           string | null;   // ISO 8601 o null (licencia permanente)
  expira_offline_at:   string;          // ISO 8601 — límite de uso sin contacto con el backend
  signature:           string;
}

export type OfflineTokenInput = Omit<OfflineTokenPayload, 'signature'>;

export class OfflineTokenService {
  private readonly tokenPath: string;

  constructor() {
    this.tokenPath = path.join(app.getPath('userData'), TOKEN_FILENAME);
  }

  // ---------------------------------------------------------------------------
  // Guardar token offline
  // ---------------------------------------------------------------------------

  /**
   * Firma y persiste un nuevo token offline. El payload de entrada llega
   * sin firma (normalmente ya emitido y validado por el backend); este
   * método se encarga de firmarlo localmente para detectar manipulación
   * posterior del archivo en disco.
   */
  guardar(data: OfflineTokenInput): void {
    const signature = this.sign(data);
    const payload: OfflineTokenPayload = { ...data, signature };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    fs.writeFileSync(this.tokenPath, encoded, 'utf8');
  }

  /** Elimina el token offline local (por ejemplo, al desactivar la licencia) */
  eliminar(): void {
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
  }

  // ---------------------------------------------------------------------------
  // Leer token offline
  // ---------------------------------------------------------------------------

  existe(): boolean {
    return fs.existsSync(this.tokenPath);
  }

  /** Lee y deserializa el token sin verificar firma ni expiración */
  leer(): OfflineTokenPayload | null {
    if (!this.existe()) return null;
    try {
      const raw     = fs.readFileSync(this.tokenPath, 'utf8').trim();
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      return JSON.parse(decoded) as OfflineTokenPayload;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Verificar firma
  // ---------------------------------------------------------------------------

  /** Verifica que la firma del payload corresponda a su contenido (no manipulado) */
  verificarFirma(payload: OfflineTokenPayload): boolean {
    try {
      const { signature, ...resto } = payload;
      const expectedSig = this.sign(resto);
      return crypto.timingSafeEqual(
        Buffer.from(signature,   'hex'),
        Buffer.from(expectedSig, 'hex')
      );
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Verificar expiración
  // ---------------------------------------------------------------------------

  /** La licencia en sí ya expiró de forma definitiva (campo expira_at) */
  estaExpirada(payload: OfflineTokenPayload): boolean {
    return payload.expira_at !== null && new Date(payload.expira_at) < new Date();
  }

  /** El token offline superó su ventana de uso sin contacto con el backend */
  estaFueraDeVentanaOffline(payload: OfflineTokenPayload): boolean {
    return new Date(payload.expira_offline_at) < new Date();
  }

  /**
   * El token está fuera de la ventana offline pero todavía dentro del
   * período de gracia adicional (GRACE_PERIOD_DIAS) antes de bloquear.
   */
  estaEnPeriodoDeGracia(payload: OfflineTokenPayload): boolean {
    if (!this.estaFueraDeVentanaOffline(payload)) return false;
    const limiteGracia = new Date(payload.expira_offline_at);
    limiteGracia.setDate(limiteGracia.getDate() + GRACE_PERIOD_DIAS);
    return new Date() <= limiteGracia;
  }

  // ---------------------------------------------------------------------------
  // Obtener estado efectivo
  // ---------------------------------------------------------------------------

  /**
   * Calcula el LicenseStatus efectivo combinando: existencia del token,
   * coincidencia de HWID, firma, expiración definitiva y ventana offline.
   *
   * Nota: este método NO puede determinar 'revoked' ni 'suspended' por sí
   * mismo — esos estados solo los conoce el backend en el momento de una
   * revalidación exitosa. Aquí se evalúa únicamente la validez local del
   * token ya emitido.
   */
  obtenerEstadoEfectivo(): LicenseStatus {
    const hwid = HwidService.get();

    const payload = this.leer();
    if (!payload) {
      return { estado: 'not_found', hwid, expira_at: null, cliente: null };
    }

    // 1. HWID debe coincidir con la máquina actual
    if (payload.hwid !== hwid) {
      return { estado: 'invalid', hwid, expira_at: null, cliente: null };
    }

    // 2. Firma debe ser válida (detecta manipulación del archivo)
    if (!this.verificarFirma(payload)) {
      return { estado: 'invalid', hwid, expira_at: null, cliente: null };
    }

    // 3. Expiración definitiva de la licencia
    if (this.estaExpirada(payload)) {
      return { estado: 'expired', hwid, expira_at: payload.expira_at, cliente: payload.cliente };
    }

    // 4. Ventana offline vigente → válido sin necesidad de contactar al backend
    if (!this.estaFueraDeVentanaOffline(payload)) {
      return { estado: 'valid', hwid, expira_at: payload.expira_at, cliente: payload.cliente };
    }

    // 5. Fuera de la ventana offline pero dentro del período de gracia
    if (this.estaEnPeriodoDeGracia(payload)) {
      return { estado: 'grace_period', hwid, expira_at: payload.expira_at, cliente: payload.cliente };
    }

    // 6. Fuera de ventana offline y fuera de gracia → tratar como expirado
    return { estado: 'expired', hwid, expira_at: payload.expira_at, cliente: payload.cliente };
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  private sign(data: OfflineTokenInput): string {
    return crypto
      .createHmac('sha256', SECRET)
      .update(
        `${data.hwid}|${data.cliente}|${data.dispositivo_id ?? 'none'}|` +
        `${data.emitido_at}|${data.expira_at ?? 'permanent'}|${data.expira_offline_at}`
      )
      .digest('hex');
  }
}