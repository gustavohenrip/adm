import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'adm.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.readInitial());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  set(theme: Theme): void {
    this._theme.set(theme);
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }

  toggle(): void {
    this.set(this._theme() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }

  private readInitial(): Theme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }
}
