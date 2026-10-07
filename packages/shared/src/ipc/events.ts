import type { Producto }      from '../entities/Producto';
import type { LicenseStatus } from '../entities/Config';

// =============================================================================
// IPCEvents — Eventos unidireccionales Main → Renderer
// =============================================================================

export interface IPCEvents {
  'stock:alerta-minimo': Producto;
  'db:error':            { message: string; code?: string };
  'app:version':         string;
  'updater:available':   { version: string; notes: string };
  'updater:progress':    number;
  'updater:ready':       string;
  'bcv:tasa':            { tasa: number; actualizadoEl: string };

  // Notifica al Renderer cuando el estado de licencia cambia en segundo
  // plano (por ejemplo: una revalidación periódica detecta que la licencia
  // fue revocada/suspendida/expiró mientras la app ya estaba abierta).
  'license:status-changed': LicenseStatus;
}