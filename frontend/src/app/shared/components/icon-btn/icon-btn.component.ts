import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon-btn',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="icon-btn" [attr.aria-label]="ariaLabel" [disabled]="disabled" [style.width.px]="size" [style.height.px]="size">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .icon-btn {
      all: unset;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text-dim);
      transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .icon-btn:hover:not(:disabled) {
      background: var(--glass-hi);
      border-color: var(--glass-border-2);
      color: var(--text);
    }
    .icon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class IconBtnComponent {
  @Input() ariaLabel = '';
  @Input() disabled = false;
  @Input() size = 28;
}
