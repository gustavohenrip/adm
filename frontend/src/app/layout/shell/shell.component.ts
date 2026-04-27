import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { SidebarComponent } from '../sidebar/sidebar.component';
import { SidebarNavItem } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { BackgroundComponent } from '../../shared/components/background/background.component';
import { DownloadIntakeComponent } from '../../shared/components/download-intake/download-intake.component';
import { DownloadStore } from '../../core/api/download-store.service';
import { DownloadsService } from '../../core/api/downloads.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, BackgroundComponent, DownloadIntakeComponent],
  template: `
    <app-background></app-background>
    <div class="layout">
      <app-sidebar [items]="items()" [sessionSpeed]="sessionSpeed()" (settings)="openSettings()" (newDownload)="focusNewDownload()"></app-sidebar>
      <main class="main">
        <app-topbar
          [titleKey]="titleKey()"
          (openSettings)="openSettings()"
          (pasteUrl)="focusNewDownload()"
          (pauseAll)="pauseAll()"
          (resumeAll)="resumeAll()"
        ></app-topbar>
        <section class="content">
          <router-outlet></router-outlet>
        </section>
      </main>
    </div>
    <app-download-intake></app-download-intake>
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
      height: 100%;
      overflow: hidden;
      background: var(--bg-base);
      color: var(--text);
    }
    .layout {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 232px 1fr;
      height: 100%;
      padding: 16px;
      gap: 16px;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 0;
    }
    .content {
      flex: 1;
      min-height: 0;
      display: flex;
    }
    .content > router-outlet + * {
      flex: 1;
      min-height: 0;
    }
    @media (max-width: 760px) {
      :host {
        min-height: 100%;
        height: auto;
        overflow: auto;
      }
      .layout {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        height: auto;
        padding: 10px;
        gap: 10px;
      }
      .main {
        min-height: 620px;
      }
      .content {
        min-height: 500px;
      }
    }
  `],
})
export class ShellComponent implements OnInit {
  private readonly store = inject(DownloadStore);
  private readonly api = inject(DownloadsService);
  private readonly router = inject(Router);

  readonly downloads = this.store.downloads;
  readonly scope = signal(this.scopeFromUrl(this.router.url));
  readonly titleKey = computed(() => {
    const scope = this.scope();
    if (scope === 'settings') return 'settings.title';
    if (scope === 'schedule' || scope === 'scheduled') return 'schedule.title';
    return `nav.${scope === 'queue' ? 'all' : scope}`;
  });
  readonly sessionSpeed = computed(() => this.downloads().reduce((acc, download) => acc + download.speedBps, 0) / (1024 * 1024));
  readonly items = computed<SidebarNavItem[]>(() => {
    const downloads = this.downloads();
    return [
      { key: 'all', labelKey: 'nav.all', count: downloads.length, path: '/queue' },
      { key: 'active', labelKey: 'nav.active', count: downloads.filter((d) => d.status === 'downloading').length, path: '/active' },
      { key: 'queued', labelKey: 'nav.queued', count: downloads.filter((d) => d.status === 'queued' || d.status === 'paused').length, path: '/queued' },
      { key: 'scheduled', labelKey: 'nav.scheduled', count: 0, path: '/schedule' },
      { key: 'completed', labelKey: 'nav.completed', count: downloads.filter((d) => d.status === 'complete').length, path: '/completed' },
      { key: 'failed', labelKey: 'nav.failed', count: downloads.filter((d) => d.status === 'failed').length, path: '/failed' },
    ];
  });

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.scope.set(this.scopeFromUrl(this.router.url));
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  openSettings(): void {
    this.router.navigateByUrl('/settings');
  }

  focusNewDownload(): void {
    this.router.navigateByUrl('/queue').then(() => {
      setTimeout(() => document.querySelector<HTMLInputElement>('input[name="url"]')?.focus(), 0);
    });
  }

  pauseAll(): void {
    this.api.pauseAll().subscribe();
  }

  resumeAll(): void {
    this.api.resumeAll().subscribe();
  }

  private scopeFromUrl(url: string): string {
    const path = url.split('?')[0].replace(/^\/+/, '');
    return path || 'queue';
  }
}
