import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BackendConfigService } from './backend-config.service';
import { Download, DownloadCreateRequest, TorrentCreateRequest } from './download.model';

@Injectable({ providedIn: 'root' })
export class DownloadsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(BackendConfigService);

  list(): Observable<Download[]> {
    return this.http.get<Download[]>(`${this.base}/api/downloads`, { headers: this.headers });
  }

  create(req: DownloadCreateRequest): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/downloads`, req, { headers: this.headers });
  }

  pause(id: string): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/downloads/${id}/pause`, null, { headers: this.headers });
  }

  resume(id: string): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/downloads/${id}/resume`, null, { headers: this.headers });
  }

  remove(id: string, deleteFiles = false): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/downloads/${id}?deleteFiles=${deleteFiles}`, { headers: this.headers });
  }

  addTorrent(req: TorrentCreateRequest): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/torrents`, req, { headers: this.headers });
  }

  private get base(): string {
    return this.config.snapshot().baseUrl;
  }

  private get headers(): HttpHeaders {
    const token = this.config.snapshot().token;
    return new HttpHeaders(token ? { 'X-Odm-Token': token } : {});
  }
}
