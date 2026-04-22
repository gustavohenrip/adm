import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

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
  | 'arrow-down';

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
    '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  sun:
    '<circle cx="12" cy="12" r="3.8" stroke="currentColor" stroke-width="1.3"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4L6.9 17M17.1 6.9L18.4 5.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  moon:
    '<path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  link:
    '<path d="M10 14a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11 6M14 10a5 5 0 00-7.07 0L4.1 12.83a5 5 0 007.07 7.07L13 18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  'arrow-down':
    '<path d="M12 5v11m0 0l-4-4m4 4l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
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
  @Input({ required: true }) name!: IconName;
  @Input() size = 14;

  get html() {
    return PATHS[this.name] ?? '';
  }
}
