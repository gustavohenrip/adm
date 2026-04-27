import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Download, DownloadPreview } from './download.model';
import { DownloadsService } from './downloads.service';
import { DownloadStore } from './download-store.service';
import { ProgressGateway } from '../ws/progress-gateway';

type OdmBridge = {
  onClipboardUrl?: (handler: (url: string) => void) => () => void;
  onIncomingUrl?: (handler: (url: string) => void) => () => void;
  selectFolder?: (current?: string) => Promise<string>;
  confirmOverwrite?: (folder: string, filename: string) => Promise<{ proceed: boolean; overwrite: boolean }>;
};

@Injectable({ providedIn: 'root' })
export class DownloadIntakeService {
  private readonly downloads = inject(DownloadsService);
  private readonly store = inject(DownloadStore);
  private readonly gateway = inject(ProgressGateway);
  private readonly router = inject(Router);
  private readonly recent = new Map<string, number>();
  private readonly inFlight = new Map<string, number>();
  private readonly queue: DownloadPreview[] = [];
  private readonly recentMs = 45_000;

  readonly pending = signal<DownloadPreview | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly selectedFolder = signal('');
  readonly useDefaultFolder = signal(true);

  constructor() {
    effect(() => {
      for (const preview of this.gateway.intakes()) this.openPreview(preview);
    }, { allowSignalWrites: true });

    const odm = this.bridge();
    odm?.onClipboardUrl?.((url) => this.openFromUrl(url));
    odm?.onIncomingUrl?.((url) => this.openFromUrl(url));
    setTimeout(() => this.loadPending(), 1500);
  }

  private loadPending(): void {
    this.downloads.pendingIntakes().subscribe({
      next: (items) => items.forEach((item) => this.openPreview(item)),
      error: () => {},
    });
  }

  openFromUrl(url: string): void {
    const value = this.cleanUrl(url);
    if (!value) return;
    const key = this.inputKey(value);
    if (this.hasDuplicate(key) || this.hasExisting(value, key)) {
      this.error.set('');
      this.router.navigateByUrl('/queue');
      return;
    }
    this.mark(this.inFlight, key);
    this.busy.set(true);
    this.error.set('');
    const request = this.isMagnet(value)
      ? this.downloads.previewTorrent({ magnet: value })
      : this.isTorrentUrl(value)
        ? this.downloads.previewTorrent({ torrentUrl: value })
        : this.downloads.preview({ url: value });
    request.subscribe({
      next: (preview) => {
        this.busy.set(false);
        this.inFlight.delete(key);
        this.openPreview(preview, [key]);
      },
      error: () => {
        this.busy.set(false);
        this.inFlight.delete(key);
        if (this.isMagnet(value)) {
          this.openPreview(this.fallbackMagnetPreview(value), [key]);
          return;
        }
        this.error.set('Não foi possível ler este download.');
      },
    });
  }

  openPreview(preview: DownloadPreview, extraKeys: string[] = []): void {
    if (!preview?.id) return;
    const keys = this.previewKeys(preview, extraKeys);
    if (keys.some((key) => this.hasDuplicate(key) || this.hasExisting(preview.url, key))) return;
    keys.forEach((key) => this.mark(this.recent, key));
    if (this.pending()) {
      this.queue.push(preview);
      return;
    }
    this.pending.set(preview);
    this.selectedFolder.set(preview.folder || '');
    this.useDefaultFolder.set(true);
    this.error.set('');
    this.router.navigateByUrl('/queue');
  }

  cancel(): void {
    this.pending.set(null);
    this.error.set('');
    this.showNext();
  }

  async confirm(): Promise<void> {
    const preview = this.pending();
    if (!preview || this.busy()) return;
    const folder = this.useDefaultFolder() ? undefined : this.selectedFolder().trim();
    const finalFolder = folder || preview.folder || preview.http?.folder || preview.torrent?.folder || '';
    const filename = this.targetName(preview);
    const overwrite = await this.confirmOverwrite(finalFolder, filename, !!preview.targetExists);
    if (!overwrite.proceed) return;
    this.busy.set(true);
    this.error.set('');
    const request = preview.kind === 'torrent' && preview.torrent
      ? this.downloads.addTorrent({ ...preview.torrent, folder: folder || preview.torrent.folder, overwrite: overwrite.overwrite || undefined })
      : this.downloads.create({ ...(preview.http ?? { url: preview.url }), folder: folder || preview.http?.folder, overwrite: overwrite.overwrite || undefined });
    request.subscribe({
      next: (download) => {
        this.store.mergeOne(download);
        this.pending.set(null);
        this.busy.set(false);
        this.showNext();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Não foi possível iniciar este download.');
      },
    });
  }

  async chooseFolder(): Promise<void> {
    const odm = this.bridge();
    if (!odm?.selectFolder) return;
    const folder = await odm.selectFolder(this.selectedFolder());
    if (!folder) return;
    this.selectedFolder.set(folder);
    this.useDefaultFolder.set(false);
  }

