import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { Download } from '../../core/api/download.model';
import { IconBtnComponent } from '../../shared/components/icon-btn/icon-btn.component';
import { IconComponent } from '../../shared/icons/icons.component';
import { ProgressComponent } from '../../shared/components/progress/progress.component';
import { FileTileComponent } from '../../shared/components/file-tile/file-tile.component';
import { formatBytes, formatEta, formatSpeed } from '../../shared/format/format';

@Component({
  selector: 'app-queue-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, IconBtnComponent, IconComponent, ProgressComponent, FileTileComponent],
  template: `
    <div class="row">
      <div class="cell tile">
        <app-file-tile [ext]="d.ext" [status]="d.status"></app-file-tile>
      </div>

      <div class="cell name">
        <div class="name-line" [class.dim]="d.status === 'complete'">{{ d.name }}</div>
        <div class="meta">
          <span>{{ d.source }}</span>
          @if (d.completedAt) { <span>·</span><span>{{ d.completedAt }}</span> }
          @if (d.status === 'paused') { <span>·</span><span>{{ 'status.paused' | translate }}</span> }
          @if (d.status === 'queued') { <span>·</span><span>{{ 'status.queued' | translate }}</span> }
          @if (d.status === 'failed') { <span>·</span><span class="err">{{ 'status.failed' | translate }}</span> }
        </div>
      </div>

      <div class="cell mono dim">{{ size }}</div>
      <div class="cell mono" [class.dim]="d.speedBps <= 0" [class.bold]="d.speedBps > 0">{{ speed }}</div>
      <div class="cell mono dim">{{ eta }}</div>

      <div class="cell progress">
        <app-progress [value]="d.progress" [status]="d.status"></app-progress>
        <span class="pct mono" [class.dim]="d.status === 'complete'">{{ pct }}%</span>
      </div>

      <div class="cell actions">
        @if (d.status === 'downloading') {
          <app-icon-btn (click)="pause.emit(d.id)" [ariaLabel]="'actions.pause' | translate">
            <app-icon name="pause" [size]="12"></app-icon>
          </app-icon-btn>
        }
        @if (d.status === 'paused' || d.status === 'queued' || d.status === 'failed') {
          <app-icon-btn (click)="resume.emit(d.id)" [ariaLabel]="'actions.resume' | translate">
            <app-icon name="play" [size]="12"></app-icon>
          </app-icon-btn>
        }
        @if (d.status === 'complete') {
          <app-icon-btn (click)="openFolder.emit(d.id)" [ariaLabel]="'actions.openFolder' | translate">
            <app-icon name="folder" [size]="13"></app-icon>
          </app-icon-btn>
        }
        <app-icon-btn (click)="more.emit(d.id)" [ariaLabel]="'actions.more' | translate">
          <app-icon name="more" [size]="13"></app-icon>
        </app-icon-btn>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns: 40px minmax(0,1.9fr) 90px 110px 90px minmax(0,1.1fr) 96px;
      padding: 15px 22px;
      gap: 16px;
      align-items: center;
      border-bottom: 1px solid var(--hairline);
      font-size: 13px;
      transition: background .15s ease;
    }
    .row:hover { background: var(--selection); }
    .cell { min-width: 0; }
    .tile { display: grid; place-items: center; }
    .name-line {
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.15px;
      color: var(--text);
    }
    .name-line.dim { color: var(--text-dim); }
    .meta {
      font-size: 10.5px;
      color: var(--text-subtle);
      margin-top: 3px;
      font-family: var(--font-mono);
      letter-spacing: 0.1px;
      display: flex;
      gap: 8px;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta .err { color: var(--text-dim); }
    .mono { font-family: var(--font-mono); font-size: 12px; color: var(--text); }
    .mono.dim { color: var(--text-dim); }
    .mono.bold { font-weight: 500; }
    .progress {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pct {
      font-size: 11px;
      min-width: 34px;
      text-align: right;
      font-weight: 500;
    }
    .pct.dim { color: var(--text-dim); }
    .actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
  `],
})
export class QueueRowComponent {
  @Input({ required: true }) d!: Download;

  @Output() pause = new EventEmitter<string>();
  @Output() resume = new EventEmitter<string>();
  @Output() more = new EventEmitter<string>();
  @Output() openFolder = new EventEmitter<string>();

  get size(): string { return formatBytes(this.d.sizeBytes); }
  get speed(): string { return formatSpeed(this.d.speedBps / (1024 * 1024)); }
  get eta(): string {
    if (this.d.status === 'paused') return 'paused';
    if (this.d.status === 'queued') return 'queued';
    if (this.d.status === 'complete' || this.d.status === 'failed') return '—';
    return formatEta(this.d.etaSeconds);
  }
  get pct(): number { return Math.round(Math.max(0, Math.min(1, this.d.progress)) * 100); }
}
