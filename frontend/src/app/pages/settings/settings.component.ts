import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { GlassComponent } from '../../shared/components/glass/glass.component';
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
  imports: [FormsModule, TranslateModule, GlassComponent],
  template: `
    <app-glass [radius]="18">
      <div class="page">
        <h2>{{ 'settings.title' | translate }}</h2>

        <section>
          <h3>{{ 'settings.appearance' | translate }}</h3>
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

        <section>
          <h3>{{ 'settings.downloads' | translate }}</h3>
          <div class="row">
            <label>{{ 'settings.downloadRoot' | translate }}</label>
            <input type="text" [(ngModel)]="state.downloadRoot" />
          </div>
          <div class="row">
            <label>{{ 'settings.defaultSegments' | translate }}</label>
            <input type="number" min="1" max="64" [(ngModel)]="state.defaultSegments" />
          </div>
          <div class="row">
            <label>Max segments</label>
            <input type="number" min="1" max="64" [(ngModel)]="state.maxSegments" />
          </div>
          <div class="row">
            <label>{{ 'settings.rateLimit' | translate }}</label>
            <input type="number" min="0" [(ngModel)]="state.rateLimitKbps" />
            <span class="unit">KB/s</span>
          </div>
        </section>

        <section>
          <h3>{{ 'settings.network' | translate }}</h3>
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
              <label>Host</label>
              <input type="text" [(ngModel)]="state.proxyHost" />
            </div>
            <div class="row">
              <label>Port</label>
              <input type="number" [(ngModel)]="state.proxyPort" />
            </div>
          }
        </section>

        <section>
          <h3>Torrent</h3>
          <div class="row">
            <label>Torrent downloads</label>
            <input type="checkbox" [(ngModel)]="state.torrentEnabled" />
          </div>
          <div class="row">
            <label>DHT</label>
            <input type="checkbox" [(ngModel)]="state.dhtEnabled" />
          </div>
          <div class="row">
            <label>Local discovery</label>
            <input type="checkbox" [(ngModel)]="state.lsdEnabled" />
          </div>
          <div class="row">
            <label>Listen port</label>
            <input type="number" min="0" max="65535" [(ngModel)]="state.listenPort" />
          </div>
        </section>

        <section>
          <h3>{{ 'settings.system' | translate }}</h3>
          <div class="row">
            <label>{{ 'settings.clipboard' | translate }}</label>
            <input type="checkbox" [(ngModel)]="state.clipboardWatch" />
          </div>
          <div class="row">
            <label>{{ 'settings.tray' | translate }}</label>
            <input type="checkbox" [(ngModel)]="state.trayEnabled" />
          </div>
          <div class="row">
            <label>{{ 'settings.autoUpdate' | translate }}</label>
            <input type="checkbox" [(ngModel)]="state.autoUpdate" />
          </div>
        </section>

        <button class="save" type="button" [disabled]="busy()" (click)="save()">{{ 'settings.save' | translate }}</button>
        @if (saveState()) {
          <div class="save-state" [class.err]="saveState() === 'Could not save settings'">{{ saveState() }}</div>
        }
      </div>
    </app-glass>
  `,
  styles: [`
    :host { display: flex; flex: 1; min-height: 0; }
    :host ::ng-deep app-glass { flex: 1; display: flex; }
    .page {
      padding: 28px 36px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
      color: var(--text);
    }
    h2 { font-size: 20px; font-weight: 600; letter-spacing: -0.3px; margin: 0; }
    h3 {
      font-size: 11px;
      color: var(--text-subtle);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 500;
      margin: 0 0 6px;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 18px 20px;
      background: var(--glass-hi);
      border: 1px solid var(--glass-border-2);
      border-radius: 14px;
    }
    .row {
      display: grid;
      grid-template-columns: 220px 1fr auto;
      align-items: center;
      gap: 16px;
      font-size: 13px;
    }
    label { color: var(--text-dim); }
    input[type="text"], input[type="number"], select {
      width: 100%;
      padding: 8px 12px;
      border-radius: 9px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text);
      font: inherit;
    }
    input[type="checkbox"] { accent-color: var(--fill); }
    .unit { font-family: var(--font-mono); color: var(--text-subtle); font-size: 11px; }
    .save {
      align-self: flex-start;
      padding: 10px 18px;
      border-radius: 11px;
      background: var(--text);
      color: var(--text-inverse);
      border: 0;
      font-weight: 550;
      font-size: 13px;
    }
    .save:disabled { opacity: 0.55; cursor: not-allowed; }
    .save-state {
      font-size: 12px;
      color: var(--text-dim);
      min-height: 18px;
    }
    .save-state.err { color: var(--text); }
    @media (max-width: 760px) {
      .page {
        padding: 18px;
      }
      section {
        padding: 14px;
      }
      .row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .unit {
        display: none;
      }
    }
  `],
})
export class SettingsComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly translate = inject(TranslateService);
  private readonly settings = inject(SettingsService);
  private readonly cdr = inject(ChangeDetectorRef);

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
