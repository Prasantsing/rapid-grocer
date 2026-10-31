import { Injectable, computed, effect, signal } from '@angular/core';
import { ThemeConfig } from './models';

export type AppTheme = 'light' | 'dark';

export interface ThemePreset {
  id: string;
  name: string;
  tagline: string;
  primary: string;
  accent: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'emerald',
    name: 'Emerald Velocity',
    tagline: 'Fresh grocery green & dynamic orange',
    primary: '#059669',
    accent: '#ea580c',
  },
  {
    id: 'sapphire',
    name: 'Sapphire Express',
    tagline: 'Electric royal blue & bright cyan',
    primary: '#2563eb',
    accent: '#06b6d4',
  },
  {
    id: 'indigo',
    name: 'Midnight Indigo',
    tagline: 'Modern deep indigo & energetic amber',
    primary: '#4f46e5',
    accent: '#f59e0b',
  },
  {
    id: 'amber',
    name: 'Sunset Amber',
    tagline: 'Warm artisanal amber & ruby rose',
    primary: '#d97706',
    accent: '#e11d48',
  },
  {
    id: 'slate',
    name: 'Executive Slate',
    tagline: 'Architectural dark slate & mint accent',
    primary: '#1e293b',
    accent: '#10b981',
  },
  {
    id: 'rose',
    name: 'Berry Bliss',
    tagline: 'Playful berry rose & violet accent',
    primary: '#e11d48',
    accent: '#8b5cf6',
  },
];

const THEME_STORAGE_KEY = 'zap_theme';
const STORE_PALETTE_KEY = 'zap_palette';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly theme = signal<AppTheme>(this.resolveInitialTheme());
  readonly isDark = computed(() => this.theme() === 'dark');

  readonly presets = THEME_PRESETS;
  readonly activePreset = signal<string>('emerald');
  readonly primaryColor = signal<string>('#059669');
  readonly accentColor = signal<string>('#ea580c');

  constructor() {
    this.restoreSavedPalette();

    // Synchronize document attribute and meta theme-color whenever theme changes
    effect(() => {
      const current = this.theme();
      this.applyThemeToDom(current);
    });

    // Listen to OS system color-scheme preference changes if no manual preference stored
    if (typeof window !== 'undefined' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          this.theme.set(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  setTheme(newTheme: AppTheme): void {
    this.theme.set(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // localStorage may fail in restricted sandboxes
    }
    this.applyThemeToDom(newTheme);
  }

  applyStoreTheme(themeConfig: ThemeConfig): void {
    if (!themeConfig) return;
    const presetId = themeConfig.preset || 'emerald';
    const primary = themeConfig.primaryColor || '#059669';
    const accent = themeConfig.accentColor || '#ea580c';

    this.activePreset.set(presetId);
    this.primaryColor.set(primary);
    this.accentColor.set(accent);

    try {
      localStorage.setItem(
        STORE_PALETTE_KEY,
        JSON.stringify({ preset: presetId, primaryColor: primary, accentColor: accent })
      );
    } catch {
      // fallback
    }

    this.applyPaletteToDom(primary, accent);
  }

  setPreset(presetId: string): void {
    const found = this.presets.find((p) => p.id === presetId);
    if (found) {
      this.activePreset.set(found.id);
      this.primaryColor.set(found.primary);
      this.accentColor.set(found.accent);
      this.applyPaletteToDom(found.primary, found.accent);
    }
  }

  setCustomPrimary(hex: string): void {
    if (this.isValidHex(hex)) {
      this.activePreset.set('custom');
      this.primaryColor.set(hex);
      this.applyPaletteToDom(hex, this.accentColor());
    }
  }

  setCustomAccent(hex: string): void {
    if (this.isValidHex(hex)) {
      this.activePreset.set('custom');
      this.accentColor.set(hex);
      this.applyPaletteToDom(this.primaryColor(), hex);
    }
  }

  private isValidHex(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  private hexToRgba(hex: string, alpha: number): string {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private ensureAccessibleLightText(hex: string): string {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex.length === 3 ? cleanHex.split('').map(c => c + c).join('') : cleanHex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    // Calculate relative luminance according to WCAG
    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;
    const lum = 0.2126 * (sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4)) +
                0.7152 * (sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4)) +
                0.0722 * (sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4));

    // If too bright for white background (contrast < 4.5:1, luminance > 0.179), darken significantly
    if (lum > 0.179) {
      const darkR = Math.max(0, Math.round(r * 0.45));
      const darkG = Math.max(0, Math.round(g * 0.45));
      const darkB = Math.max(0, Math.round(b * 0.45));
      return '#' + [darkR, darkG, darkB].map(v => v.toString(16).padStart(2, '0')).join('');
    }
    return hex;
  }

  applyPaletteToDom(primary: string, accent: string): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isLightTheme = this.theme() === 'light';

    const leafText = isLightTheme ? this.ensureAccessibleLightText(primary) : primary;

    root.style.setProperty('--leaf', primary);
    root.style.setProperty('--leaf-text', leafText);
    root.style.setProperty('--leaf-glow', this.hexToRgba(primary, isLightTheme ? 0.16 : 0.25));
    root.style.setProperty('--stepper-bg', primary);

    root.style.setProperty('--copper', accent);
    root.style.setProperty('--copper-light', accent);
    root.style.setProperty('--copper-glow', this.hexToRgba(accent, isLightTheme ? 0.12 : 0.18));

    root.style.setProperty('--mobile-nav-active-text', isLightTheme ? leafText : '#ffffff');
    root.style.setProperty('--mobile-nav-active-bg', this.hexToRgba(primary, isLightTheme ? 0.1 : 0.18));

    // Update buttons & highlights
    root.style.setProperty('--accent-brand', primary);
    root.style.setProperty('--accent-highlight', accent);
  }

  private restoreSavedPalette(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORE_PALETTE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.primaryColor && parsed.accentColor) {
          this.activePreset.set(parsed.preset || 'emerald');
          this.primaryColor.set(parsed.primaryColor);
          this.accentColor.set(parsed.accentColor);
          this.applyPaletteToDom(parsed.primaryColor, parsed.accentColor);
        }
      }
    } catch {
      // fallback
    }
  }

  private resolveInitialTheme(): AppTheme {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // fallback
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  private applyThemeToDom(theme: AppTheme): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-bs-theme', theme);
    document.body?.classList.remove('theme-light', 'theme-dark');
    document.body?.classList.add(`theme-${theme}`);
    document.body?.setAttribute('data-bs-theme', theme);

    // Re-synchronize palette text colors with current theme contrast
    this.applyPaletteToDom(this.primaryColor(), this.accentColor());

    // Update meta theme-color for mobile status bars
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0b0f15' : '#f8fafc');
    }
  }
}
