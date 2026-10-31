import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
    tagline: 'Fresh grocery green & vibrant tangerine',
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
  {
    id: 'teal',
    name: 'Mint & Coral',
    tagline: 'Crisp botanical teal & warm coral glow',
    primary: '#0d9488',
    accent: '#f97316',
  },
  {
    id: 'violet',
    name: 'Royal Purple',
    tagline: 'Luxe royal purple & gold citrus accent',
    primary: '#7c3aed',
    accent: '#eab308',
  },
];

const THEME_STORAGE_KEY = 'zap_theme';
const STORE_PALETTE_KEY = 'zap_palette';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly http = inject(HttpClient);

  readonly theme = signal<AppTheme>(this.resolveInitialTheme());
  readonly isDark = computed(() => this.theme() === 'dark');

  readonly presets = THEME_PRESETS;
  readonly activePreset = signal<string>('emerald');
  readonly primaryColor = signal<string>('#059669');
  readonly accentColor = signal<string>('#ea580c');
  readonly isSaving = signal<boolean>(false);

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

  /**
   * Persists the selected primary and accent colors to the MongoDB database
   * via Admin StoreConfig endpoint, updates local cache, and applies CSS variables globally.
   */
  async saveThemeToDatabase(
    primary: string,
    accent: string,
    preset = 'custom'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isValidHex(primary)) {
      return { success: false, error: 'Invalid primary color format. Must be a hex color code (e.g. #059669).' };
    }
    if (!this.isValidHex(accent)) {
      return { success: false, error: 'Invalid accent color format. Must be a hex color code (e.g. #ea580c).' };
    }

    this.isSaving.set(true);
    try {
      const payload = {
        theme: {
          preset,
          primaryColor: primary,
          accentColor: accent,
          surfaceMode: 'slate-contrast',
        },
      };

      await firstValueFrom(
        this.http.put<{ status: string; data: unknown }>('/api/v1/admin/store/config', payload)
      );

      this.activePreset.set(preset);
      this.primaryColor.set(primary);
      this.accentColor.set(accent);

      try {
        localStorage.setItem(
          STORE_PALETTE_KEY,
          JSON.stringify({ preset, primaryColor: primary, accentColor: accent })
        );
      } catch {
        // fallback
      }

      this.applyPaletteToDom(primary, accent);
      return { success: true };
    } catch (err: unknown) {
      const apiErr = err as { error?: { message?: string }; message?: string };
      const msg = apiErr?.error?.message || apiErr?.message || 'Failed to save theme to database';
      return { success: false, error: msg };
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Resets theme to the factory Emerald Velocity defaults and saves to database.
   */
  async resetToDefault(): Promise<{ success: boolean; error?: string }> {
    const defaultPreset = this.presets[0]; // emerald
    return this.saveThemeToDatabase(defaultPreset.primary, defaultPreset.accent, defaultPreset.id);
  }

  /**
   * Fetches latest theme from database store configuration.
   */
  async loadThemeFromDatabase(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ status: string; data?: { theme?: ThemeConfig } }>('/api/v1/store/config')
      );
      if (res?.data?.theme) {
        this.applyStoreTheme(res.data.theme);
      }
    } catch {
      // Fall back to saved local palette
      this.restoreSavedPalette();
    }
  }

  isValidHex(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  private hexToRgba(hex: string, alpha: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private calculateLuminance(r: number, g: number, b: number): number {
    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;
    const lR = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const lG = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const lB = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);
    return 0.2126 * lR + 0.7152 * lG + 0.0722 * lB;
  }

  getContrastRatio(fgHex: string, bgHex: string): number {
    if (!this.isValidHex(fgHex) || !this.isValidHex(bgHex)) return 1;
    const rgb1 = this.hexToRgb(fgHex);
    const rgb2 = this.hexToRgb(bgHex);
    const lum1 = this.calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.calculateLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return Math.round(((brightest + 0.05) / (darkest + 0.05)) * 10) / 10;
  }

  private ensureAccessibleLightText(hex: string): string {
    const { r, g, b } = this.hexToRgb(hex);
    const lum = this.calculateLuminance(r, g, b);

    // If too bright for white background (contrast < 4.5:1, luminance > 0.179), darken significantly
    if (lum > 0.179) {
      const darkR = Math.max(0, Math.round(r * 0.45));
      const darkG = Math.max(0, Math.round(g * 0.45));
      const darkB = Math.max(0, Math.round(b * 0.45));
      return '#' + [darkR, darkG, darkB].map((v) => v.toString(16).padStart(2, '0')).join('');
    }
    return hex;
  }

  applyPaletteToDom(primary: string, accent: string): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isLightTheme = this.theme() === 'light';

    const leafText = isLightTheme ? this.ensureAccessibleLightText(primary) : primary;
    const rgbPrimary = this.hexToRgb(primary);
    const rgbAccent = this.hexToRgb(accent);

    // Global CSS Variables
    root.style.setProperty('--primary-color', primary);
    root.style.setProperty('--accent-color', accent);
    root.style.setProperty('--primary-rgb', `${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}`);
    root.style.setProperty('--accent-rgb', `${rgbAccent.r}, ${rgbAccent.g}, ${rgbAccent.b}`);

    // Brand and component tokens
    root.style.setProperty('--leaf', primary);
    root.style.setProperty('--leaf-text', leafText);
    root.style.setProperty('--leaf-glow', this.hexToRgba(primary, isLightTheme ? 0.16 : 0.25));
    root.style.setProperty('--stepper-bg', primary);

    root.style.setProperty('--copper', accent);
    root.style.setProperty('--copper-light', accent);
    root.style.setProperty('--copper-glow', this.hexToRgba(accent, isLightTheme ? 0.12 : 0.18));

    root.style.setProperty('--mobile-nav-active-text', isLightTheme ? leafText : '#ffffff');
    root.style.setProperty('--mobile-nav-active-bg', this.hexToRgba(primary, isLightTheme ? 0.1 : 0.18));

    // Bootstrap and component interop
    root.style.setProperty('--bs-primary', primary);
    root.style.setProperty('--bs-primary-rgb', `${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}`);
    root.style.setProperty('--accent-brand', primary);
    root.style.setProperty('--accent-highlight', accent);
    root.style.setProperty('--accent', accent);
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
