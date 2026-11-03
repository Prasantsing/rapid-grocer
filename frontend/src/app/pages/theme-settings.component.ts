import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemePreset, ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-theme-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './theme-settings.component.html',
  styleUrl: './theme-settings.component.scss',
})
export class ThemeSettingsComponent {
  readonly themeService = inject(ThemeService);
  private readonly toasts = inject(ToastService);

  readonly currentPrimary = signal<string>(this.themeService.primaryColor());
  readonly currentAccent = signal<string>(this.themeService.accentColor());
  readonly previewDark = signal<boolean>(false);
  readonly saveSuccessMessage = signal<string>('');
  readonly saveErrorMessage = signal<string>('');
  readonly hasCopied = signal<boolean>(false);

  readonly quickPrimaryShades = [
    '#059669', // Emerald
    '#15803d', // Forest
    '#2563eb', // Royal Blue
    '#0d9488', // Teal
    '#4f46e5', // Indigo
    '#7c3aed', // Purple
    '#e11d48', // Berry
    '#0284c7', // Sky
  ];

  readonly quickAccentShades = [
    '#ea580c', // Tangerine
    '#d97706', // Amber
    '#f97316', // Orange
    '#f43f5e', // Rose
    '#06b6d4', // Cyan
    '#eab308', // Gold
    '#10b981', // Mint
    '#8b5cf6', // Violet
  ];

  readonly primaryRgb = computed(() => {
    const { r, g, b } = this.themeService.hexToRgb(this.currentPrimary());
    return `${r}, ${g}, ${b}`;
  });

  readonly accentRgb = computed(() => {
    const { r, g, b } = this.themeService.hexToRgb(this.currentAccent());
    return `${r}, ${g}, ${b}`;
  });

  readonly contrastWhite = computed(() => {
    return this.themeService.getContrastRatio(this.currentPrimary(), '#ffffff');
  });

  readonly contrastDark = computed(() => {
    return this.themeService.getContrastRatio(this.currentAccent(), '#0f172a');
  });

  constructor() {
    this.currentPrimary.set(this.themeService.primaryColor());
    this.currentAccent.set(this.themeService.accentColor());
    this.previewDark.set(this.themeService.isDark());
  }

  isPrimaryValid(): boolean {
    return this.themeService.isValidHex(this.currentPrimary());
  }

  isAccentValid(): boolean {
    return this.themeService.isValidHex(this.currentAccent());
  }

  isHexValid(): boolean {
    return this.isPrimaryValid() && this.isAccentValid();
  }

  cleanHex(hex: string): string {
    return hex.replace('#', '');
  }

  onPrimaryColorChange(color: string): void {
    if (this.themeService.isValidHex(color)) {
      this.currentPrimary.set(color);
      this.themeService.setCustomPrimary(color);
      this.saveSuccessMessage.set('');
    }
  }

  onPrimaryHexInput(val: string): void {
    const formatted = '#' + val.trim();
    if (this.themeService.isValidHex(formatted)) {
      this.currentPrimary.set(formatted);
      this.themeService.setCustomPrimary(formatted);
      this.saveSuccessMessage.set('');
    }
  }

  onAccentColorChange(color: string): void {
    if (this.themeService.isValidHex(color)) {
      this.currentAccent.set(color);
      this.themeService.setCustomAccent(color);
      this.saveSuccessMessage.set('');
    }
  }

  onAccentHexInput(val: string): void {
    const formatted = '#' + val.trim();
    if (this.themeService.isValidHex(formatted)) {
      this.currentAccent.set(formatted);
      this.themeService.setCustomAccent(formatted);
      this.saveSuccessMessage.set('');
    }
  }

  selectPreset(preset: ThemePreset): void {
    this.currentPrimary.set(preset.primary);
    this.currentAccent.set(preset.accent);
    this.themeService.setPreset(preset.id);
    this.saveSuccessMessage.set('');
  }

  togglePreviewTheme(): void {
    this.previewDark.update((v) => !v);
  }

  async saveTheme(): Promise<void> {
    if (!this.isHexValid()) return;

    this.saveSuccessMessage.set('');
    this.saveErrorMessage.set('');

    const res = await this.themeService.saveThemeToDatabase(
      this.currentPrimary(),
      this.currentAccent(),
      this.themeService.activePreset()
    );

    if (res.success) {
      this.saveSuccessMessage.set(
        `Theme settings saved successfully to the database! Active palette: Primary ${this.currentPrimary()}, Accent ${this.currentAccent()}`
      );
      this.toasts.show('Theme settings saved to database & applied globally!');
    } else {
      this.saveErrorMessage.set(res.error || 'Failed to save theme to database');
      this.toasts.error(res.error || 'Failed to save theme');
    }
  }

  async resetToDefaults(): Promise<void> {
    const res = await this.themeService.resetToDefault();
    if (res.success) {
      this.currentPrimary.set(this.themeService.primaryColor());
      this.currentAccent.set(this.themeService.accentColor());
      this.saveSuccessMessage.set('Reset to Emerald Velocity defaults and saved to database!');
      this.toasts.show('Reset to Emerald Velocity defaults!');
    } else {
      this.saveErrorMessage.set(res.error || 'Failed to reset theme');
      this.toasts.error(res.error || 'Failed to reset theme');
    }
  }

  copyCssVariables(): void {
    const css = `:root {
  --primary-color: ${this.currentPrimary()};
  --accent-color: ${this.currentAccent()};
  --primary-rgb: ${this.primaryRgb()};
  --accent-rgb: ${this.accentRgb()};
  --leaf: ${this.currentPrimary()};
  --copper: ${this.currentAccent()};
  --stepper-bg: ${this.currentPrimary()};
  --bs-primary: ${this.currentPrimary()};
}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(css).then(() => {
        this.hasCopied.set(true);
        setTimeout(() => this.hasCopied.set(false), 2000);
      });
    }
  }
}
