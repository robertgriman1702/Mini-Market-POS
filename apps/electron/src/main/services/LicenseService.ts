import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { HwidService }        from './HwidService';
import { OfflineTokenService } from './OfflineTokenService';
import { LicenseClient }       from './LicenseClient';
import type { LicenseStatus, LicenseEstado } from '@pos/shared';

// =============================================================================
// LicenseService — Validación de licencia basada en HWID
//
// Formato del archivo license.key (en userData) — SIN CAMBIOS:
//   BASE64( JSON({ hwid, cliente, expira_at, signature }) )
//
// La firma se genera con HMAC-SHA256 usando un secret embebido en el binario.
// Para activar: el distribuidor genera el .key con la herramienta de licencias
// y el cliente lo coloca en la carpeta de datos de la app, o lo activa desde
// Configuración (system:activateLicense).
//
// En producción reemplazar SECRET por un valor largo y aleatorio.
//
// -----------------------------------------------------------------------------
// INTEGRACIÓN CON BACKEND (online-first, offline-tolerant)
// -----------------------------------------------------------------------------
// El contenido del archivo license.key se sigue usando como hoy (lectura/
// verificación 100% local, sin cambios), pero además sirve como "clave de
// licencia" que se envía a LicenseClient para validar contra el backend.
//
// Orden de resolución de check():
//   1. Modo desarrollo → bypass (sin cambios respecto al comportamiento actual).
//   2. Si no existe license.key → 'not_found' (sin cambios).
//   3. Verificación local del archivo (HWID + firma + expiración) — si esto
//      ya falla, no tiene sentido seguir; se devuelve 'invalid'/'expired' tal
//      como hoy, sin tocar red.
//   4. Con el archivo localmente válido, se intenta validar contra el backend
//      (LicenseClient.validar). Si el backend responde:
//        - Se persiste un nuevo token offline (OfflineTokenService.guardar)
//          y se devuelve el estado que indique el backend (valid / revoked /
//          suspended / expired / invalid).
//   5. Si el backend NO responde (sin conexión), se recurre al token offline
//      local (OfflineTokenService.obtenerEstadoEfectivo). Esto cubre el caso
//      de uso central: negocio sin internet temporalmente.
//   6. Si tampoco existe token offline (primera vez, nunca se contactó al
//      backend con éxito), se cae al resultado de la verificación local del
//      paso 3 — esto es exactamente el comportamiento actual del sistema,
//      preservado al 100% para no romper instalaciones existentes.
// =============================================================================

const SECRET = 'pos-minimarket-license-secret-2024';

interface LicensePayload {
  hwid:      string;
  cliente:   string;
  expira_at: string | null;   // ISO 8601 o null (permanente)
  signature: string;
}

export class LicenseService {
  private readonly keyPath: string;
  private readonly offlineTokens: OfflineTokenService;

  constructor() {
    this.keyPath       = path.join(app.getPath('userData'), 'license.key');
    this.offlineTokens = new OfflineTokenService();
  }

