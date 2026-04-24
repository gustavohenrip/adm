import { Injectable, signal } from '@angular/core';

export interface BackendConfig {
  baseUrl: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class BackendConfigService {
  private readonly _config = signal<BackendConfig>({ baseUrl: 'http://127.0.0.1:8080', token: '' });
  readonly config = this._config.asReadonly();

  async load(): Promise<void> {
    const odm = (globalThis as unknown as { odm?: { getBackendInfo(): Promise<{ port: number; token: string }> } }).odm;
    if (odm?.getBackendInfo) {
      try {
        const info = await odm.getBackendInfo();
        if (info?.port) {
          this._config.set({ baseUrl: `http://127.0.0.1:${info.port}`, token: info.token ?? '' });
        }
      } catch {}
    }
  }

  snapshot(): BackendConfig {
    return this._config();
  }
}
