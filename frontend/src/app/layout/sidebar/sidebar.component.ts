import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { GlassComponent } from '../../shared/components/glass/glass.component';
import { IconComponent } from '../../shared/icons/icons.component';

export interface SidebarNavItem {
  key: string;
  labelKey: string;
  count: number;
  path: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, RouterLinkActive, TranslateModule, GlassComponent, IconComponent],
  template: `
    <app-glass class="glass-wrap" [radius]="22">
      <div class="inner">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <app-icon name="arrow-down" [size]="11"></app-icon>
          </div>
          <span class="brand-name">ODM</span>
        </div>

        <button class="new-btn" type="button" (click)="newDownload.emit()">
          <app-icon name="plus" [size]="14"></app-icon>
          <span>{{ 'actions.newDownload' | translate }}</span>
        </button>

        <div class="search">
          <app-icon name="search" [size]="14"></app-icon>
          <span>{{ 'actions.search' | translate }}</span>
          <span class="spacer"></span>
          <span class="kbd">⌘K</span>
        </div>

        <nav class="nav" aria-label="Downloads categories">
          @for (item of items; track item.key) {
            <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              <span class="label">{{ item.labelKey | translate }}</span>
              <span class="count">{{ item.count }}</span>
            </a>
          }
        </nav>

        <div class="spacer-flex"></div>

        @if (sessionSpeed !== null) {
          <div class="session">
            <div class="session-label">{{ 'sidebar.sessionSpeed' | translate }}</div>
            <div class="session-value">
              <span class="num">{{ sessionSpeed | number: '1.1-1' }}</span>
              <span class="unit">MB/s</span>
            </div>
            <div class="session-bar">
              <div class="session-fill" [style.width.%]="sessionPct"></div>
            </div>
            <div class="session-foot">
              <span>{{ sessionPct | number: '1.0-0' }}% of {{ sessionCap | number: '1.0-0' }} MB/s cap</span>
            </div>
          </div>
        }

        <div class="user">
          <div class="avatar">{{ userInitials }}</div>
          <div class="user-info">
            <div class="user-name">{{ userName }}</div>
            <div class="user-meta">{{ storageFree }}</div>
          </div>
          <button class="user-settings" type="button" (click)="settings.emit()" aria-label="Settings">
            <app-icon name="settings" [size]="14"></app-icon>
          </button>
        </div>
      </div>
    </app-glass>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .glass-wrap { height: 100%; }
    :host ::ng-deep .glass-wrap > .glass { height: 100%; }

    .inner {
      height: 100%;
      padding: 22px 16px 16px;
      display: flex;
      flex-direction: column;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 6px 18px;
    }
    .brand-mark {
      width: 22px;
      height: 22px;
      border-radius: 7px;
      background: var(--text);
      color: var(--text-inverse);
      display: grid;
      place-items: center;
    }
    .brand-name {
      font-size: 14px;
      font-weight: 550;
      letter-spacing: -0.2px;
    }

    .new-btn {
      all: unset;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 11px;
      background: var(--text);
      color: var(--text-inverse);
      font-size: 13px;
      font-weight: 550;
      letter-spacing: -0.1px;
    }
    .new-btn:hover { opacity: 0.92; }

    .search {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 11px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text-dim);
      font-size: 12.5px;
    }
    .search .spacer { flex: 1; }
    .kbd {
      padding: 1px 6px;
      border-radius: 5px;
      background: oklch(0.30 0.005 260 / 0.05);
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-subtle);
      letter-spacing: 0.2px;
    }
    :host-context([data-theme="dark"]) .kbd { background: oklch(1 0 0 / 0.06); }

    .nav {
      display: flex;
      flex-direction: column;
      gap: 1px;
      margin-top: 22px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 9px;
      color: var(--text-dim);
      font-size: 12.5px;
      font-weight: 450;
      letter-spacing: -0.1px;
      text-decoration: none;
      cursor: pointer;
    }
    .nav-item:hover { background: var(--selection); }
    .nav-item.active {
      background: var(--selection);
      color: var(--text);
      font-weight: 550;
    }
    .nav-item .count {
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--text-subtle);
    }

    .spacer-flex { flex: 1; }

    .session {
      padding: 14px 12px;
      border-radius: 14px;
      background: var(--glass-hi);
      border: 1px solid var(--glass-border-2);
    }
    .session-label {
      font-size: 10.5px;
      color: var(--text-subtle);
      letter-spacing: 0.4px;
      text-transform: uppercase;
      font-weight: 500;
    }
    .session-value {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-top: 6px;
    }
    .session-value .num {
      font-size: 22px;
      font-weight: 500;
      letter-spacing: -0.8px;
      font-family: var(--font-mono);
    }
    .session-value .unit {
      font-size: 11.5px;
      color: var(--text-dim);
    }
    .session-bar {
      margin-top: 10px;
      height: 2px;
      border-radius: 1px;
      background: var(--track);
      overflow: hidden;
    }
    .session-fill {
      height: 100%;
      background: var(--fill);
      border-radius: 1px;
      transition: width .3s ease;
    }
    .session-foot {
      margin-top: 8px;
      font-size: 10.5px;
      color: var(--text-subtle);
      font-family: var(--font-mono);
    }

    .user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 4px 0;
    }
    .avatar {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      display: grid;
      place-items: center;
      font-size: 10.5px;
      font-weight: 550;
      color: var(--text-dim);
      letter-spacing: 0.3px;
    }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: 12px; font-weight: 500; }
    .user-meta { font-size: 10.5px; color: var(--text-subtle); font-family: var(--font-mono); }
    .user-settings {
      all: unset;
      cursor: pointer;
      color: var(--text-dim);
      padding: 6px;
      border-radius: 8px;
    }
    .user-settings:hover { background: var(--selection); color: var(--text); }
    @media (max-width: 760px) {
      :host {
        height: auto;
      }
      .glass-wrap {
        height: auto;
      }
      :host ::ng-deep .glass-wrap > .glass {
        height: auto;
      }
      .inner {
        height: auto;
        padding: 14px;
      }
      .brand {
        padding: 0 4px 12px;
      }
      .new-btn {
        padding: 9px 12px;
      }
      .search {
        margin-top: 8px;
      }
      .nav {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        margin-top: 12px;
      }
      .nav-item {
        padding: 8px 10px;
      }
      .spacer-flex,
      .session,
      .user {
        display: none;
      }
    }
  `],
})
export class SidebarComponent {
  @Input() items: SidebarNavItem[] = [
    { key: 'all', labelKey: 'nav.all', count: 0, path: '/queue' },
    { key: 'active', labelKey: 'nav.active', count: 0, path: '/active' },
    { key: 'queued', labelKey: 'nav.queued', count: 0, path: '/queued' },
    { key: 'scheduled', labelKey: 'nav.scheduled', count: 0, path: '/scheduled' },
    { key: 'completed', labelKey: 'nav.completed', count: 0, path: '/completed' },
    { key: 'failed', labelKey: 'nav.failed', count: 0, path: '/failed' },
  ];
  @Input() sessionSpeed: number | null = null;
  @Input() sessionCap = 80;
  @Input() userName = 'Local User';
  @Input() userInitials = 'U';
  @Input() storageFree = '—';

  @Output() newDownload = new EventEmitter<void>();
  @Output() settings = new EventEmitter<void>();

  get sessionPct(): number {
    if (this.sessionSpeed === null || this.sessionCap <= 0) return 0;
    return Math.round(Math.min(100, (this.sessionSpeed / this.sessionCap) * 100));
  }
}
