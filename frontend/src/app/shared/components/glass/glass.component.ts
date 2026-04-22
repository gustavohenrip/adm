import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-glass',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glass" [style.border-radius.px]="radius" [class.with-gloss]="gloss">
      @if (gloss) {
        <div class="gloss"></div>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .glass {
      position: relative;
      background: var(--glass);
      backdrop-filter: var(--blur-glass);
      -webkit-backdrop-filter: var(--blur-glass);
      border: 1px solid var(--glass-border);
      box-shadow: var(--shadow);
      overflow: hidden;
      isolation: isolate;
    }
    .gloss {
      position: absolute;
      top: 0;
      left: 18px;
      right: 18px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gloss-top), transparent);
      pointer-events: none;
    }
  `],
})
export class GlassComponent {
  @Input() radius = 18;
  @Input() gloss = true;
}
