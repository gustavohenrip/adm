import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';

import { GlassComponent } from '../../shared/components/glass/glass.component';
import { QueueRowComponent } from './row.component';
import { Download } from '../../core/api/download.model';
import { formatBytes } from '../../shared/format/format';
import { DownloadsService } from '../../core/api/downloads.service';
import { DownloadStore } from '../../core/api/download-store.service';
import { DownloadIntakeService } from '../../core/api/download-intake.service';

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
            [disabled]="intake.busy()"
          />
          <button type="submit" [disabled]="intake.busy() || !url.trim()">{{ 'actions.add' | translate }}</button>
        </form>
        @if (error() || intake.error()) {
          <div class="form-error" role="alert">{{ error() || intake.error() }}</div>
        }

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
          @for (d of visibleDownloads(); track d.id) {
            <app-queue-row
              [d]="d"
              (pause)="onPause($event)"
              (resume)="onResume($event)"
              (openFolder)="onOpenFolder($event)"
              (remove)="onRemove($event)"
              (refresh)="onRefresh($event)"
            ></app-queue-row>
          } @empty {
            <div class="empty">{{ 'queue.empty' | translate }}</div>
          }
        </div>

        <div class="footer">
          <span>{{ 'queue.footer.items' | translate: { count: visibleDownloads().length, total: totalSize } }}</span>
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
      overflow: hidden;
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
    .form-error {
      padding: 10px 18px;
      border-bottom: 1px solid var(--hairline);
      color: var(--text);
      background: var(--selection);
      font-size: 12px;
    }
    .header {
      display: grid;
      grid-template-columns: 40px minmax(0,1.9fr) 90px 110px 90px minmax(0,1.1fr) 120px;
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
    @media (max-width: 760px) {
      .create {
        grid-template-columns: 1fr;
        padding: 12px;
      }
      .create button {
        width: 100%;
      }
      .header { display: none; }
      .rows {
        overflow: auto;
      }
      .footer {
        gap: 12px;
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `],
})
export class QueueComponent implements OnInit {
  private readonly downloadsService = inject(DownloadsService);
  private readonly store = inject(DownloadStore);
  protected readonly intake = inject(DownloadIntakeService);
  private readonly router = inject(Router);

  readonly downloads = this.store.downloads;
  readonly scope = signal(this.scopeFromUrl(this.router.url));
  readonly visibleDownloads = computed(() => this.downloads().filter((download) => this.matchesScope(download)));
  readonly error = signal('');
  url = '';

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.scope.set(this.scopeFromUrl(this.router.url));
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  get totalSize(): string {
    const total = this.visibleDownloads().reduce((acc, d) => acc + d.sizeBytes, 0);
    return formatBytes(total);
  }

  addUrl(): void {
    const url = this.url.trim();
    if (!url) return;
    this.error.set('');
    this.intake.openFromUrl(url);
    this.url = '';
  }

  onPause(id: string): void {
    const current = this.downloads().find((d) => d.id === id);
    if (current) this.store.mergeOne({ ...current, status: 'paused', speedBps: 0, etaSeconds: -1 });
    this.downloadsService.pause(id).subscribe({
      next: (download) => this.mergeOne(download),
      error: () => { if (current) this.store.mergeOne(current); },
    });
  }

  onResume(id: string): void {
    const current = this.downloads().find((d) => d.id === id);
    if (current) this.store.mergeOne({ ...current, status: 'queued' });
    this.downloadsService.resume(id).subscribe({
      next: (download) => this.mergeOne(download),
      error: () => { if (current) this.store.mergeOne(current); },
    });
  }

  onRefresh(payload: { id: string; url: string }): void {
    this.downloadsService.refresh(payload.id, payload.url).subscribe((download) => this.mergeOne(download));
  }

  onOpenFolder(id: string): void {
    const download = this.downloads().find((d) => d.id === id);
    const odm = (globalThis as unknown as { odm?: { openFolder?: (path: string) => Promise<void> } }).odm;
    if (download?.folder && odm?.openFolder) odm.openFolder(download.folder);
  }

  onRemove(id: string): void {
    this.store.removeLocal(id);
    this.downloadsService.remove(id).subscribe();
  }

  private reload(): void {
    this.store.load();
  }

  private mergeOne(update: Download): void {
    this.store.mergeOne(update);
  }

  private matchesScope(download: Download): boolean {
    const scope = this.scope();
    if (scope === 'active') return download.status === 'downloading';
    if (scope === 'queued') return download.status === 'queued' || download.status === 'paused';
    if (scope === 'completed') return download.status === 'complete';
    if (scope === 'failed') return download.status === 'failed';
    if (scope === 'scheduled') return false;
    return true;
  }

  private scopeFromUrl(url: string): string {
    const path = url.split('?')[0].replace(/^\/+/, '');
    return path || 'queue';
  }
}
