import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DownloadIntakeService } from '../../../core/api/download-intake.service';
import { formatBytes } from '../../format/format';

@Component({
  selector: 'app-download-intake',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (intake.pending(); as item) {
      <div class="backdrop" (click)="intake.cancel()">
        <section class="dialog" role="dialog" aria-modal="true" aria-label="Confirmar download" (click)="$event.stopPropagation()">
          <div class="top">
            <div>
              <p class="eyebrow">{{ item.kind === 'torrent' ? 'Torrent detectado' : 'Download detectado' }}</p>
              <h2>{{ item.name }}</h2>
            </div>
            <button class="ghost icon" type="button" (click)="intake.cancel()" aria-label="Fechar">×</button>
          </div>

          <div class="details">
            <div>
              <span>Origem</span>
              <strong>{{ item.source }}</strong>
            </div>
            <div>
              <span>Tamanho</span>
              <strong>{{ item.sizeBytes > 0 ? bytes(item.sizeBytes) : 'A detectar' }}</strong>
            </div>
            <div>
              <span>Tipo</span>
              <strong>{{ item.kind === 'torrent' ? 'BitTorrent' : 'HTTP' }}</strong>
            </div>
            <div>
              <span>Conexões</span>
              <strong>{{ item.kind === 'http' && item.acceptsRanges ? item.segments + ' segmentos' : 'Automático' }}</strong>
            </div>
          </div>

          <div class="url">{{ item.url }}</div>

          <div class="folder-mode">
            <label>
              <input type="radio" name="folderMode" [checked]="intake.useDefaultFolder()" (change)="intake.useDefaultFolder.set(true)" />
              <span>Pasta padrão</span>
            </label>
            <label>
              <input type="radio" name="folderMode" [checked]="!intake.useDefaultFolder()" (change)="intake.useDefaultFolder.set(false)" />
              <span>Outra pasta</span>
            </label>
          </div>

          <div class="folder">
            <input
              type="text"
              [disabled]="intake.useDefaultFolder()"
              [ngModel]="intake.selectedFolder()"
              (ngModelChange)="intake.selectedFolder.set($event)"
            />
            <button class="ghost" type="button" [disabled]="intake.useDefaultFolder()" (click)="intake.chooseFolder()">Escolher</button>
          </div>

          @if (intake.error()) {
            <div class="error" role="alert">{{ intake.error() }}</div>
          }

          <div class="actions">
            <button class="ghost" type="button" [disabled]="intake.busy()" (click)="intake.cancel()">Cancelar</button>
            <button class="primary" type="button" [disabled]="intake.busy()" (click)="intake.confirm()">Iniciar download</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 20;
      display: grid;
      place-items: center;
      padding: 24px;
      background: oklch(0 0 0 / 0.42);
      backdrop-filter: blur(18px);
    }
    .dialog {
      width: min(680px, 100%);
      border-radius: 18px;
      border: 1px solid var(--glass-border-2);
      background: var(--glass);
      box-shadow: var(--shadow);
      color: var(--text);
      padding: 22px;
    }
    .top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .eyebrow {
      margin: 0 0 6px;
      color: var(--text-subtle);
      font-size: 11px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.2;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .details {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 22px;
    }
    .details div {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    .details span {
      color: var(--text-subtle);
      font-size: 10.5px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .details strong {
      font-size: 12.5px;
      font-weight: 550;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .url {
      margin-top: 18px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--chip);
      border: 1px solid var(--chip-border);
      color: var(--text-dim);
      font-family: var(--font-mono);
      font-size: 11px;
      overflow-wrap: anywhere;
      max-height: 82px;
      overflow: auto;
    }
    .folder-mode {
      display: flex;
      gap: 16px;
      margin-top: 18px;
      color: var(--text-dim);
      font-size: 13px;
    }
    .folder-mode label {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    input[type="radio"] {
      accent-color: var(--fill);
    }
    .folder {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      margin-top: 10px;
    }
    .folder input {
      min-width: 0;
      height: 36px;
      border-radius: 9px;
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--text);
      padding: 0 12px;
      font: inherit;
      font-size: 12.5px;
    }
    .folder input:disabled {
      opacity: 0.62;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 22px;
    }
    button {
      height: 36px;
      border-radius: 9px;
      padding: 0 14px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .primary {
      border: 0;
      background: var(--text);
      color: var(--text-inverse);
    }
    .ghost {
      border: 1px solid var(--chip-border);
      background: var(--chip);
      color: var(--text);
    }
    .icon {
      width: 34px;
      padding: 0;
      font-size: 22px;
      line-height: 1;
    }
    .error {
      margin-top: 12px;
      color: var(--text);
      background: var(--selection);
      border-radius: 9px;
      padding: 9px 11px;
      font-size: 12px;
    }
    @media (max-width: 760px) {
      .backdrop {
        align-items: end;
        padding: 10px;
      }
      .dialog {
        border-radius: 16px;
        padding: 18px;
      }
      .details {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .folder {
        grid-template-columns: 1fr;
      }
      .actions {
        flex-direction: column-reverse;
      }
      .actions button {
        width: 100%;
      }
    }
  `],
})
export class DownloadIntakeComponent {
  protected readonly intake = inject(DownloadIntakeService);

  protected bytes(value: number): string {
    return formatBytes(value);
  }
}