  private bridge(): OdmBridge | undefined {
    return (globalThis as unknown as { odm?: OdmBridge }).odm;
  }

  private isMagnet(url: string): boolean {
    return url.toLowerCase().startsWith('magnet:');
  }

  private isTorrentUrl(url: string): boolean {
    return /^https?:\/\//i.test(url) && /\.torrent(?:[?#].*)?$/i.test(url);
  }

  private showNext(): void {
    const next = this.queue.shift();
    if (!next) return;
    this.pending.set(next);
    this.selectedFolder.set(next.folder || '');
    this.useDefaultFolder.set(true);
    this.error.set('');
    this.router.navigateByUrl('/queue');
  }

  private async confirmOverwrite(folder: string, filename: string, knownExists: boolean): Promise<{ proceed: boolean; overwrite: boolean }> {
    if (!folder || !filename) return { proceed: true, overwrite: false };
    const odm = this.bridge();
    if (odm?.confirmOverwrite) {
      try {
        return await odm.confirmOverwrite(folder, filename);
      } catch {
        return { proceed: false, overwrite: false };
      }
    }
    if (!knownExists) return { proceed: true, overwrite: false };
    const proceed = globalThis.confirm(`"${filename}" já existe nesta pasta. Deseja substituir?`);
    return { proceed, overwrite: proceed };
  }

  private targetName(preview: DownloadPreview): string {
    if (preview.kind === 'http') return preview.http?.filename || preview.name;
    return preview.torrent?.name || preview.name;
  }

  private cleanUrl(url: string): string {
    const value = (url || '').trim();
    if (!value) return '';
    if (value.toLowerCase().startsWith('odm://add?')) {
      try {
        return new URL(value).searchParams.get('url')?.trim() || '';
      } catch {
        return '';
      }
    }
    if (/^magnet%3a/i.test(value)) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private previewKeys(preview: DownloadPreview, extraKeys: string[]): string[] {
    return Array.from(new Set([
      this.previewKey(preview),
      this.inputKey(preview.url),
      ...extraKeys,
    ].filter(Boolean)));
  }

  private previewKey(preview: DownloadPreview): string {
    if (preview.kind === 'torrent' && preview.source && preview.source !== 'magnet') {
      return `torrent:${preview.source.toLowerCase()}`;
    }
    return this.inputKey(preview.url);
  }

  private inputKey(url: string): string {
    const value = this.cleanUrl(url);
    if (!value) return '';
    if (this.isMagnet(value)) {
      const hash = this.magnetHash(value);
      return `torrent:${(hash || value).toLowerCase()}`;
    }
    if (this.isTorrentUrl(value)) return `torrent-url:${value.toLowerCase()}`;
    return `http:${value.toLowerCase()}`;
  }

  private magnetHash(magnet: string): string {
    const match = /xt=urn:btih:([^&]+)/i.exec(magnet);
    return match ? match[1].trim() : '';
  }

  private hasDuplicate(key: string): boolean {
    if (!key) return false;
    this.pruneRecent();
    return this.recent.has(key) || this.inFlight.has(key);
  }

  private hasExisting(url: string, key: string): boolean {
    const value = this.cleanUrl(url).toLowerCase();
    return this.store.downloads().some((download) => {
      if (download.status === 'failed') return false;
      if (key && this.downloadKey(download) === key) return true;
      return !!value && !!download.url && this.cleanUrl(download.url).toLowerCase() === value;
    });
  }

  private downloadKey(download: Download): string {
    if (download.kind === 'torrent' && download.source) return `torrent:${download.source.toLowerCase()}`;
    return this.inputKey(download.url || '');
  }

  private mark(target: Map<string, number>, key: string): void {
    if (!key) return;
    this.pruneRecent();
    target.set(key, Date.now());
  }

  private pruneRecent(): void {
    const now = Date.now();
    for (const [key, at] of this.recent) {
      if (now - at > this.recentMs) this.recent.delete(key);
    }
    for (const [key, at] of this.inFlight) {
      if (now - at > this.recentMs) this.inFlight.delete(key);
    }
  }

  private fallbackMagnetPreview(magnet: string): DownloadPreview {
    const source = this.magnetHash(magnet) || 'magnet';
    const name = this.magnetName(magnet, source);
    return {
      id: `magnet-${source.toLowerCase()}`,
      kind: 'torrent',
      name,
      source,
      url: magnet,
      folder: '',
      sizeBytes: 0,
      acceptsRanges: false,
      segments: 1,
      torrent: { magnet, name },
      targetExists: false,
    };
  }

  private magnetName(magnet: string, source: string): string {
    const q = magnet.indexOf('?');
    if (q >= 0) {
      const params = new URLSearchParams(magnet.slice(q + 1));
      const name = params.get('dn')?.trim();
      if (name) return name.replace(/[\\/:]/g, '_').slice(0, 180);
    }
    return `Magnet ${source.slice(0, 12)}`;
  }
}
