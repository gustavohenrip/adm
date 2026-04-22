import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { GlassComponent } from '../../shared/components/glass/glass.component';
import { QueueRowComponent } from './row.component';
import { Download } from '../../core/api/download.model';
import { formatBytes } from '../../shared/format/format';

@Component({
  selector: 'app-queue',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslateModule, GlassComponent, QueueRowComponent],
  template: `
    <app-glass class="wrap" [radius]="18">
      <div class="panel">
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
export class QueueComponent {
  readonly downloads = signal<Download[]>([]);

  get totalSize(): string {
    const total = this.downloads().reduce((acc, d) => acc + d.sizeBytes, 0);
    return formatBytes(total);
  }

  onPause(id: string) { /* wired in commit 11 */ }
  onResume(id: string) { /* wired in commit 11 */ }
  onMore(id: string) { /* wired in commit 11 */ }
  onOpenFolder(id: string) { /* wired in commit 11 */ }
}