  async check(): Promise<LicenseStatus> {
    const hwid = HwidService.get();

    // ── Modo desarrollo: bypass completo ──────────────────────────────────────
    // En producción (electron-builder) NODE_ENV es undefined o 'production'.
    // Mientras corres con `npm run dev` esta condición siempre es true.
    if (process.env.NODE_ENV === 'development') {
      return {
        estado:    'valid',
        hwid,
        expira_at: null,
        cliente:   'Modo Desarrollo',
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (!fs.existsSync(this.keyPath)) {
      return { estado: 'not_found', hwid, expira_at: null, cliente: null };
    }

    // 1. Verificación local del archivo license.key (formato y firma sin cambios)
    const localResult = this.checkLocal(hwid);

    // Si la verificación local ya es inválida (HWID o firma no coinciden),
    // no tiene sentido seguir al backend ni al token offline — el archivo
    // está corrupto o pertenece a otra máquina.
    if (localResult.estado === 'invalid') {
      return localResult;
    }

    const claveLicencia = this.leerArchivoCrudo();
    const dispositivoId = this.offlineTokens.leer()?.dispositivo_id ?? null;

    // 2. Intentar validación online primero
    const respuestaBackend = claveLicencia
      ? await LicenseClient.validar(claveLicencia, dispositivoId)
      : null;

    if (respuestaBackend) {
      // El backend respondió — es la fuente de verdad. Se refresca el
      // token offline para sostener operación sin conexión en el futuro.
      const tokenInput = LicenseClient.toOfflineTokenInput(
        respuestaBackend,
        respuestaBackend.cliente ?? localResult.cliente ?? ''
      );
      if (tokenInput) {
        this.offlineTokens.guardar(tokenInput);
      }

      return {
        estado:    this.mapEstadoBackend(respuestaBackend.estado),
        hwid,
        expira_at: respuestaBackend.expira_at ?? localResult.expira_at,
        cliente:   respuestaBackend.cliente ?? localResult.cliente,
      };
    }

    // 3. Sin conexión: usar el token offline local si existe
    if (this.offlineTokens.existe()) {
      return this.offlineTokens.obtenerEstadoEfectivo();
    }

    // 4. Sin backend y sin token offline: comportamiento original (100% local)
    return localResult;
  }

  /** Activa una licencia pegando el contenido del archivo .key (sin cambios de formato) */
  async activate(keyContent: string): Promise<LicenseStatus> {
    fs.writeFileSync(this.keyPath, keyContent.trim(), 'utf8');

    const hwid = HwidService.get();
    const localResult = this.checkLocal(hwid);

    if (localResult.estado === 'valid') {
      // Intentar activar también contra el backend para obtener el token
      // offline inicial. Si no hay conexión, la activación local ya alcanza
      // (comportamiento actual preservado).
      const respuestaBackend = await LicenseClient.activar(keyContent.trim());
      if (respuestaBackend?.ok) {
        const tokenInput = LicenseClient.toOfflineTokenInput(
          respuestaBackend,
          respuestaBackend.cliente ?? localResult.cliente ?? ''
        );
        if (tokenInput) this.offlineTokens.guardar(tokenInput);
      }
    }

    return this.check();
  }

  // ---------------------------------------------------------------------------
  // Utilidad para el distribuidor: genera un .key válido
  // No se expone en producción — es solo para la herramienta interna.
  // ---------------------------------------------------------------------------
  static generateKey(hwid: string, cliente: string, expira_at: string | null): string {
    const signature = new LicenseService().sign(hwid, cliente, expira_at);
    const payload: LicensePayload = { hwid, cliente, expira_at, signature };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  /** Verificación 100% local del archivo license.key — idéntica a la lógica original */
  private checkLocal(hwid: string): LicenseStatus {
    try {
      const raw     = fs.readFileSync(this.keyPath, 'utf8').trim();
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      const payload = JSON.parse(decoded) as LicensePayload;

      // 1. Verificar que el HWID coincide
      if (payload.hwid !== hwid) {
        return { estado: 'invalid', hwid, expira_at: null, cliente: null };
      }

      // 2. Verificar firma HMAC
      const expectedSig = this.sign(payload.hwid, payload.cliente, payload.expira_at);
      if (!crypto.timingSafeEqual(
        Buffer.from(payload.signature, 'hex'),
        Buffer.from(expectedSig,       'hex')
      )) {
        return { estado: 'invalid', hwid, expira_at: null, cliente: null };
      }

      // 3. Verificar expiración
      if (payload.expira_at && new Date(payload.expira_at) < new Date()) {
        return { estado: 'expired', hwid, expira_at: payload.expira_at, cliente: payload.cliente };
      }

      return {
        estado:    'valid',
        hwid,
        expira_at: payload.expira_at,
        cliente:   payload.cliente,
      };

    } catch {
      return { estado: 'invalid', hwid, expira_at: null, cliente: null };
    }
  }

  /** Lee el contenido crudo de license.key (la "clave" que se envía al backend) */
  private leerArchivoCrudo(): string | null {
    try {
      return fs.readFileSync(this.keyPath, 'utf8').trim();
    } catch {
      return null;
    }
  }

  private mapEstadoBackend(estado: LicenseEstado | string): LicenseEstado {
    const valido: LicenseEstado[] = ['valid', 'invalid', 'expired', 'revoked', 'suspended', 'grace_period', 'not_found'];
    return (valido as string[]).includes(estado) ? (estado as LicenseEstado) : 'invalid';
  }

  private sign(hwid: string, cliente: string, expira_at: string | null): string {
    return crypto
      .createHmac('sha256', SECRET)
      .update(`${hwid}|${cliente}|${expira_at ?? 'permanent'}`)
      .digest('hex');
  }
}