import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type ProgressStatus = 'downloading' | 'paused' | 'complete' | 'queued' | 'failed';

@Component({
  selector: 'app-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="track" [attr.aria-valuenow]="clamped" aria-valuemin="0" aria-valuemax="100" role="progressbar">
      <div class="fill" [style.width.%]="displayPct" [class.muted]="muted"></div>
    </div>
  `,
  styles: [`
    :host { display: block; flex: 1; }
    .track {
      height: 4px;
      border-radius: 99px;
      background: var(--track);
      overflow: hidden;
      box-shadow: inset 0 1px 1px oklch(0 0 0 / 0.15);
    }
    .fill {
      height: 100%;
      background: var(--fill);
      border-radius: 99px;
      transition: width .3s ease;
    }
    .fill.muted {
      background: var(--fill-muted);
    }
  `],
})
export class ProgressComponent {
  @Input({ required: true }) value = 0;
  @Input() status: ProgressStatus = 'downloading';

  get clamped(): number {
    return Math.round(Math.max(0, Math.min(1, this.value)) * 100);
  }

  get displayPct(): number {
    return this.status === 'queued' ? 0 : this.clamped;
  }

  get muted(): boolean {
    return this.status === 'paused' || this.status === 'complete';
  }
}
