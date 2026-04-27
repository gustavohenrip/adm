import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BackendConfigService } from './backend-config.service';
import {
  BatchDownloadRequest,
  Download,
  DownloadCreateRequest,
  DownloadPreview,
  ScheduleRule,
  TorrentCreateRequest,
} from './download.model';

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

  preview(req: DownloadCreateRequest): Observable<DownloadPreview> {
    return this.http.post<DownloadPreview>(`${this.base}/api/downloads/preview`, req, { headers: this.headers });
  }

  createBatch(req: BatchDownloadRequest): Observable<Download[]> {
    return this.http.post<Download[]>(`${this.base}/api/downloads/batch`, req, { headers: this.headers });
  }

  pause(id: string): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/downloads/${id}/pause`, null, { headers: this.headers });
  }

  resume(id: string): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/downloads/${id}/resume`, null, { headers: this.headers });
  }

  refresh(id: string, url: string): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/downloads/${id}/refresh`, { url }, { headers: this.headers });
  }

  pauseAll(): Observable<Download[]> {
    return this.http.post<Download[]>(`${this.base}/api/downloads/pause-all`, null, { headers: this.headers });
  }

  resumeAll(): Observable<Download[]> {
    return this.http.post<Download[]>(`${this.base}/api/downloads/resume-all`, null, { headers: this.headers });
  }

  remove(id: string, deleteFiles = false): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/downloads/${id}?deleteFiles=${deleteFiles}`, { headers: this.headers });
  }

  addTorrent(req: TorrentCreateRequest): Observable<Download> {
    return this.http.post<Download>(`${this.base}/api/torrents`, req, { headers: this.headers });
  }

  previewTorrent(req: TorrentCreateRequest): Observable<DownloadPreview> {
    return this.http.post<DownloadPreview>(`${this.base}/api/torrents/preview`, req, { headers: this.headers });
  }

  pendingIntakes(): Observable<DownloadPreview[]> {
    return this.http.get<DownloadPreview[]>(`${this.base}/api/intake`, { headers: this.headers });
  }

  scheduleRules(): Observable<ScheduleRule[]> {
    return this.http.get<ScheduleRule[]>(`${this.base}/api/schedule/rules`, { headers: this.headers });
  }

  saveScheduleRule(rule: ScheduleRule): Observable<ScheduleRule> {
    if (rule.id != null) {
      return this.http.put<ScheduleRule>(`${this.base}/api/schedule/rules/${rule.id}`, rule, { headers: this.headers });
    }
    return this.http.post<ScheduleRule>(`${this.base}/api/schedule/rules`, rule, { headers: this.headers });
  }

  deleteScheduleRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/schedule/rules/${id}`, { headers: this.headers });
  }

  reportClipboardUrl(url: string): Observable<unknown> {
    return this.http.post(`${this.base}/api/clipboard/captured`, { url }, { headers: this.headers });
  }

  private get base(): string {
    return this.config.snapshot().baseUrl;
  }

  private get headers(): HttpHeaders {
    const token = this.config.snapshot().token;
    return new HttpHeaders(token ? { 'X-Odm-Token': token } : {});
  }
}
