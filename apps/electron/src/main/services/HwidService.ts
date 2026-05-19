import { execSync } from 'child_process';
import os           from 'os';
import crypto       from 'crypto';

// =============================================================================
// HwidService — Hardware ID único por máquina
//
// Obtiene un identificador estable de la máquina usando métodos nativos
// de cada plataforma. El resultado se hashea para uniformidad.
// =============================================================================

export class HwidService {
  private static cached: string | null = null;

  static get(): string {
    if (this.cached) return this.cached;
    const raw  = this.getRaw();
    // SHA-256 del raw → tomar los primeros 12 chars → formato XXXX-XXXX-XXXX
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    this.cached = `${hash.slice(0,4)}-${hash.slice(4,8)}-${hash.slice(8,12)}`;
    return this.cached;
  }

  private static getRaw(): string {
    try {
      switch (process.platform) {
        case 'win32':
          return this.getWindows();
        case 'darwin':
          return this.getMac();
        default:
          return this.getLinux();
      }
    } catch {
      // Fallback: combinación de hostname + CPU info
      const cpus = os.cpus();
      return `${os.hostname()}-${cpus[0]?.model ?? 'unknown'}-${cpus.length}`;
    }
  }

  private static getWindows(): string {
    // MachineGuid del registro de Windows — estable entre reinicios
    const out = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8' }
    );
    const match = out.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/);
    if (!match?.[1]) throw new Error('MachineGuid not found');
    return match[1].trim();
  }

  private static getMac(): string {
    const out = execSync(
      'ioreg -rd1 -c IOPlatformExpertDevice | awk \'/IOPlatformUUID/{print $3}\'',
      { encoding: 'utf8' }
    );
    return out.replace(/["\n\r]/g, '').trim();
  }

  private static getLinux(): string {
    // /etc/machine-id es el estándar en distros modernas
    const { readFileSync } = require('fs');
    return readFileSync('/etc/machine-id', 'utf8').trim();
  }
}
