import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemePreset, ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-theme-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="theme-settings-container p-3 p-md-4">
      <!-- Breadcrumb & Page Header -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom theme-page-header">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge bg-primary-subtle text-primary fw-semibold px-2 py-1 rounded-pill">Admin Desk</span>
            <span class="text-muted small">/</span>
            <span class="text-muted small fw-medium">Appearance & Branding</span>
          </div>
          <h2 class="h3 fw-bold mb-1 d-flex align-items-center gap-2 text-ink">
            <i class="bi bi-palette text-primary"></i>
            Theme & Dynamic Colors
          </h2>
          <p class="text-muted small mb-0">
            Pick primary and accent colors for your store. Changes update globally in real time via CSS variables and persist to the database.
          </p>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
            (click)="resetToDefaults()"
            [disabled]="themeService.isSaving()"
            title="Reset to factory Emerald Velocity theme"
          >
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm px-3 d-flex align-items-center gap-2 fw-semibold shadow-sm"
            (click)="saveTheme()"
            [disabled]="themeService.isSaving() || !isHexValid()"
          >
            @if (themeService.isSaving()) {
              <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span>Saving...</span>
            } @else {
              <i class="bi bi-cloud-check-fill"></i>
              <span>Save to Database</span>
            }
          </button>
        </div>
      </div>

      <!-- Feedback Alerts -->
      @if (saveSuccessMessage()) {
        <div class="alert alert-success alert-dismissible fade show d-flex align-items-center gap-3 mb-4 shadow-sm" role="alert">
          <i class="bi bi-check-circle-fill fs-5 text-success"></i>
          <div class="flex-grow-1">
            <strong>Saved!</strong> {{ saveSuccessMessage() }}
          </div>
          <button type="button" class="btn-close" (click)="saveSuccessMessage.set('')" aria-label="Close"></button>
        </div>
      }

      @if (saveErrorMessage()) {
        <div class="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-3 mb-4 shadow-sm" role="alert">
          <i class="bi bi-exclamation-triangle-fill fs-5 text-danger"></i>
          <div class="flex-grow-1">
            <strong>Save Error:</strong> {{ saveErrorMessage() }}
          </div>
          <button type="button" class="btn-close" (click)="saveErrorMessage.set('')" aria-label="Close"></button>
        </div>
      }

      <div class="row g-4">
        <!-- Left Column: Color Pickers & Presets -->
        <div class="col-12 col-xl-7">
          <!-- Curated Presets Card -->
          <div class="card theme-card border-0 shadow-sm mb-4">
            <div class="card-header bg-transparent border-0 pt-3 px-3 px-md-4 pb-0">
              <div class="d-flex align-items-center justify-content-between">
                <h5 class="fw-bold mb-0 text-ink d-flex align-items-center gap-2 fs-6">
                  <i class="bi bi-grid-fill text-primary"></i>
                  Curated Color Palettes
                </h5>
                <span class="badge bg-light text-muted border small">
                  {{ themeService.presets.length }} Presets
                </span>
              </div>
              <p class="text-muted small mt-1 mb-0">
                Click any balanced combination to immediately apply primary & accent CSS variables.
              </p>
            </div>
            <div class="card-body p-3 p-md-4">
              <div class="row g-2 g-md-3">
                @for (preset of themeService.presets; track preset.id) {
                  <div class="col-12 col-sm-6">
                    <button
                      type="button"
                      class="preset-card w-100 text-start p-3 rounded-3 border transition-all position-relative"
                      [class.active-preset]="themeService.activePreset() === preset.id"
                      (click)="selectPreset(preset)"
                    >
                      <div class="d-flex align-items-center justify-content-between mb-2">
                        <span class="fw-bold text-ink small">{{ preset.name }}</span>
                        @if (themeService.activePreset() === preset.id) {
                          <span class="badge bg-primary text-white rounded-pill px-2 py-0" style="font-size: 0.65rem;">Active</span>
                        }
                      </div>

                      <div class="d-flex align-items-center gap-2 mb-2">
                        <div class="swatch-pair rounded-pill overflow-hidden d-flex flex-grow-1 border" style="height: 18px;">
                          <div class="flex-fill" [style.background]="preset.primary" [title]="'Primary: ' + preset.primary"></div>
                          <div class="flex-fill" [style.background]="preset.accent" [title]="'Accent: ' + preset.accent"></div>
                        </div>
                      </div>

                      <div class="d-flex align-items-center justify-content-between text-muted" style="font-size: 0.72rem;">
                        <span class="font-monospace">{{ preset.primary }}</span>
                        <span class="text-muted">/</span>
                        <span class="font-monospace">{{ preset.accent }}</span>
                      </div>
                      <div class="text-muted text-truncate mt-1" style="font-size: 0.72rem;">
                        {{ preset.tagline }}
                      </div>
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Custom Color Pickers Card -->
          <div class="card theme-card border-0 shadow-sm mb-4">
            <div class="card-header bg-transparent border-0 pt-3 px-3 px-md-4 pb-0">
              <h5 class="fw-bold mb-0 text-ink d-flex align-items-center gap-2 fs-6">
                <i class="bi bi-eyedropper text-primary"></i>
                Custom Color Pickers
              </h5>
              <p class="text-muted small mt-1 mb-0">
                Pick your custom primary brand hue and accent highlight tone using the color wheel or hex input.
              </p>
            </div>
            <div class="card-body p-3 p-md-4">
              <div class="row g-4">
                <!-- Primary Color Box -->
                <div class="col-12 col-md-6">
                  <div class="color-picker-box p-3 rounded-3 border h-100">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                      <label class="form-label fw-bold text-ink small mb-0">
                        Primary Color
                      </label>
                      <span class="badge bg-light text-muted border font-monospace small">
                        --primary-color
                      </span>
                    </div>
                    <p class="text-muted small mb-3" style="font-size: 0.78rem;">
                      Applied to main buttons, active tabs, header highlights, and brand identity.
                    </p>

                    <!-- Picker Row -->
                    <div class="d-flex align-items-center gap-3 mb-3">
                      <div class="color-swatch-wrapper position-relative">
                        <input
                          type="color"
                          class="form-control form-control-color border-0 p-0 rounded-circle cursor-pointer shadow-sm"
                          [value]="currentPrimary()"
                          (input)="onPrimaryColorChange($any($event.target).value)"
                          title="Pick Primary Color"
                          style="width: 48px; height: 48px;"
                        />
                      </div>
                      <div class="flex-grow-1">
                        <div class="input-group input-group-sm">
                          <span class="input-group-text font-monospace bg-light text-muted">#</span>
                          <input
                            type="text"
                            class="form-control font-monospace text-uppercase"
                            [value]="cleanHex(currentPrimary())"
                            (input)="onPrimaryHexInput($any($event.target).value)"
                            placeholder="059669"
                            maxlength="6"
                          />
                        </div>
                        <div class="d-flex align-items-center justify-content-between mt-1 text-muted" style="font-size: 0.72rem;">
                          <span>RGB: {{ primaryRgb() }}</span>
                          <span [class.text-danger]="!isPrimaryValid()">
                            {{ isPrimaryValid() ? 'Valid Hex' : 'Invalid Hex' }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Quick Suggestions -->
                    <div class="quick-chips">
                      <span class="text-muted small d-block mb-1" style="font-size: 0.7rem; font-weight: 600;">SUGGESTED SHADES</span>
                      <div class="d-flex flex-wrap gap-1">
                        @for (hex of quickPrimaryShades; track hex) {
                          <button
                            type="button"
                            class="btn btn-sm p-1 rounded-circle border shadow-2xs"
                            [style.background]="hex"
                            [title]="hex"
                            (click)="onPrimaryColorChange(hex)"
                            style="width: 24px; height: 24px;"
                          ></button>
                        }
                      </div>
                    </div>

                    <!-- Contrast Indicator -->
                    <div class="mt-3 pt-2 border-top d-flex align-items-center justify-content-between" style="font-size: 0.75rem;">
                      <span class="text-muted">White Contrast:</span>
                      <span class="fw-bold" [class.text-success]="contrastWhite() >= 4.5" [class.text-warning]="contrastWhite() < 4.5">
                        {{ contrastWhite() }}:1 ({{ contrastWhite() >= 4.5 ? 'WCAG AA Pass' : 'Low Contrast' }})
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Accent Color Box -->
                <div class="col-12 col-md-6">
                  <div class="color-picker-box p-3 rounded-3 border h-100">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                      <label class="form-label fw-bold text-ink small mb-0">
                        Accent Color
                      </label>
                      <span class="badge bg-light text-muted border font-monospace small">
                        --accent-color
                      </span>
                    </div>
                    <p class="text-muted small mb-3" style="font-size: 0.78rem;">
                      Applied to discount badges, sale countdowns, star ratings, and secondary CTAs.
                    </p>

                    <!-- Picker Row -->
                    <div class="d-flex align-items-center gap-3 mb-3">
                      <div class="color-swatch-wrapper position-relative">
                        <input
                          type="color"
                          class="form-control form-control-color border-0 p-0 rounded-circle cursor-pointer shadow-sm"
                          [value]="currentAccent()"
                          (input)="onAccentColorChange($any($event.target).value)"
                          title="Pick Accent Color"
                          style="width: 48px; height: 48px;"
                        />
                      </div>
                      <div class="flex-grow-1">
                        <div class="input-group input-group-sm">
                          <span class="input-group-text font-monospace bg-light text-muted">#</span>
                          <input
                            type="text"
                            class="form-control font-monospace text-uppercase"
                            [value]="cleanHex(currentAccent())"
                            (input)="onAccentHexInput($any($event.target).value)"
                            placeholder="EA580C"
                            maxlength="6"
                          />
                        </div>
                        <div class="d-flex align-items-center justify-content-between mt-1 text-muted" style="font-size: 0.72rem;">
                          <span>RGB: {{ accentRgb() }}</span>
                          <span [class.text-danger]="!isAccentValid()">
                            {{ isAccentValid() ? 'Valid Hex' : 'Invalid Hex' }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Quick Suggestions -->
                    <div class="quick-chips">
                      <span class="text-muted small d-block mb-1" style="font-size: 0.7rem; font-weight: 600;">SUGGESTED SHADES</span>
                      <div class="d-flex flex-wrap gap-1">
                        @for (hex of quickAccentShades; track hex) {
                          <button
                            type="button"
                            class="btn btn-sm p-1 rounded-circle border shadow-2xs"
                            [style.background]="hex"
                            [title]="hex"
                            (click)="onAccentColorChange(hex)"
                            style="width: 24px; height: 24px;"
                          ></button>
                        }
                      </div>
                    </div>

                    <!-- Contrast Indicator -->
                    <div class="mt-3 pt-2 border-top d-flex align-items-center justify-content-between" style="font-size: 0.75rem;">
                      <span class="text-muted">Dark Mode Contrast:</span>
                      <span class="fw-bold" [class.text-success]="contrastDark() >= 3.0" [class.text-warning]="contrastDark() < 3.0">
                        {{ contrastDark() }}:1
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Live Mockup & CSS Variables Inspector -->
        <div class="col-12 col-xl-5">
          <!-- Live Storefront Mockup Preview Card -->
          <div class="card theme-card border-0 shadow-sm mb-4">
            <div class="card-header bg-transparent border-0 pt-3 px-3 px-md-4 pb-0">
              <div class="d-flex align-items-center justify-content-between">
                <h5 class="fw-bold mb-0 text-ink d-flex align-items-center gap-2 fs-6">
                  <i class="bi bi-display text-primary"></i>
                  Live Storefront Preview
                </h5>
                <!-- Preview Mode Toggle -->
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary py-0 px-2 small"
                  (click)="togglePreviewTheme()"
                  title="Toggle light / dark preview background"
                >
                  <i class="bi" [class.bi-moon-stars-fill]="previewDark()" [class.bi-sun-fill]="!previewDark()"></i>
                  <span class="ms-1" style="font-size: 0.75rem;">{{ previewDark() ? 'Dark' : 'Light' }} View</span>
                </button>
              </div>
              <p class="text-muted small mt-1 mb-0">
                Components rendered with active dynamic CSS variables.
              </p>
            </div>
            <div class="card-body p-3 p-md-4">
              <!-- Mockup Frame -->
              <div
                class="mockup-frame rounded-4 p-3 border shadow-inner transition-all position-relative"
                [style.background]="previewDark() ? '#0f172a' : '#f8fafc'"
                [style.color]="previewDark() ? '#f8fafc' : '#0f172a'"
              >
                <!-- Mini Store Header -->
                <div class="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom" style="border-color: rgba(148, 163, 184, 0.2) !important;">
                  <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle d-flex align-items-center justify-content-center text-white" [style.background]="currentPrimary()" style="width: 28px; height: 28px; font-size: 0.8rem;">
                      <i class="bi bi-basket2-fill"></i>
                    </div>
                    <div>
                      <div class="fw-bold" style="font-size: 0.8rem; line-height: 1;">ZapBasket</div>
                      <small class="text-muted" style="font-size: 0.65rem;">10-Min Superfast</small>
                    </div>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge rounded-pill text-white shadow-2xs" [style.background]="currentAccent()" style="font-size: 0.65rem;">
                      <i class="bi bi-lightning-fill me-1"></i>Express
                    </span>
                    <button class="btn btn-sm btn-light border py-0 px-2 rounded-pill" style="font-size: 0.7rem;">
                      <i class="bi bi-cart3"></i>
                    </button>
                  </div>
                </div>

                <!-- Express Promo Banner -->
                <div
                  class="p-2 px-3 rounded-3 mb-3 text-white d-flex align-items-center justify-content-between shadow-sm"
                  [style.background]="'linear-gradient(135deg, ' + currentPrimary() + ' 0%, ' + currentAccent() + ' 100%)'"
                >
                  <div>
                    <div class="fw-bold" style="font-size: 0.75rem;">Fresh Farm Harvest</div>
                    <div style="font-size: 0.65rem; opacity: 0.9;">Delivering within 10 minutes</div>
                  </div>
                  <span class="badge bg-white text-dark rounded-pill fw-bold" style="font-size: 0.65rem;">
                    FREE Delivery
                  </span>
                </div>

                <!-- Sample Product Card -->
                <div class="mockup-product-card p-2 rounded-3 border d-flex gap-2 align-items-center" [style.background]="previewDark() ? '#1e293b' : '#ffffff'">
                  <div class="mockup-product-img rounded-2 d-flex align-items-center justify-content-center text-muted" [style.background]="previewDark() ? '#334155' : '#f1f5f9'" style="width: 48px; height: 48px; font-size: 1.4rem;">
                    🍓
                  </div>
                  <div class="flex-grow-1">
                    <div class="d-flex align-items-center gap-1">
                      <span class="badge rounded-1" [style.background]="currentAccent()" style="font-size: 0.55rem; color: #fff;">
                        25% OFF
                      </span>
                      <span class="text-muted" style="font-size: 0.65rem;">500g</span>
                    </div>
                    <div class="fw-bold" style="font-size: 0.75rem;">Mahabaleshwar Strawberries</div>
                    <div class="d-flex align-items-center justify-content-between mt-1">
                      <div>
                        <span class="fw-bold" [style.color]="currentPrimary()" style="font-size: 0.8rem;">₹149</span>
                        <span class="text-muted text-decoration-line-through ms-1" style="font-size: 0.65rem;">₹199</span>
                      </div>
                      <button
                        type="button"
                        class="btn btn-sm text-white py-0 px-2 rounded-2 fw-semibold shadow-2xs"
                        [style.background]="currentPrimary()"
                        style="font-size: 0.7rem; height: 24px;"
                      >
                        ADD
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Bottom Bar Mockup -->
                <div class="mt-3 pt-2 d-flex justify-content-around text-center border-top" style="border-color: rgba(148, 163, 184, 0.2) !important; font-size: 0.65rem;">
                  <div [style.color]="currentPrimary()" class="fw-bold">
                    <i class="bi bi-house-door-fill d-block" style="font-size: 0.9rem;"></i>
                    Home
                  </div>
                  <div class="text-muted">
                    <i class="bi bi-grid d-block" style="font-size: 0.9rem;"></i>
                    Categories
                  </div>
                  <div class="text-muted">
                    <i class="bi bi-bag d-block" style="font-size: 0.9rem;"></i>
                    Orders
                  </div>
                  <div class="text-muted">
                    <i class="bi bi-person d-block" style="font-size: 0.9rem;"></i>
                    Account
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Active CSS Variables Inspector Card -->
          <div class="card theme-card border-0 shadow-sm">
            <div class="card-header bg-transparent border-0 pt-3 px-3 px-md-4 pb-0">
              <div class="d-flex align-items-center justify-content-between">
                <h5 class="fw-bold mb-0 text-ink d-flex align-items-center gap-2 fs-6">
                  <i class="bi bi-code-slash text-primary"></i>
                  Active CSS Variables
                </h5>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary py-0 px-2"
                  (click)="copyCssVariables()"
                  title="Copy CSS rules to clipboard"
                >
                  <i class="bi" [class.bi-clipboard]="!hasCopied()" [class.bi-clipboard-check-fill]="hasCopied()"></i>
                  <span class="ms-1" style="font-size: 0.72rem;">{{ hasCopied() ? 'Copied!' : 'Copy' }}</span>
                </button>
              </div>
              <p class="text-muted small mt-1 mb-0">
                Globally injected onto documentElement & applied across all templates.
              </p>
            </div>
            <div class="card-body p-3 p-md-4">
              <div class="css-code-box rounded-3 p-3 font-monospace small bg-dark text-light overflow-x-auto" style="font-size: 0.75rem; line-height: 1.6;">
                <div><span class="text-secondary">:root &#123;</span></div>
                <div class="ps-3"><span class="text-info">--primary-color:</span> <span class="text-warning">{{ currentPrimary() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--accent-color:</span> <span class="text-warning">{{ currentAccent() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--primary-rgb:</span> <span class="text-success">{{ primaryRgb() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--accent-rgb:</span> <span class="text-success">{{ accentRgb() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--leaf:</span> <span class="text-warning">{{ currentPrimary() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--copper:</span> <span class="text-warning">{{ currentAccent() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--stepper-bg:</span> <span class="text-warning">{{ currentPrimary() }}</span>;</div>
                <div class="ps-3"><span class="text-info">--bs-primary:</span> <span class="text-warning">{{ currentPrimary() }}</span>;</div>
                <div><span class="text-secondary">&#125;</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .theme-settings-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .theme-card {
      background: var(--card, #ffffff);
      border: 1px solid var(--card-border, #e2e8f0) !important;
      border-radius: 1rem;
    }

    .preset-card {
      background: var(--card-subtle, #f8fafc);
      border-color: var(--line, #e2e8f0) !important;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }

    .preset-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      border-color: var(--primary-color, #059669) !important;
    }

    .preset-card.active-preset {
      background: var(--card, #ffffff);
      border-color: var(--primary-color, #059669) !important;
      box-shadow: 0 0 0 2px rgba(var(--primary-rgb, 5, 150, 105), 0.25);
    }

    .color-picker-box {
      background: var(--card-subtle, #f8fafc);
      border-color: var(--line, #e2e8f0) !important;
    }

    .cursor-pointer {
      cursor: pointer;
    }

    .form-control-color::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    .form-control-color::-webkit-color-swatch {
      border: none;
      border-radius: 50%;
    }

    .shadow-2xs {
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .css-code-box {
      background: #0f172a !important;
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  `],
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
