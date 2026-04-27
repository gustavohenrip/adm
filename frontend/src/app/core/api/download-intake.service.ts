import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { DownloadPreview } from './download.model';
import { DownloadsService } from './downloads.service';
import { DownloadStore } from './download-store.service';
import { ProgressGateway } from '../ws/progress-gateway';

type OdmBridge = {
  onClipboardUrl?: (handler: (url: string) => void) => () => void;
  onIncomingUrl?: (handler: (url: string) => void) => () => void;
  selectFolder?: (current?: string) => Promise<string>;
};

@Injectable({ providedIn: 'root' })
export class DownloadIntakeService {
  private readonly downloads = inject(DownloadsService);
  private readonly store = inject(DownloadStore);
  private readonly gateway = inject(ProgressGateway);
  private readonly router = inject(Router);
  private readonly seen = new Set<string>();
  private readonly queue: DownloadPreview[] = [];

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
    const value = url.trim();
    if (!value) return;
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
        this.openPreview(preview);
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Não foi possível ler este download.');
      },
    });
  }

  openPreview(preview: DownloadPreview): void {
    if (!preview?.id || this.seen.has(preview.id)) return;
    this.seen.add(preview.id);
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

  confirm(): void {
    const preview = this.pending();
    if (!preview) return;
    this.busy.set(true);
    this.error.set('');
    const folder = this.useDefaultFolder() ? undefined : this.selectedFolder().trim();
    const request = preview.kind === 'torrent' && preview.torrent
      ? this.downloads.addTorrent({ ...preview.torrent, folder: folder || preview.torrent.folder })
      : this.downloads.create({ ...(preview.http ?? { url: preview.url }), folder: folder || preview.http?.folder });
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
}
