import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BackendConfigService } from './backend-config.service';

export type SettingsMap = Record<string, string>;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(BackendConfigService);

  get(): Observable<SettingsMap> {
    return this.http.get<SettingsMap>(`${this.base}/api/settings`, { headers: this.headers });
  }

  save(values: SettingsMap): Observable<SettingsMap> {
    return this.http.put<SettingsMap>(`${this.base}/api/settings`, values, { headers: this.headers });
  }

  private get base(): string {
    return this.config.snapshot().baseUrl;
  }

  private get headers(): HttpHeaders {
    const token = this.config.snapshot().token;
    return new HttpHeaders(token ? { 'X-Odm-Token': token } : {});
  }
}
