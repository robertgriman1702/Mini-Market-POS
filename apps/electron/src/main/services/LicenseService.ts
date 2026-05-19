import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { HwidService }   from './HwidService';
import type { LicenseStatus } from '@pos/shared';

// =============================================================================
// LicenseService — Validación de licencia basada en HWID
//
// Formato del archivo license.key (en userData):
//   BASE64( JSON({ hwid, cliente, expira_at, signature }) )
//
// La firma se genera con HMAC-SHA256 usando un secret embebido en el binario.
// Para activar: el distribuidor genera el .key con la herramienta de licencias
// y el cliente lo coloca en la carpeta de datos de la app.
//
// En producción reemplazar SECRET por un valor largo y aleatorio.
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

  constructor() {
    this.keyPath = path.join(app.getPath('userData'), 'license.key');
  }

  check(): LicenseStatus {
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

  /** Activa una licencia pegando el contenido del archivo .key */
  activate(keyContent: string): LicenseStatus {
    fs.writeFileSync(this.keyPath, keyContent.trim(), 'utf8');
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

  private sign(hwid: string, cliente: string, expira_at: string | null): string {
    return crypto
      .createHmac('sha256', SECRET)
      .update(`${hwid}|${cliente}|${expira_at ?? 'permanent'}`)
      .digest('hex');
  }
}