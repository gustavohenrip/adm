import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';

import { Download, DownloadPreview } from '../api/download.model';
import { BackendConfigService } from '../api/backend-config.service';

export interface SystemEvent {
  type: string;
  payload: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class ProgressGateway {
  private readonly zone = inject(NgZone);
  private readonly config = inject(BackendConfigService);
  private client: Client | null = null;

  readonly connected = signal(false);
  readonly updates = signal<Download[]>([]);
  readonly intakes = signal<DownloadPreview[]>([]);
  readonly systemEvent = signal<SystemEvent | null>(null);

  async connect(): Promise<void> {
    if (this.client) return;
    const { baseUrl, token } = this.config.snapshot();
    const SockJS = (await import('sockjs-client')).default;
    this.client = new Client({
      webSocketFactory: () => new SockJS(`${baseUrl}/ws`) as any,
      connectHeaders: token ? { 'X-Odm-Token': token } : {},
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.zone.run(() => this.connected.set(true));
        this.client?.subscribe('/topic/progress', (msg: IMessage) => this.onProgress(msg));
        this.client?.subscribe('/topic/intake', (msg: IMessage) => this.onIntake(msg));
        this.client?.subscribe('/topic/system', (msg: IMessage) => this.onSystem(msg));
      },
      onDisconnect: () => this.zone.run(() => this.connected.set(false)),
      onStompError: () => this.zone.run(() => this.connected.set(false)),
    });
    this.client.activate();
  }

  disconnect(): void {
    this.client?.deactivate();
    this.client = null;
    this.connected.set(false);
  }

  private onProgress(msg: IMessage): void {
    try {
      const payload = JSON.parse(msg.body) as Array<Download & { kind?: string; status?: string }>;
      const normalized = payload.map((item) => ({
        ...item,
        kind: String(item.kind ?? '').toLowerCase() as Download['kind'],
        status: String(item.status ?? '').toLowerCase() as Download['status'],
      })).map((item) => {
        const progress = item.sizeBytes > 0 ? Math.max(0, Math.min(1, item.downloadedBytes / item.sizeBytes)) : 0;
        const speedBps = item.status === 'downloading' ? item.speedBps : 0;
        return { ...item, progress, speedBps };
      });
      this.zone.run(() => this.updates.set(normalized));
    } catch {}
  }

  private onIntake(msg: IMessage): void {
    try {
      const payload = JSON.parse(msg.body) as DownloadPreview[];
      this.zone.run(() => this.intakes.set(payload.map((item) => ({
        ...item,
        kind: String(item.kind ?? '').toLowerCase() as DownloadPreview['kind'],
      }))));
    } catch {}
  }

  private onSystem(msg: IMessage): void {
    try {
      const payload = JSON.parse(msg.body) as SystemEvent;
      this.zone.run(() => this.systemEvent.set({ ...payload, type: String(payload.type ?? '') }));
    } catch {}
  }
}
