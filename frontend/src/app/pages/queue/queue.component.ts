import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { GlassComponent } from '../../shared/components/glass/glass.component';
import { QueueRowComponent } from './row.component';
import { Download } from '../../core/api/download.model';
import { formatBytes } from '../../shared/format/format';
import { DownloadsService } from '../../core/api/downloads.service';
import { ProgressGateway } from '../../core/ws/progress-gateway';

@Component({
  selector: 'app-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateModule, GlassComponent, QueueRowComponent],
  template: `
    <app-glass class="wrap" [radius]="18">
      <div class="panel">
        <form class="create" (ngSubmit)="addUrl()">
          <input
            type="text"
            name="url"
            [(ngModel)]="url"
            placeholder="https://example.com/file.zip"
            autocomplete="off"
            [disabled]="busy()"
          />
          <button type="submit" [disabled]="busy() || !url.trim()">Add</button>
        </form>

        <div class="header">
          <span></span>
          <span>{{ 'queue.columns.name' | translate }}</span>
          <span>{{ 'queue.columns.size' | translate }}</span>
          <span>{{ 'queue.columns.speed' | translate }}</span>
          <span>{{ 'queue.columns.eta' | translate }}</span>
          <span>{{ 'queue.columns.progress' | translate }}</span>
          <span class="right">—</span>
        </div>

        <div class="rows">
          @for (d of downloads(); track d.id) {
            <app-queue-row
              [d]="d"
              (pause)="onPause($event)"
              (resume)="onResume($event)"
              (more)="onMore($event)"
              (openFolder)="onOpenFolder($event)"
              (remove)="onRemove($event)"
            ></app-queue-row>
          } @empty {
            <div class="empty">{{ 'queue.empty' | translate }}</div>
          }
        </div>

        <div class="footer">
          <span>{{ downloads().length }} items · {{ totalSize }}</span>
          <span>{{ 'queue.footer.updated' | translate }}</span>
        </div>
      </div>
    </app-glass>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; }
    .wrap { flex: 1; display: flex; }
    :host ::ng-deep .wrap > .glass { flex: 1; display: flex; }
    .panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .create {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--hairline);
    }
    .create input {
      min-width: 0;
      height: 36px;
      border-radius: 8px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--text);
      padding: 0 12px;
      font: inherit;
      font-size: 13px;
      outline: none;
    }
    .create input:focus {
      border-color: var(--glass-border-2);
      background: var(--glass-hi);
    }
    .create button {
      height: 36px;
      border: 0;
      border-radius: 8px;
      padding: 0 16px;
      background: var(--text);
      color: var(--text-inverse);
      font-weight: 600;
      cursor: pointer;
    }
    .create button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .header {
      display: grid;
      grid-template-columns: 40px minmax(0,1.9fr) 90px 110px 90px minmax(0,1.1fr) 96px;
      padding: 14px 22px 12px;
      border-bottom: 1px solid var(--hairline);
      font-size: 10.5px;
      color: var(--text-subtle);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 500;
      gap: 16px;
      align-items: center;
    }
    .header .right { text-align: right; }
    .rows {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
    .empty {
      padding: 40px 22px;
      text-align: center;
      color: var(--text-subtle);
      font-size: 13px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 22px;
      border-top: 1px solid var(--hairline);
      font-size: 11px;
      color: var(--text-subtle);
      font-family: var(--font-mono);
      letter-spacing: 0.2px;
    }
  `],
})
export class QueueComponent implements OnInit {
  private readonly downloadsService = inject(DownloadsService);
  private readonly progressGateway = inject(ProgressGateway);

  readonly downloads = signal<Download[]>([]);
  readonly busy = signal(false);
  url = '';

  constructor() {
    effect(() => {
      const updates = this.progressGateway.updates();
      if (!updates.length) return;
      this.mergeMany(updates);
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.reload();
  }

  get totalSize(): string {
    const total = this.downloads().reduce((acc, d) => acc + d.sizeBytes, 0);
    return formatBytes(total);
  }

  addUrl(): void {
    const url = this.url.trim();
    if (!url) return;
    this.busy.set(true);
    const request = url.toLowerCase().startsWith('magnet:')
      ? this.downloadsService.addTorrent({ magnet: url })
      : this.downloadsService.create({ url });
    request.subscribe({
      next: (download) => {
        this.url = '';
        this.mergeOne(download);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }

  onPause(id: string): void {
    this.downloadsService.pause(id).subscribe((download) => this.mergeOne(download));
  }

  onResume(id: string): void {
    this.downloadsService.resume(id).subscribe((download) => this.mergeOne(download));
  }

  onMore(id: string): void {
    this.onRemove(id);
  }

  onOpenFolder(id: string): void {
    const download = this.downloads().find((d) => d.id === id);
    const adm = (globalThis as unknown as { adm?: { openFolder?: (path: string) => Promise<void> } }).adm;
    if (download?.folder && adm?.openFolder) adm.openFolder(download.folder);
  }

  onRemove(id: string): void {
    this.downloadsService.remove(id).subscribe(() => {
      this.downloads.update((items) => items.filter((item) => item.id !== id));
    });
  }

  private reload(): void {
    this.downloadsService.list().subscribe((items) => this.downloads.set(items));
  }

  private mergeMany(updates: Download[]): void {
    for (const update of updates) this.mergeOne(update);
  }

  private mergeOne(update: Download): void {
    this.downloads.update((items) => {
      const index = items.findIndex((item) => item.id === update.id);
      if (index < 0) return [update, ...items];
      const next = [...items];
      next[index] = { ...next[index], ...update };
      return next;
    });
  }
}
