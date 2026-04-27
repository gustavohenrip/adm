import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { GlassComponent } from '../../shared/components/glass/glass.component';
import { IconComponent } from '../../shared/icons/icons.component';
import { SUPPORTED_LANGUAGES } from '../../core/i18n/translate-loader.factory';
import { ThemeService } from '../../core/theme/theme.service';
import { SettingsMap, SettingsService } from '../../core/api/settings.service';

interface SettingsState {
  downloadRoot: string;
  defaultSegments: number;
  maxSegments: number;
  rateLimitKbps: number;
  proxyKind: 'NONE' | 'HTTP' | 'SOCKS';
  proxyHost: string;
  proxyPort: number;
  torrentEnabled: boolean;
  dhtEnabled: boolean;
  lsdEnabled: boolean;
  listenPort: number;
  clipboardWatch: boolean;
  trayEnabled: boolean;
  autoUpdate: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslateModule, GlassComponent, IconComponent],
  template: `
    <app-glass class="wrap" [radius]="18">
      <div class="panel">
        <header class="head">
          <button class="back" type="button" (click)="goBack()" aria-label="Back">
            <app-icon name="arrow-left" [size]="16"></app-icon>
            <span>{{ 'actions.back' | translate }}</span>
          </button>
          <h2>{{ 'settings.title' | translate }}</h2>
          <div class="head-actions">
            <button class="save" type="button" [disabled]="busy()" (click)="save()">{{ 'settings.save' | translate }}</button>
          </div>
        </header>

        <div class="page">
          <div class="grid">
            <section class="card">
              <header class="card-head">
                <h3>{{ 'settings.appearance' | translate }}</h3>
                <p>{{ 'settings.appearanceHint' | translate }}</p>
              </header>
              <div class="row">
                <label>{{ 'settings.theme' | translate }}</label>
                <select [value]="theme()" (change)="setTheme($any($event.target).value)">
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div class="row">
                <label>{{ 'settings.language' | translate }}</label>
                <select [value]="currentLang()" (change)="setLang($any($event.target).value)">
                  @for (l of languages; track l.code) {
                    <option [value]="l.code">{{ l.label }}</option>
                  }
                </select>
              </div>
            </section>

            <section class="card">
              <header class="card-head">
                <h3>{{ 'settings.downloads' | translate }}</h3>
                <p>{{ 'settings.downloadsHint' | translate }}</p>
              </header>
              <div class="row">
                <label>{{ 'settings.downloadRoot' | translate }}</label>
                <input type="text" [(ngModel)]="state.downloadRoot" />
              </div>
              <div class="row">
                <label>{{ 'settings.defaultSegments' | translate }}</label>
                <input type="number" min="1" max="64" [(ngModel)]="state.defaultSegments" />
              </div>
              <div class="row">
                <label>{{ 'settings.maxSegments' | translate }}</label>
                <input type="number" min="1" max="64" [(ngModel)]="state.maxSegments" />
              </div>
              <div class="row">
                <label>{{ 'settings.rateLimit' | translate }}</label>
                <div class="with-unit">
                  <input type="number" min="0" [(ngModel)]="state.rateLimitKbps" />
                  <span class="unit">KB/s</span>
                </div>
              </div>
            </section>

            <section class="card">
              <header class="card-head">
                <h3>{{ 'settings.network' | translate }}</h3>
                <p>{{ 'settings.networkHint' | translate }}</p>
              </header>
              <div class="row">
                <label>{{ 'settings.proxy' | translate }}</label>
                <select [(ngModel)]="state.proxyKind">
                  <option value="NONE">None</option>
                  <option value="HTTP">HTTP</option>
                  <option value="SOCKS">SOCKS</option>
                </select>
              </div>
              @if (state.proxyKind !== 'NONE') {
                <div class="row">
                  <label>{{ 'settings.proxyHost' | translate }}</label>
                  <input type="text" [(ngModel)]="state.proxyHost" />
                </div>
                <div class="row">
                  <label>{{ 'settings.proxyPort' | translate }}</label>
                  <input type="number" [(ngModel)]="state.proxyPort" />
                </div>
              }
            </section>

            <section class="card">
              <header class="card-head">
                <h3>Torrent</h3>
                <p>{{ 'settings.torrentHint' | translate }}</p>
              </header>
              <div class="toggle">
                <div class="toggle-text">
                  <strong>{{ 'settings.torrentEnabled' | translate }}</strong>
                  <span>{{ 'settings.torrentEnabledHint' | translate }}</span>
                </div>
                <input type="checkbox" [(ngModel)]="state.torrentEnabled" />
              </div>
              <div class="toggle">
                <div class="toggle-text">
                  <strong>DHT</strong>
                  <span>{{ 'settings.dhtHint' | translate }}</span>
                </div>
                <input type="checkbox" [(ngModel)]="state.dhtEnabled" />
              </div>
              <div class="toggle">
                <div class="toggle-text">
                  <strong>{{ 'settings.lsd' | translate }}</strong>
                  <span>{{ 'settings.lsdHint' | translate }}</span>
                </div>
                <input type="checkbox" [(ngModel)]="state.lsdEnabled" />
              </div>
              <div class="row">
                <label>{{ 'settings.listenPort' | translate }}</label>
                <input type="number" min="0" max="65535" [(ngModel)]="state.listenPort" />
              </div>
            </section>

            <section class="card">
              <header class="card-head">
                <h3>{{ 'settings.system' | translate }}</h3>
                <p>{{ 'settings.systemHint' | translate }}</p>
              </header>
              <div class="toggle">
                <div class="toggle-text">
                  <strong>{{ 'settings.clipboard' | translate }}</strong>
                  <span>{{ 'settings.clipboardHint' | translate }}</span>
                </div>
                <input type="checkbox" [(ngModel)]="state.clipboardWatch" />
              </div>
              <div class="toggle">
                <div class="toggle-text">
                  <strong>{{ 'settings.tray' | translate }}</strong>
                  <span>{{ 'settings.trayHint' | translate }}</span>
                </div>
                <input type="checkbox" [(ngModel)]="state.trayEnabled" />
              </div>
              <div class="toggle">
                <div class="toggle-text">
                  <strong>{{ 'settings.autoUpdate' | translate }}</strong>
                  <span>{{ 'settings.autoUpdateHint' | translate }}</span>
                </div>
                <input type="checkbox" [(ngModel)]="state.autoUpdate" />
              </div>
            </section>
          </div>

          @if (saveState()) {
            <div class="save-state" [class.err]="saveState() === 'Could not save settings'">{{ saveState() }}</div>
          }
        </div>
      </div>
    </app-glass>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; }
    .wrap { flex: 1; display: flex; min-height: 0; }
    :host ::ng-deep .wrap > .glass { flex: 1; display: flex; min-height: 0; }
    .panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .head {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--hairline);
      background: var(--glass-hi);
    }
    .back {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px 7px 9px;
      border-radius: 9px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text-dim);
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .back:hover {
      background: var(--glass-hi);
      border-color: var(--glass-border-2);
      color: var(--text);
    }
    .head h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.3px;
      color: var(--text);
    }
    .head-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .save {
      padding: 9px 18px;
      border-radius: 10px;
      background: var(--text);
      color: var(--text-inverse);
      border: 0;
      font-weight: 600;
      font-size: 12.5px;
      cursor: pointer;
    }
    .save:disabled { opacity: 0.55; cursor: not-allowed; }

    .page {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 28px clamp(20px, 6vw, 80px);
      display: flex;
      flex-direction: column;
      gap: 14px;
      color: var(--text);
    }
    .grid {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 20px 22px;
      background: var(--glass-hi);
      border: 1px solid var(--glass-border-2);
      border-radius: 14px;
    }
    .card-head {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--hairline);
    }
    .card-head h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      letter-spacing: -0.1px;
      text-transform: none;
    }
    .card-head p {
      margin: 0;
      font-size: 11.5px;
      color: var(--text-subtle);
      line-height: 1.4;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(140px, 200px) 1fr;
      align-items: center;
      gap: 14px;
      font-size: 13px;
    }
    .row label { color: var(--text-dim); font-size: 12.5px; }
    .row input[type="text"],
    .row input[type="number"],
    .row select {
      width: 100%;
      min-width: 0;
      padding: 8px 12px;
      border-radius: 9px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text);
      font: inherit;
      font-size: 12.5px;
      outline: none;
    }
    .row input:focus,
    .row select:focus {
      border-color: var(--glass-border-2);
      background: var(--glass-hi);
    }

    .with-unit {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
    }
    .unit { font-family: var(--font-mono); color: var(--text-subtle); font-size: 11px; }

    .toggle {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 14px;
      padding: 10px 0;
      border-bottom: 1px solid var(--hairline);
    }
    .toggle:last-of-type { border-bottom: 0; }
    .toggle-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .toggle-text strong {
      font-size: 12.5px;
      font-weight: 550;
      color: var(--text);
    }
    .toggle-text span {
      font-size: 11px;
      color: var(--text-subtle);
      line-height: 1.4;
    }
    .toggle input[type="checkbox"] {
      accent-color: var(--text);
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .save-state {
      font-size: 12px;
      color: var(--text-dim);
      padding: 4px 2px;
    }
    .save-state.err { color: var(--text); }

    @media (max-width: 760px) {
      .head { padding: 12px 14px; gap: 10px; }
      .head h2 { font-size: 15px; }
      .back span { display: none; }
      .page { padding: 14px; gap: 12px; }
      .card { padding: 16px; }
      .row { grid-template-columns: 1fr; gap: 6px; }
    }
  `],
})
export class SettingsComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly translate = inject(TranslateService);
  private readonly settings = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly location = inject(Location);

  readonly theme = this.themeService.theme;
  readonly currentLang = signal(this.translate.currentLang || 'en');
  readonly languages = SUPPORTED_LANGUAGES;
  readonly busy = signal(false);
  readonly saveState = signal('');

  state: SettingsState = {
    downloadRoot: '~/Downloads/ODM',
    defaultSegments: 16,
    maxSegments: 64,
    rateLimitKbps: 0,
    proxyKind: 'NONE',
    proxyHost: '',
    proxyPort: 0,
    torrentEnabled: true,
    dhtEnabled: true,
    lsdEnabled: true,
    listenPort: 6881,
    clipboardWatch: true,
    trayEnabled: true,
    autoUpdate: true,
  };

  ngOnInit(): void {
    this.settings.get().subscribe({
      next: (values) => {
        this.apply(values);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saveState.set('Could not load settings');
        this.cdr.markForCheck();
      },
    });
  }

  goBack(): void {
    this.location.back();
  }

  setTheme(value: 'light' | 'dark') {
    this.themeService.set(value);
  }

  setLang(code: string) {
    this.translate.use(code);
    this.currentLang.set(code);
    const rtl = this.languages.find((l) => l.code === code)?.rtl;
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  }

  save(): void {
    this.busy.set(true);
    this.saveState.set('');
    this.settings.save(this.values()).subscribe({
      next: (values) => {
        this.apply(values);
        this.busy.set(false);
        this.saveState.set('Settings saved');
        this.cdr.markForCheck();
      },
      error: () => {
        this.busy.set(false);
        this.saveState.set('Could not save settings');
        this.cdr.markForCheck();
      },
    });
  }

  private apply(values: SettingsMap): void {
    this.state = {
      downloadRoot: this.stringValue(values['downloadRoot'], this.state.downloadRoot),
      defaultSegments: this.numberValue(values['defaultSegments'], this.state.defaultSegments),
      maxSegments: this.numberValue(values['maxSegments'], this.state.maxSegments),
      rateLimitKbps: this.numberValue(values['rateLimitKbps'], this.state.rateLimitKbps),
      proxyKind: this.proxyKind(values['proxyKind']),
      proxyHost: this.stringValue(values['proxyHost'], ''),
      proxyPort: this.numberValue(values['proxyPort'], 0),
      torrentEnabled: this.booleanValue(values['torrentEnabled'], this.state.torrentEnabled),
      dhtEnabled: this.booleanValue(values['dhtEnabled'], this.state.dhtEnabled),
      lsdEnabled: this.booleanValue(values['lsdEnabled'], this.state.lsdEnabled),
      listenPort: this.numberValue(values['listenPort'], this.state.listenPort),
      clipboardWatch: this.booleanValue(values['clipboardWatch'], this.state.clipboardWatch),
      trayEnabled: this.booleanValue(values['trayEnabled'], this.state.trayEnabled),
      autoUpdate: this.booleanValue(values['autoUpdate'], this.state.autoUpdate),
    };
  }

  private values(): SettingsMap {
    return {
      downloadRoot: this.state.downloadRoot,
      defaultSegments: String(this.state.defaultSegments),
      maxSegments: String(this.state.maxSegments),
      rateLimitKbps: String(this.state.rateLimitKbps),
      proxyKind: this.state.proxyKind,
      proxyHost: this.state.proxyHost,
      proxyPort: String(this.state.proxyPort),
      torrentEnabled: String(this.state.torrentEnabled),
      dhtEnabled: String(this.state.dhtEnabled),
      lsdEnabled: String(this.state.lsdEnabled),
      listenPort: String(this.state.listenPort),
      clipboardWatch: String(this.state.clipboardWatch),
      trayEnabled: String(this.state.trayEnabled),
      autoUpdate: String(this.state.autoUpdate),
    };
  }

  private stringValue(value: string | undefined, fallback: string): string {
    return value?.trim() || fallback;
  }

  private numberValue(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private booleanValue(value: string | undefined, fallback: boolean): boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  private proxyKind(value: string | undefined): SettingsState['proxyKind'] {
    return value === 'HTTP' || value === 'SOCKS' ? value : 'NONE';
  }
}
