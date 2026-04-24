import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-background',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="washes" aria-hidden="true">
      <div class="wash wash-1"></div>
      <div class="wash wash-2"></div>
      <div class="wash wash-3"></div>
      <svg class="grain" width="100%" height="100%">
        <filter id="odm-grain">
          <feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#odm-grain)"/>
      </svg>
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      z-index: 0;
    }
    .washes {
      position: absolute;
      inset: 0;
    }
    .wash {
      position: absolute;
      border-radius: 50%;
      filter: blur(4px);
    }
    .wash-1 {
      top: -220px;
      left: -140px;
      width: 620px;
      height: 620px;
      background: radial-gradient(closest-side, var(--bg-wash-1), transparent 70%);
    }
    .wash-2 {
      bottom: -260px;
      right: -180px;
      width: 720px;
      height: 720px;
      background: radial-gradient(closest-side, var(--bg-wash-2), transparent 70%);
    }
    .wash-3 {
      top: 35%;
      left: 48%;
      width: 420px;
      height: 420px;
      background: radial-gradient(closest-side, var(--bg-wash-1), transparent 70%);
      opacity: 0.7;
      filter: blur(6px);
    }
    .grain {
      position: absolute;
      inset: 0;
      opacity: var(--grain-opacity);
      mix-blend-mode: var(--grain-blend);
    }
  `],
})
export class BackgroundComponent {}
