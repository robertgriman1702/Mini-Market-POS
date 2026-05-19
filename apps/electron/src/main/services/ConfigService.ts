import fs   from 'fs';
import path  from 'path';
import { app } from 'electron';
import { DEFAULT_CONFIG } from '@pos/shared';
import type { AppConfig } from '@pos/shared';

// =============================================================================
// ConfigService — Configuración persistente en userData/config.json
//
// Responsabilidad única: leer y escribir la configuración del local.
// Los feature flags aquí controlan qué botones/módulos se muestran en la UI.
// =============================================================================

export class ConfigService {
  private readonly configPath: string;
  private cache: AppConfig | null = null;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
  }

  get(): AppConfig {
    if (this.cache) return this.cache;

    if (!fs.existsSync(this.configPath)) {
      this.cache = { ...DEFAULT_CONFIG };
      this.persist(this.cache);
      return this.cache;
    }

    try {
      const raw      = fs.readFileSync(this.configPath, 'utf8');
      const saved    = JSON.parse(raw) as Partial<AppConfig>;
      // Deep merge: defaults + saved (así los flags nuevos siempre tienen default)
      this.cache = {
        ...DEFAULT_CONFIG,
        ...saved,
        flags: { ...DEFAULT_CONFIG.flags, ...(saved.flags ?? {}) },
      };
      return this.cache;
    } catch {
      this.cache = { ...DEFAULT_CONFIG };
      return this.cache;
    }
  }

  save(partial: Partial<AppConfig>): AppConfig {
    const current  = this.get();
    this.cache = {
      ...current,
      ...partial,
      flags: { ...current.flags, ...(partial.flags ?? {}) },
    };
    this.persist(this.cache);
    return this.cache;
  }

  private persist(config: AppConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
  }
}
