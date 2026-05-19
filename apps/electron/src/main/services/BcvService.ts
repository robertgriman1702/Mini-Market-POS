import { BrowserWindow } from 'electron';

// =============================================================================
// BcvService — Tasa de cambio BCV (USD → VES)
// API: https://ve.dolarapi.com/v1/dolares/oficial  (pública, sin key)
// Cache en memoria, refresco cada hora.
// =============================================================================

interface DolarApiResponse {
  promedio:            number;
  fechaActualizacion:  string;
}

export interface TasaCache {
  tasa:          number;    // Bs por 1 USD
  actualizadoEl: string;    // ISO 8601
}

let cache: TasaCache | null = null;
let timer:  NodeJS.Timeout | null = null;

export class BcvService {

  static async getTasa(): Promise<TasaCache | null> {
    if (cache) return cache;
    return this.fetch();
  }

  static startAutoRefresh(): void {
    this.fetch().then((t) => { if (t) this.emit(t); });
    timer = setInterval(async () => {
      const t = await this.fetch();
      if (t) this.emit(t);
    }, 60 * 60 * 1000);
  }

  static stopAutoRefresh(): void {
    if (timer) clearInterval(timer);
  }

  // Convierte dólares (en centavos) a bolívares
  static toBolivares(centavosUsd: number, tasa: number): number {
    return Math.round((centavosUsd / 100) * tasa);
  }

  private static async fetch(): Promise<TasaCache | null> {
    try {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 8000);
      const resp = await globalThis.fetch(
        'https://ve.dolarapi.com/v1/dolares/oficial',
        { signal: ctrl.signal, headers: { Accept: 'application/json' } }
      );
      clearTimeout(t);
      if (!resp.ok) return cache;
      const data = await resp.json() as DolarApiResponse;
      if (!data.promedio || isNaN(data.promedio)) return cache;
      cache = { tasa: data.promedio, actualizadoEl: data.fechaActualizacion ?? new Date().toISOString() };
      console.log(`[BCV] 1 USD = \${cache.tasa.toFixed(2)} Bs`);
      return cache;
    } catch {
      console.warn('[BCV] Sin conexión — usando caché.');
      return cache;
    }
  }

  private static emit(tasa: TasaCache): void {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('bcv:tasa', tasa));
  }
}