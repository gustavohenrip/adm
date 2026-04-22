import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-file-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tile">
      <span class="label">{{ displayExt }}</span>
      <span class="dot" [attr.data-status]="status"></span>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .tile {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--glass-hi);
      border: 1px solid var(--glass-border-2);
      display: grid;
      place-items: center;
      box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.9);
    }
    [data-theme="dark"] .tile {
      box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.06);
    }
    .label {
      font-family: var(--font-mono);
      font-size: 8.5px;
      font-weight: 600;
      color: var(--text-dim);
      letter-spacing: 0.4px;
    }
    .dot {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 8px;
      height: 8px;
      border-radius: 4px;
      border: 1.5px solid var(--bg-base);
    }
    .dot[data-status="downloading"] {
      background: var(--text);
      box-shadow: 0 0 0 3px oklch(0.30 0.005 260 / 0.08);
    }
    [data-theme="dark"] .dot[data-status="downloading"] {
      box-shadow: 0 0 0 3px oklch(1 0 0 / 0.08);
    }
    .dot[data-status="complete"] {
      background: var(--text);
    }
    .dot[data-status="paused"] {
      background: var(--text-subtle);
    }
    .dot[data-status="queued"] {
      background: transparent;
      border: 1px dashed var(--text-subtle);
    }
    .dot[data-status="failed"] {
      background: var(--text-dim);
    }
  `],
})
export class FileTileComponent {
  @Input() ext = '';
  @Input() status: 'downloading' | 'paused' | 'complete' | 'queued' | 'failed' = 'downloading';

  get displayExt(): string {
    return (this.ext || '').toUpperCase().slice(0, 3);
  }
}
