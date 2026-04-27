import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { GlassComponent } from '../../shared/components/glass/glass.component';
import { IconComponent } from '../../shared/icons/icons.component';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, GlassComponent, IconComponent],
  template: `
    <app-glass [radius]="16">
      <div class="inner">
        <div class="title-block">
          <div class="title">{{ titleKey | translate }}</div>
          <div class="subtitle">{{ subtitle }}</div>
        </div>

        <div class="spacer"></div>

        <div class="url-paste" role="button" tabindex="0" (click)="pasteUrl.emit()">
          <app-icon name="link" [size]="13"></app-icon>
          <span>{{ 'actions.pasteUrlOrDrop' | translate }}</span>
          <span class="spacer"></span>
          <span class="kbd">⌘V</span>
        </div>

        <div class="bulk-seg" role="group" [attr.aria-label]="'actions.bulk' | translate">
          <button type="button" class="seg" (click)="resumeAll.emit()" [attr.aria-label]="'actions.resumeAll' | translate" [title]="'actions.resumeAll' | translate">
            <app-icon name="play" [size]="13"></app-icon>
          </button>
          <button type="button" class="seg" (click)="pauseAll.emit()" [attr.aria-label]="'actions.pauseAll' | translate" [title]="'actions.pauseAll' | translate">
            <app-icon name="pause" [size]="13"></app-icon>
          </button>
        </div>

        <div class="theme-seg" role="group" aria-label="Theme">
          <button type="button" class="seg" [class.active]="theme() === 'light'" (click)="setTheme('light')" aria-label="Light theme">
            <app-icon name="sun" [size]="13"></app-icon>
          </button>
          <button type="button" class="seg" [class.active]="theme() === 'dark'" (click)="setTheme('dark')" aria-label="Dark theme">
            <app-icon name="moon" [size]="13"></app-icon>
          </button>
        </div>

        <button class="settings-btn" type="button" (click)="openSettings.emit()" aria-label="Settings">
          <app-icon name="settings" [size]="14"></app-icon>
        </button>
      </div>
    </app-glass>
  `,
  styles: [`
    :host { display: block; }
    .inner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
    }
    .title-block { display: flex; flex-direction: column; }
    .title {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 11.5px;
      color: var(--text-dim);
      margin-top: 1px;
      font-family: var(--font-mono);
    }

    .spacer { flex: 1; }

    .url-paste {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      border-radius: 11px;
      min-width: 360px;
      color: var(--text-dim);
      font-size: 12.5px;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease;
    }
    .url-paste:hover { background: var(--glass-hi); border-color: var(--glass-border-2); }
    .url-paste .spacer { flex: 1; }
    .url-paste .kbd {
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--text-subtle);
      letter-spacing: 0.2px;
    }

    .bulk-seg, .theme-seg {
      display: flex;
      align-items: center;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      border-radius: 11px;
      padding: 3px;
    }
    .seg {
      all: unset;
      cursor: pointer;
      padding: 5px 10px;
      border-radius: 8px;
      color: var(--text-dim);
      display: grid;
      place-items: center;
      min-width: 24px;
      border: 1px solid transparent;
      transition: background .15s ease, color .15s ease;
    }
    .seg.active {
      background: var(--glass-hi);
      border-color: var(--glass-border-2);
      color: var(--text);
    }
    .seg:hover:not(.active) { color: var(--text); background: var(--glass-hi); }

    .settings-btn {
      all: unset;
      cursor: pointer;
      width: 34px;
      height: 34px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text-dim);
      transition: background .15s ease, color .15s ease;
    }
    .settings-btn:hover {
      background: var(--glass-hi);
      color: var(--text);
    }
    @media (max-width: 760px) {
      .inner {
        flex-wrap: wrap;
        padding: 12px;
        gap: 8px;
      }
      .title-block {
        width: 100%;
      }
      .url-paste {
        order: 2;
        min-width: 0;
        width: 100%;
      }
      .theme-seg {
        margin-left: auto;
      }
    }
  `],
})
export class TopbarComponent {
  private readonly themeService = inject(ThemeService);
  readonly theme = this.themeService.theme;

  @Input() titleKey = 'nav.active';
  @Input() subtitle = '';

  @Output() pasteUrl = new EventEmitter<void>();
  @Output() openSettings = new EventEmitter<void>();
  @Output() pauseAll = new EventEmitter<void>();
  @Output() resumeAll = new EventEmitter<void>();

  setTheme(value: 'light' | 'dark') {
    this.themeService.set(value);
  }
}
