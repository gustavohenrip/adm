import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export type IconName =
  | 'plus'
  | 'search'
  | 'pause'
  | 'play'
  | 'check'
  | 'folder'
  | 'more'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'link'
  | 'trash'
  | 'arrow-down'
  | 'arrow-left'
  | 'x'
  | 'refresh'
  | 'clock';

const PATHS: Record<IconName, string> = {
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  search:
    '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  pause:
    '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>',
  play: '<path d="M8 5l11 7-11 7V5z" fill="currentColor"/>',
  check:
    '<path d="M5 12l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  folder:
    '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" stroke-width="1.4"/>',
  more:
    '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  settings:
    '<path d="M19.4 13.5a7.5 7.5 0 000-3l2-1.55-2-3.46-2.36.94a7.5 7.5 0 00-2.6-1.5L14 2h-4l-.44 2.93a7.5 7.5 0 00-2.6 1.5L4.6 5.49l-2 3.46 2 1.55a7.5 7.5 0 000 3l-2 1.55 2 3.46 2.36-.94a7.5 7.5 0 002.6 1.5L10 22h4l.44-2.93a7.5 7.5 0 002.6-1.5l2.36.94 2-3.46-2-1.55z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.3"/>',
  sun:
    '<circle cx="12" cy="12" r="3.8" stroke="currentColor" stroke-width="1.3"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4L6.9 17M17.1 6.9L18.4 5.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  moon:
    '<path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  link:
    '<path d="M10 14a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11 6M14 10a5 5 0 00-7.07 0L4.1 12.83a5 5 0 007.07 7.07L13 18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  trash:
    '<path d="M5 7h14M10 11v6M14 11v6M8 7l1-2h6l1 2M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  'arrow-down':
    '<path d="M12 5v11m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  'arrow-left':
    '<path d="M19 12H5m0 0l5-5m-5 5l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  refresh:
    '<path d="M4 12a8 8 0 0114-5.3L20 5v5h-5M20 12a8 8 0 01-14 5.3L4 19v-5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  clock:
    '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    [attr.width]="size"
    [attr.height]="size"
    viewBox="0 0 24 24"
    fill="none"
    [innerHTML]="html"
    [attr.aria-hidden]="true"
  ></svg>`,
  styles: [`:host { display: inline-flex; line-height: 0; }`],
})
export class IconComponent {
  constructor(private readonly sanitizer: DomSanitizer) {}

  @Input({ required: true }) name!: IconName;
  @Input() size = 14;

  get html(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name] ?? '');
  }
}
