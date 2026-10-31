import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { StoreConfig, MessageLog, PushSummaryResponse } from '../core/models';
import { RouterLink } from '@angular/router';
import { InrPipe } from '../shared/inr.pipe';
import { errorMessage } from '../core/http-error';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InrPipe, RouterLink],
  template: `
    <div class="container-fluid p-3 p-md-4">
      <!-- Header -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div class="d-flex align-items-center gap-2">
            <h1 class="h3 fw-bold mb-0 text-dark">Store Operations & Delivery Controls</h1>
            @if (config()?.isCurrentlyOpen) {
              <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                <i class="bi bi-circle-fill me-1 small"></i> Live & Open
              </span>
            } @else {
              <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                <i class="bi bi-pause-circle me-1 small"></i> Store Closed
              </span>
            }
          </div>
          <p class="text-muted small mb-0 mt-1">
            Dynamically manage live store hours, delivery radius geofence, order minimums, and merchant UPI payment parameters.
          </p>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            (click)="loadConfig()"
            [disabled]="isLoading()"
          >
            <i class="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm px-3 fw-bold"
            (click)="saveConfig()"
            [disabled]="isSaving() || isLoading()"
          >
            @if (isSaving()) {
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
              Saving…
            } @else {
              <i class="bi bi-check2-circle me-1"></i> Save Changes
            }
          </button>
        </div>
      </div>

      @if (isLoading()) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="text-muted small mt-2">Loading store configuration…</p>
        </div>
      } @else if (config()) {
        <div class="row g-4">
          <!-- Brand Identity & Logo Customizer (Full Width) -->
          <div class="col-12">
            <div class="card border-0 shadow-sm rounded-4 mb-2 overflow-hidden">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div class="d-flex align-items-center gap-2">
                    <div class="p-2 rounded-3 bg-success-subtle text-success">
                      <i class="bi bi-palette fs-5"></i>
                    </div>
                    <div>
                      <h5 class="fw-bold mb-0">Brand Identity & Dynamic Logo</h5>
                      <small class="text-muted">Customize the store logo across customer storefront, admin desk, and delivery app</small>
                    </div>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm"
                      (click)="resetDefaultLogo()"
                      title="Reset to official ZapBasket emerald logo"
                    >
                      <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Official Logo
                    </button>
                  </div>
                </div>
              </div>

              <div class="card-body p-4 pt-2">
                <div class="row g-4 align-items-center">
                  <!-- Left: Dual-Theme Live Logo Previews -->
                  <div class="col-lg-5">
                    <label class="form-label small fw-semibold text-muted d-block mb-2">Live Logo Previews (Light & Dark Headers)</label>
                    <div class="d-flex flex-column gap-3">
                      <!-- Light Storefront Header Mockup -->
                      <div class="p-3 rounded-4 border bg-white shadow-sm d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center gap-2">
                          <span class="brand-mark" style="width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; border: 1.5px solid rgba(5,150,105,0.3); background: #ffffff; padding: 2px;">
                            <img [src]="logoPreview()" alt="Logo Preview" class="brand-img" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;" (error)="onLogoImgError($event)" />
                          </span>
                          <div>
                            <span class="fw-bold text-dark d-block" style="font-family: Outfit, sans-serif; font-size: 1.05rem;">ZapBasket</span>
                            <small class="text-muted" style="font-size: 0.72rem;">12-minute groceries</small>
                          </div>
                        </div>
                        <span class="badge bg-light text-dark border px-2 py-1 small">Light Mode</span>
                      </div>

                      <!-- Dark Desk Header Mockup -->
                      <div class="p-3 rounded-4 border border-secondary border-opacity-25 shadow-sm d-flex align-items-center justify-content-between" style="background: #0b111a;">
                        <div class="d-flex align-items-center gap-2">
                          <span class="brand-mark" style="width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; border: 1.5px solid rgba(0,229,153,0.5); background: #ffffff; padding: 2px; box-shadow: 0 0 12px rgba(0,229,153,0.35);">
                            <img [src]="logoPreview()" alt="Logo Preview" class="brand-img" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;" />
                          </span>
                          <div>
                            <span class="fw-bold text-white d-block" style="font-family: Outfit, sans-serif; font-size: 1.05rem;">ZapBasket</span>
                            <small class="text-success" style="font-size: 0.72rem;"><i class="bi bi-lightning-fill"></i> Ultra-Fast Hub</small>
                          </div>
                        </div>
                        <span class="badge bg-dark text-success border border-success border-opacity-50 px-2 py-1 small">Dark Mode</span>
                      </div>
                    </div>
                  </div>

                  <!-- Right: Upload Controls & Presets -->
                  <div class="col-lg-7">
                    <!-- Method Toggle Tabs -->
                    <div class="btn-group btn-group-sm w-100 mb-3" role="group">
                      <button
                        type="button"
                        class="btn"
                        [class.btn-primary]="logoInputMode() === 'upload'"
                        [class.btn-outline-primary]="logoInputMode() !== 'upload'"
                        (click)="logoInputMode.set('upload')"
                      >
                        <i class="bi bi-upload me-1"></i> Upload Image File from Device
                      </button>
                      <button
                        type="button"
                        class="btn"
                        [class.btn-primary]="logoInputMode() === 'url'"
                        [class.btn-outline-primary]="logoInputMode() !== 'url'"
                        (click)="logoInputMode.set('url')"
                      >
                        <i class="bi bi-link-45deg me-1"></i> Paste Image URL
                      </button>
                    </div>

                    @if (logoInputMode() === 'upload') {
                      <!-- Device File Upload Dropzone -->
                      <div class="p-3 p-md-4 rounded-4 border-2 border-dashed text-center bg-light bg-opacity-50 position-relative mb-3">
                        <input
                          type="file"
                          id="logoFileInput"
                          class="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                          style="cursor: pointer;"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          (change)="onLogoFileSelected($event)"
                        />
                        <div class="d-flex flex-column align-items-center justify-content-center pointer-events-none">
                          <div class="p-3 rounded-circle bg-primary-subtle text-primary mb-2">
                            <i class="bi bi-cloud-arrow-up fs-3"></i>
                          </div>
                          <span class="fw-bold text-dark mb-1">Click to browse or drag & drop logo file</span>
                          <span class="text-muted small">Supports PNG, SVG, JPEG, and WebP (Max 5MB)</span>
                        </div>
                      </div>
                    } @else {
                      <!-- URL Input -->
                      <div class="mb-3">
                        <label for="logoUrlInput" class="form-label small fw-semibold">Direct Image URL</label>
                        <div class="input-group">
                          <span class="input-group-text"><i class="bi bi-globe"></i></span>
                          <input
                            id="logoUrlInput"
                            type="text"
                            class="form-control"
                            [(ngModel)]="formData.logoUrl"
                            (ngModelChange)="onLogoUrlChange($event)"
                            placeholder="e.g. brand-logo-white.svg or https://example.com/logo.png"
                          />
                        </div>
                      </div>
                    }

                    <!-- Official Preset Quick Selection -->
                    <div class="pt-2">
                      <label class="form-label small fw-semibold text-muted d-block mb-2">Official Brand Presets</label>
                      <div class="d-flex flex-wrap gap-2">
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-success rounded-pill px-3 py-1"
                          (click)="setLogoPreset('brand-logo-white.svg')"
                        >
                          <i class="bi bi-check2-circle me-1"></i> Minimalist Emerald Basket (New)
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1"
                          (click)="setLogoPreset('brand-logo-transparent.svg')"
                        >
                          <i class="bi bi-layers me-1"></i> Transparent Emerald Vector
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1"
                          (click)="setLogoPreset('brand-logo-white.png')"
                        >
                          <i class="bi bi-box me-1"></i> 3D Woven Basket Badge
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Theme Studio & Color Customizer (Full Width) -->
          <div class="col-12">
            <div class="card border shadow-sm rounded-4 mb-2 overflow-hidden">
              <div class="card-header border-0 pt-4 px-4 pb-2">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
                  <div class="d-flex align-items-center gap-2">
                    <div class="p-2 rounded-3 bg-primary-subtle text-primary">
                      <i class="bi bi-brush-fill fs-5"></i>
                    </div>
                    <div>
                      <h5 class="fw-bold mb-0 text-dark">Store Color Theme & Visual Customizer</h5>
                      <small class="text-secondary fw-medium">Customize the brand palette, button accents, and visual mood with instant live preview</small>
                    </div>
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm"
                      (click)="resetDefaultTheme()"
                      title="Reset to default Emerald Velocity theme"
                    >
                      <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Emerald Theme
                    </button>
                  </div>
                </div>
              </div>

              <div class="card-body p-4 pt-2">
                <div class="row g-4">
                  <!-- Left: Curated Presets Grid + Custom Color Pickers -->
                  <div class="col-lg-7">
                    <label class="form-label small fw-semibold text-dark d-block mb-2">Curated Retail Theme Presets</label>
                    <div class="row g-2 mb-3">
                      @for (p of themeService.presets; track p.id) {
                        <div class="col-sm-6 col-md-4">
                          <div
                            class="theme-preset-card h-100"
                            [class.active]="selectedThemePreset === p.id"
                            (click)="choosePreset(p.id)"
                          >
                            <div class="theme-swatch-strip">
                              <div class="theme-swatch-primary" [style.background]="p.primary"></div>
                              <div class="theme-swatch-accent" [style.background]="p.accent"></div>
                            </div>
                            <div class="d-flex align-items-center justify-content-between">
                              <span class="fw-bold small text-dark d-block">{{ p.name }}</span>
                              @if (selectedThemePreset === p.id) {
                                <i class="bi bi-check-circle-fill text-success small"></i>
                              }
                            </div>
                            <small class="text-muted d-block mt-1" style="font-size: 0.72rem; line-height: 1.2;">
                              {{ p.tagline }}
                            </small>
                          </div>
                        </div>
                      }
                    </div>

                    <!-- Custom Hex Color Pickers -->
                    <div class="p-3 bg-light rounded-3 border">
                      <div class="d-flex align-items-center justify-content-between mb-2">
                        <span class="small fw-bold text-dark d-flex align-items-center gap-1">
                          <i class="bi bi-eyedropper text-primary"></i> Custom Brand Colors
                        </span>
                        @if (selectedThemePreset === 'custom') {
                          <span class="badge bg-primary text-white small" style="font-size: 0.7rem;">Custom Active</span>
                        }
                      </div>

                      <div class="row g-3">
                        <div class="col-sm-6">
                          <label class="form-label small fw-semibold text-secondary mb-1">Primary Brand Color</label>
                          <div class="theme-color-input-wrapper">
                            <input
                              type="color"
                              [value]="themePrimaryColor"
                              (input)="onPrimaryColorChange($event)"
                            />
                            <input
                              type="text"
                              class="theme-hex-input"
                              [value]="themePrimaryColor"
                              (input)="onPrimaryHexChange($event)"
                              placeholder="#059669"
                            />
                            <span class="small text-muted ms-auto" style="font-size: 0.72rem;">Buttons & Accents</span>
                          </div>
                        </div>

                        <div class="col-sm-6">
                          <label class="form-label small fw-semibold text-secondary mb-1">Accent / Highlights Color</label>
                          <div class="theme-color-input-wrapper">
                            <input
                              type="color"
                              [value]="themeAccentColor"
                              (input)="onAccentColorChange($event)"
                            />
                            <input
                              type="text"
                              class="theme-hex-input"
                              [value]="themeAccentColor"
                              (input)="onAccentHexChange($event)"
                              placeholder="#ea580c"
                            />
                            <span class="small text-muted ms-auto" style="font-size: 0.72rem;">Offers & Badges</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Right: Live Interactive Mockup Card -->
                  <div class="col-lg-5">
                    <label class="form-label small fw-semibold text-dark d-block mb-2">Instant Live Preview</label>
                    <div class="theme-live-mockup">
                      <!-- Mini Header Bar -->
                      <div class="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom">
                        <div class="d-flex align-items-center gap-2">
                          <div
                            class="rounded-3 d-grid place-items-center text-white"
                            [style.background]="themePrimaryColor"
                            style="width: 32px; height: 32px;"
                          >
                            <i class="bi bi-basket-fill small"></i>
                          </div>
                          <div>
                            <span class="fw-bold text-dark d-block small">Storefront Hero</span>
                            <small class="text-muted" style="font-size: 0.68rem;">ZapBasket Instant</small>
                          </div>
                        </div>
                        <span
                          class="badge rounded-pill text-white px-2 py-1"
                          [style.background]="themeAccentColor"
                          style="font-size: 0.7rem;"
                        >
                          <i class="bi bi-lightning-fill me-1"></i> 12 Mins
                        </span>
                      </div>

                      <!-- Sample Product Card -->
                      <div class="card border rounded-3 p-2 mb-3 bg-white shadow-sm">
                        <div class="d-flex align-items-center gap-2">
                          <div class="rounded-2 bg-light p-2 text-center" style="width: 50px; height: 50px;">
                            <span class="fs-4">🥑</span>
                          </div>
                          <div class="flex-grow-1">
                            <span class="fw-bold text-dark small d-block">Fresh Hass Avocados</span>
                            <div class="d-flex align-items-center gap-1">
                              <span class="fw-bold text-dark small">₹189</span>
                              <small class="text-muted text-decoration-line-through" style="font-size: 0.7rem;">₹220</small>
                              <span class="badge bg-danger-subtle text-danger" style="font-size: 0.65rem;">14% OFF</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            class="btn btn-sm rounded-pill px-3 py-1 text-white fw-bold shadow-sm"
                            [style.background]="themePrimaryColor"
                            [style.borderColor]="themePrimaryColor"
                            style="font-size: 0.75rem;"
                          >
                            + ADD
                          </button>
                        </div>
                      </div>

                      <!-- Sample Controls Strip -->
                      <div class="d-flex gap-2 flex-wrap">
                        <span
                          class="badge border px-2 py-1"
                          [style.borderColor]="themePrimaryColor"
                          [style.color]="themePrimaryColor"
                          style="font-size: 0.72rem; background: rgba(5,150,105,0.06);"
                        >
                          Active Delivery Slot
                        </span>
                        <span
                          class="badge rounded-pill text-white px-2 py-1"
                          [style.background]="themeAccentColor"
                          style="font-size: 0.72rem;"
                        >
                          FLAT ₹50 OFF
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Left Column: Operational Status & Business Hours -->
          <div class="col-lg-6">
            <!-- 1. Master Operational Switch -->
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-primary-subtle text-primary">
                    <i class="bi bi-power fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Store Status (Live Master Switch)</h5>
                    <small class="text-muted">Pause or resume customer checkout instantly</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <div class="form-check form-switch fs-5 mb-3">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="storeOpenSwitch"
                    [(ngModel)]="formData.isOpen"
                  />
                  <label class="form-check-label fw-bold small ms-2" for="storeOpenSwitch">
                    @if (formData.isOpen) {
                      <span class="text-success">Accepting Orders Online</span>
                    } @else {
                      <span class="text-danger">Store Paused (Checkout Disabled)</span>
                    }
                  </label>
                </div>

                @if (!formData.isOpen) {
                  <div class="mb-3">
                    <label for="closedReason" class="form-label small fw-semibold">
                      Reason shown to customers on storefront:
                    </label>
                    <input
                      id="closedReason"
                      type="text"
                      class="form-control"
                      [(ngModel)]="formData.closedReason"
                      placeholder="e.g. Temporarily closed for inventory restock. Back in 30 mins!"
                    />
                  </div>
                }

                <div class="p-3 rounded-3 bg-light border small text-muted">
                  <i class="bi bi-info-circle me-1 text-primary"></i>
                  When disabled, customers can still browse items and search catalog, but order placement is safely halted with your custom message.
                </div>
              </div>
            </div>

            <!-- 2. Daily Operating Hours -->
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-success-subtle text-success">
                    <i class="bi bi-clock-history fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Operating Hours (IST)</h5>
                    <small class="text-muted">Orders accepted only during these operational hours</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <label for="openingTime" class="form-label small fw-semibold">Daily Opening Time</label>
                    <input
                      id="openingTime"
                      type="time"
                      class="form-control font-monospace"
                      [(ngModel)]="formData.openingTime"
                    />
                    <div class="form-text small">e.g. 07:00 AM</div>
                  </div>
                  <div class="col-sm-6">
                    <label for="closingTime" class="form-label small fw-semibold">Daily Closing Time</label>
                    <input
                      id="closingTime"
                      type="time"
                      class="form-control font-monospace"
                      [(ngModel)]="formData.closingTime"
                    />
                    <div class="form-text small">e.g. 11:00 PM (23:00)</div>
                  </div>
                </div>

                <div class="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border">
                  <div>
                    <div class="small fw-semibold text-dark">Current Store Time:</div>
                    <div class="font-monospace text-muted small">{{ config()?.currentTimeIst || 'Live' }} IST</div>
                  </div>
                  <div>
                    @if (config()?.inOperatingHours) {
                      <span class="badge bg-success">Within Operating Hours</span>
                    } @else {
                      <span class="badge bg-warning text-dark">Outside Operating Hours</span>
                    }
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Basket & Delivery Thresholds -->
            <div class="card border-0 shadow-sm rounded-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-warning-subtle text-dark">
                    <i class="bi bi-currency-rupee fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Basket Economics & Delivery Fees</h5>
                    <small class="text-muted">Safeguard order profitability</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <div class="row g-3">
                  <div class="col-sm-4">
                    <label for="minOrderAmount" class="form-label small fw-semibold">Min Order Subtotal</label>
                    <div class="input-group">
                      <span class="input-group-text">₹</span>
                      <input
                        id="minOrderAmount"
                        type="number"
                        class="form-control"
                        [(ngModel)]="formData.minOrderAmount"
                        min="0"
                      />
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label for="freeDeliveryThreshold" class="form-label small fw-semibold">Free Delivery Above</label>
                    <div class="input-group">
                      <span class="input-group-text">₹</span>
                      <input
                        id="freeDeliveryThreshold"
                        type="number"
                        class="form-control"
                        [(ngModel)]="formData.freeDeliveryThreshold"
                        min="0"
                      />
                    </div>
                  </div>
                  <div class="col-sm-4">
                    <label for="deliveryFee" class="form-label small fw-semibold">Standard Fee</label>
                    <div class="input-group">
                      <span class="input-group-text">₹</span>
                      <input
                        id="deliveryFee"
                        type="number"
                        class="form-control"
                        [(ngModel)]="formData.deliveryFee"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. Customer Cancellation & Return Policies -->
            <div class="card border-0 shadow-sm rounded-4 mt-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-danger-subtle text-danger">
                    <i class="bi bi-x-octagon fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Cancellation & Return Controls</h5>
                    <small class="text-muted">Customer self-service cancellation window & return rules</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <!-- Toggle: Allow Self-Cancellation -->
                <div class="form-check form-switch fs-6 mb-3">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="allowCancellationSwitch"
                    [(ngModel)]="formData.allowCustomerCancellation"
                  />
                  <label class="form-check-label fw-bold small ms-2" for="allowCancellationSwitch">
                    @if (formData.allowCustomerCancellation) {
                      <span class="text-success">Allow Customer Self-Cancellation</span>
                    } @else {
                      <span class="text-danger">Customer Self-Cancellation Disabled (Desk only)</span>
                    }
                  </label>
                </div>

                @if (formData.allowCustomerCancellation) {
                  <div class="mb-3">
                    <label for="cancellationWindow" class="form-label small fw-semibold">
                      Cancellation Grace Window (minutes after placing):
                    </label>
                    <div class="input-group">
                      <input
                        id="cancellationWindow"
                        type="number"
                        class="form-control"
                        min="1"
                        max="30"
                        [(ngModel)]="formData.cancellationWindowMinutes"
                      />
                      <span class="input-group-text">minutes</span>
                    </div>
                    <div class="form-text small">
                      Once this window elapses or dark store packing begins, cancellation is locked automatically.
                    </div>
                  </div>
                }

                <!-- Toggle: Direct Rider Contact -->
                <div class="form-check form-switch fs-6 mb-3">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="riderContactSwitch"
                    [(ngModel)]="formData.allowDirectRiderContact"
                  />
                  <label class="form-check-label fw-bold small ms-2" for="riderContactSwitch">
                    @if (formData.allowDirectRiderContact) {
                      <span class="text-success">Direct Rider Call & WhatsApp Enabled</span>
                    } @else {
                      <span class="text-secondary">Route Customer Inquiries to Central Support</span>
                    }
                  </label>
                </div>

                <!-- Non-Returnable Policy Notice -->
                <div class="mb-2">
                  <label for="returnNotice" class="form-label small fw-semibold">
                    Non-Returnable Grocery Notice (shown on orders):
                  </label>
                  <textarea
                    id="returnNotice"
                    class="form-control small"
                    rows="2"
                    [(ngModel)]="formData.nonReturnableNotice"
                    placeholder="Perishable groceries cannot be returned once delivered."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Delivery Geofence & UPI Gateway -->
          <div class="col-lg-6">
            <!-- 4. Delivery Radius & Store Hub -->
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-info-subtle text-info-emphasis">
                    <i class="bi bi-geo-alt-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Delivery Radius & Store Location</h5>
                    <small class="text-muted">Geofenced delivery perimeter from fulfillment hub</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <!-- Radius Slider -->
                <div class="mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label for="radiusRange" class="form-label small fw-semibold mb-0">
                      Service Radius (km from store hub):
                    </label>
                    <span class="badge bg-primary fs-6">{{ formData.deliveryRadiusKm }} km</span>
                  </div>
                  <input
                    type="range"
                    class="form-range"
                    min="1"
                    max="30"
                    step="0.5"
                    id="radiusRange"
                    [(ngModel)]="formData.deliveryRadiusKm"
                  />
                  <div class="d-flex justify-content-between text-muted" style="font-size: 0.72rem;">
                    <span>1 km (Ultra-hyperlocal)</span>
                    <span>8 km (Standard)</span>
                    <span>30 km (Metropolitan)</span>
                  </div>
                </div>

                <!-- Hub Location Fields -->
                <div class="mb-3">
                  <label for="hubAddress" class="form-label small fw-semibold">Store Hub Address</label>
                  <input
                    id="hubAddress"
                    type="text"
                    class="form-control"
                    [(ngModel)]="formData.storeLocation.address"
                    placeholder="e.g. Koramangala 4th Block, Bengaluru"
                  />
                </div>

                <div class="row g-2 mb-3">
                  <div class="col-6">
                    <label for="hubLat" class="form-label small fw-semibold">Hub Latitude</label>
                    <input
                      id="hubLat"
                      type="number"
                      step="0.0001"
                      class="form-control font-monospace small"
                      [(ngModel)]="formData.storeLocation.lat"
                    />
                  </div>
                  <div class="col-6">
                    <label for="hubLng" class="form-label small fw-semibold">Hub Longitude</label>
                    <input
                      id="hubLng"
                      type="number"
                      step="0.0001"
                      class="form-control font-monospace small"
                      [(ngModel)]="formData.storeLocation.lng"
                    />
                  </div>
                </div>

                <!-- Radius Tester Box -->
                <div class="p-3 rounded-3 bg-light border">
                  <div class="fw-semibold small text-dark mb-1">
                    <i class="bi bi-compass me-1 text-primary"></i> Test Address Distance
                  </div>
                  <div class="input-group input-group-sm mb-2">
                    <input
                      type="text"
                      class="form-control"
                      placeholder="Latitude, Longitude (e.g. 12.9279, 77.6271)"
                      [(ngModel)]="testCoords"
                    />
                    <button class="btn btn-dark" type="button" (click)="testDistance()">
                      Calculate
                    </button>
                  </div>
                  @if (testResult()) {
                    <div class="small" [class.text-success]="testResult()!.eligible" [class.text-danger]="!testResult()!.eligible">
                      <i class="bi" [class.bi-check-circle-fill]="testResult()!.eligible" [class.bi-x-circle-fill]="!testResult()!.eligible"></i>
                      Distance: <b>{{ testResult()!.distanceKm }} km</b> —
                      {{ testResult()!.eligible ? 'Within delivery perimeter!' : 'Outside maximum delivery radius.' }}
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- 5. Live Merchant UPI & Webhook Parameters -->
            <div class="card border-0 shadow-sm rounded-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div class="d-flex align-items-center gap-2">
                    <div class="p-2 rounded-3 bg-primary-subtle text-primary">
                      <i class="bi bi-qr-code fs-5"></i>
                    </div>
                    <div>
                      <h5 class="fw-bold mb-0">Merchant UPI & Webhook Parameters</h5>
                      <small class="text-muted">Settlement VPA and automated callback security</small>
                    </div>
                  </div>
                  <a routerLink="/admin/settlement" class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                    <i class="bi bi-wallet2"></i>
                    <span>Open Settlement Studio</span>
                  </a>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label for="upiVpa" class="form-label small fw-semibold mb-0">Payee UPI VPA</label>
                      @if (formData.upiVpa) {
                        @if (isValidVpa(formData.upiVpa)) {
                          <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 0.68rem;">
                            <i class="bi bi-check-circle-fill me-1"></i> Valid VPA
                          </span>
                        } @else {
                          <span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size: 0.68rem;">
                            <i class="bi bi-x-circle-fill me-1"></i> Invalid format
                          </span>
                        }
                      }
                    </div>
                    <input
                      id="upiVpa"
                      type="text"
                      class="form-control font-monospace"
                      [class.is-invalid]="formData.upiVpa && !isValidVpa(formData.upiVpa)"
                      [(ngModel)]="formData.upiVpa"
                      placeholder="e.g. 9101516662@ybl"
                    />
                    <div class="form-text small">Receives customer UPI payments & QR settlements</div>
                  </div>
                  <div class="col-sm-6">
                    <label for="payeeName" class="form-label small fw-semibold">Display Merchant Name</label>
                    <input
                      id="payeeName"
                      type="text"
                      class="form-control"
                      [(ngModel)]="formData.payeeName"
                      placeholder="e.g. ZapBasket"
                    />
                    <div class="form-text small">Shows inside GPay / PhonePe</div>
                  </div>
                </div>

                <div class="mb-3">
                  <label for="webhookSecret" class="form-label small fw-semibold">Gateway Webhook Secret</label>
                  <input
                    id="webhookSecret"
                    type="text"
                    class="form-control font-monospace"
                    [(ngModel)]="formData.webhookSecret"
                    placeholder="Secret for signature verification"
                  />
                  <div class="form-text small">
                    Endpoints: <code class="small">POST /api/v1/payments/webhook</code> or <code class="small">/api/v1/payments/upi/webhook</code>
                  </div>
                </div>

                <div class="row g-2">
                  <div class="col-sm-6">
                    <label for="supportPhone" class="form-label small fw-semibold">Support Phone</label>
                    <input
                      id="supportPhone"
                      type="text"
                      class="form-control"
                      [(ngModel)]="formData.supportPhone"
                      placeholder="+91 9101516662"
                    />
                  </div>
                  <div class="col-sm-6">
                    <label for="supportEmail" class="form-label small fw-semibold">Support Email</label>
                    <input
                      id="supportEmail"
                      type="email"
                      class="form-control"
                      [(ngModel)]="formData.supportEmail"
                      placeholder="support@zapbasket.store"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- FSSAI Food Safety Licensing & Public Demo Security -->
            <div class="card border-0 shadow-sm rounded-4 mt-4 mb-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-success-subtle text-success">
                    <i class="bi bi-shield-fill-check fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Legal Compliance & Public Login Security</h5>
                    <small class="text-muted">FSSAI food licensing and login page demo accounts visibility</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <div class="row g-3">
                  <div class="col-sm-6">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label for="fssaiLic" class="form-label small fw-semibold mb-0">FSSAI 14-Digit License</label>
                      @if (formData.fssaiLicense) {
                        @if (isValidFssai(formData.fssaiLicense)) {
                          <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 0.68rem;">
                            <i class="bi bi-check-circle-fill me-1"></i> Valid 14 Digits
                          </span>
                        } @else {
                          <span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size: 0.68rem;">
                            <i class="bi bi-exclamation-triangle-fill me-1"></i> Must be 14 digits
                          </span>
                        }
                      }
                    </div>
                    <input
                      id="fssaiLic"
                      type="text"
                      class="form-control font-monospace"
                      [class.is-invalid]="formData.fssaiLicense && !isValidFssai(formData.fssaiLicense)"
                      maxlength="14"
                      [(ngModel)]="formData.fssaiLicense"
                      placeholder="11224333000542"
                    />
                    <div class="form-text small">Mandatory on food delivery storefronts & invoice headers</div>
                  </div>

                  <div class="col-sm-6">
                    <label class="form-label small fw-semibold">Public Login Demo Accounts Display</label>
                    <div class="form-check form-switch fs-6 p-2 rounded-3 bg-light border">
                      <input
                        class="form-check-input ms-0 me-2"
                        type="checkbox"
                        role="switch"
                        id="showDemoAccountsSwitch"
                        [(ngModel)]="formData.showDemoAccountsOnLogin"
                      />
                      <label class="form-check-label fw-bold small" for="showDemoAccountsSwitch">
                        @if (formData.showDemoAccountsOnLogin) {
                          <span class="text-success"><i class="bi bi-eye-fill me-1"></i> Testing Desks Enabled</span>
                        } @else {
                          <span class="text-danger"><i class="bi bi-eye-slash-fill me-1"></i> Hidden for Public Shoppers</span>
                        }
                      </label>
                    </div>
                    <div class="form-text small">When enabled, reviewers can expand the demo desk; when disabled, hidden completely</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 5. Automated Customer SMS & WhatsApp Notifications -->
            <div class="card border-0 shadow-sm rounded-4 mt-4 mb-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2">
                <div class="d-flex align-items-center justify-content-between">
                  <div class="d-flex align-items-center gap-2">
                    <div class="p-2 rounded-3 bg-info-subtle text-info-emphasis">
                      <i class="bi bi-chat-dots fs-5"></i>
                    </div>
                    <div>
                      <h5 class="fw-bold mb-0">Automated Order Alerts</h5>
                      <small class="text-muted">Real-time WhatsApp & SMS updates for customers</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    (click)="toggleLogs()"
                  >
                    <i class="bi bi-clock-history me-1"></i>
                    {{ showLogs() ? 'Hide Audit Logs' : 'View Message Logs' }}
                  </button>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <!-- Master Switches -->
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <div class="form-check form-switch fs-6 p-2 rounded-3 bg-light border">
                      <input
                        class="form-check-input ms-0 me-2"
                        type="checkbox"
                        role="switch"
                        id="enableWhatsAppSwitch"
                        [(ngModel)]="formData.enableWhatsAppAlerts"
                      />
                      <label class="form-check-label fw-bold small" for="enableWhatsAppSwitch">
                        <i class="bi bi-whatsapp text-success me-1"></i>
                        WhatsApp Alerts
                        @if (formData.enableWhatsAppAlerts) {
                          <span class="badge bg-success text-white ms-1">Active</span>
                        } @else {
                          <span class="badge bg-secondary ms-1">Disabled</span>
                        }
                      </label>
                    </div>
                  </div>
                  <div class="col-sm-6">
                    <div class="form-check form-switch fs-6 p-2 rounded-3 bg-light border">
                      <input
                        class="form-check-input ms-0 me-2"
                        type="checkbox"
                        role="switch"
                        id="enableSmsSwitch"
                        [(ngModel)]="formData.enableSmsAlerts"
                      />
                      <label class="form-check-label fw-bold small" for="enableSmsSwitch">
                        <i class="bi bi-chat-text text-primary me-1"></i>
                        Transactional SMS
                        @if (formData.enableSmsAlerts) {
                          <span class="badge bg-primary text-white ms-1">Active</span>
                        } @else {
                          <span class="badge bg-secondary ms-1">Disabled</span>
                        }
                      </label>
                    </div>
                  </div>
                </div>

                <!-- WhatsApp Gateway Config -->
                <div class="p-3 rounded-3 bg-light border mb-3">
                  <div class="fw-bold small mb-2 d-flex align-items-center gap-1 text-success">
                    <i class="bi bi-whatsapp"></i> WhatsApp Cloud API Configuration
                  </div>
                  <div class="row g-2 mb-2">
                    <div class="col-sm-6">
                      <label for="waProvider" class="form-label small fw-semibold">Provider Engine</label>
                      <select id="waProvider" class="form-select form-select-sm" [(ngModel)]="formData.whatsAppProvider">
                        <option value="meta">Meta Graph Cloud API (Official)</option>
                        <option value="gupshup">Gupshup Enterprise</option>
                        <option value="twilio">Twilio Programmable WhatsApp</option>
                        <option value="custom_webhook">Custom Webhook Dispatch</option>
                      </select>
                    </div>
                    <div class="col-sm-6">
                      <label for="waPhoneId" class="form-label small fw-semibold">Meta Phone Number ID</label>
                      <input
                        id="waPhoneId"
                        type="text"
                        class="form-control form-control-sm font-monospace"
                        [(ngModel)]="formData.whatsAppPhoneNumberId"
                        placeholder="e.g. 109849284920492"
                      />
                    </div>
                  </div>
                  <div class="mb-2">
                    <label for="waToken" class="form-label small fw-semibold">Permanent Access Token / API Key</label>
                    <input
                      id="waToken"
                      type="password"
                      class="form-control form-control-sm font-monospace"
                      [(ngModel)]="formData.whatsAppApiKey"
                      placeholder="EAA..."
                    />
                    <div class="form-text small" style="font-size: 0.72rem;">
                      Leave empty to run in zero-cost <b>Simulated Mode</b> (writes full payload to audit log for validation).
                    </div>
                  </div>
                </div>

                <!-- SMS Gateway Config -->
                <div class="p-3 rounded-3 bg-light border mb-3">
                  <div class="fw-bold small mb-2 d-flex align-items-center gap-1 text-primary">
                    <i class="bi bi-chat-left-text"></i> SMS Gateway (DLT Compliant)
                  </div>
                  <div class="row g-2 mb-2">
                    <div class="col-sm-6">
                      <label for="smsProvider" class="form-label small fw-semibold">SMS Provider</label>
                      <select id="smsProvider" class="form-select form-select-sm" [(ngModel)]="formData.smsProvider">
                        <option value="fast2sms">Fast2SMS (Quick OTP/Transactional)</option>
                        <option value="gupshup">Gupshup Enterprise SMS</option>
                        <option value="twilio">Twilio Global SMS</option>
                        <option value="custom_webhook">Custom Webhook</option>
                      </select>
                    </div>
                    <div class="col-sm-6">
                      <label for="smsSenderId" class="form-label small fw-semibold">DLT Header / Sender ID</label>
                      <input
                        id="smsSenderId"
                        type="text"
                        class="form-control form-control-sm font-monospace"
                        [(ngModel)]="formData.smsSenderId"
                        placeholder="ZAPBKT"
                        maxlength="6"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="smsKey" class="form-label small fw-semibold">SMS Gateway API Key</label>
                    <input
                      id="smsKey"
                      type="password"
                      class="form-control form-control-sm font-monospace"
                      [(ngModel)]="formData.smsApiKey"
                      placeholder="Fast2SMS authorization key"
                    />
                  </div>
                </div>

                <!-- Live Dispatch Test Station -->
                <div class="p-3 rounded-3 border bg-white shadow-xs">
                  <div class="fw-bold small mb-2 text-dark d-flex align-items-center gap-1">
                    <i class="bi bi-broadcast text-danger"></i> Live Gateway Test Station
                  </div>
                  <div class="row g-2 align-items-end">
                    <div class="col-sm-6">
                      <label for="testPhone" class="form-label small fw-semibold">Recipient Mobile Number</label>
                      <input
                        id="testPhone"
                        type="text"
                        class="form-control form-control-sm"
                        [(ngModel)]="testPhone"
                        placeholder="+91 9101516662"
                      />
                    </div>
                    <div class="col-sm-3">
                      <label for="testChannel" class="form-label small fw-semibold">Channel</label>
                      <select id="testChannel" class="form-select form-select-sm" [(ngModel)]="testChannel">
                        <option value="push">Push Notification</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                      </select>
                    </div>
                    <div class="col-sm-3">
                      <button
                        type="button"
                        class="btn btn-sm btn-dark w-100 fw-bold"
                        [disabled]="isTestingAlert()"
                        (click)="sendTestAlert()"
                      >
                        @if (isTestingAlert()) {
                          <span class="spinner-border spinner-border-sm me-1"></span>
                        } @else {
                          <i class="bi bi-send me-1"></i>
                        }
                        Send Test
                      </button>
                    </div>
                  </div>
                  @if (testAlertResult()) {
                    <div class="alert alert-success py-2 px-3 mt-2 mb-0 rounded-3 small">
                      <i class="bi bi-check-circle-fill me-1"></i> {{ testAlertResult() }}
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- FCM Web Push Notification & Promotional Broadcast Station -->
          <div class="col-12">
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-primary-subtle text-primary">
                    <i class="bi bi-bell-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Firebase Cloud Messaging & Push Notification Station</h5>
                    <small class="text-muted">Monitor device token opt-ins, customer preferences, and dispatch promotional push broadcasts</small>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  (click)="loadPushSummary()"
                  [disabled]="isLoadingPushSummary()"
                >
                  @if (isLoadingPushSummary()) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  } @else {
                    <i class="bi bi-arrow-clockwise me-1"></i>
                  }
                  Refresh Push Stats
                </button>
              </div>

              <div class="card-body p-4 pt-2">
                <!-- Push Opt-In Metric Cards -->
                <div class="row g-3 mb-4">
                  <div class="col-6 col-md-3">
                    <div class="p-3 rounded-3 bg-light border">
                      <div class="text-muted small mb-1"><i class="bi bi-phone me-1"></i> Registered Devices</div>
                      <h4 class="fw-bold mb-0 text-dark">{{ pushSummary()?.usersWithTokens ?? 0 }}</h4>
                      <small class="text-secondary" style="font-size: 0.72rem;">{{ pushSummary()?.totalUsers ?? 0 }} total registered customers</small>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="p-3 rounded-3 bg-light border">
                      <div class="text-muted small mb-1"><i class="bi bi-bicycle me-1"></i> Order Update Opt-in</div>
                      <h4 class="fw-bold mb-0 text-primary">{{ pushSummary()?.orderOptInRate ?? 100 }}%</h4>
                      <small class="text-secondary" style="font-size: 0.72rem;">{{ pushSummary()?.optedInOrderUpdates ?? 0 }} customers opted-in</small>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="p-3 rounded-3 bg-light border">
                      <div class="text-muted small mb-1"><i class="bi bi-tags-fill me-1"></i> Deals & Promo Opt-in</div>
                      <h4 class="fw-bold mb-0 text-warning">{{ pushSummary()?.promoOptInRate ?? 100 }}%</h4>
                      <small class="text-secondary" style="font-size: 0.72rem;">{{ pushSummary()?.optedInPromos ?? 0 }} customers opted-in</small>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="p-3 rounded-3 bg-light border">
                      <div class="text-muted small mb-1"><i class="bi bi-broadcast-pin me-1"></i> Gateway Provider</div>
                      <h5 class="fw-bold mb-0 text-success">Web Push / FCM</h5>
                      <small class="text-success" style="font-size: 0.72rem;">Background SW Active</small>
                    </div>
                  </div>
                </div>

                <!-- Promotional Push Broadcast Form -->
                <div class="p-3 rounded-3 border bg-light bg-opacity-50">
                  <div class="d-flex align-items-center justify-content-between mb-3">
                    <div class="fw-bold text-dark d-flex align-items-center gap-2">
                      <i class="bi bi-megaphone-fill text-primary"></i>
                      <span>Broadcast Promotional Push Alert</span>
                    </div>
                    <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
                      Delivers to all customers with promotional alerts turned on
                    </span>
                  </div>

                  <div class="row g-3">
                    <div class="col-md-5">
                      <label class="form-label small fw-semibold">Push Title</label>
                      <input
                        type="text"
                        class="form-control form-control-sm"
                        [(ngModel)]="promoForm.title"
                        placeholder="e.g. ⚡ Flash Deal: Flat 40% Off Veggies!"
                      />
                    </div>
                    <div class="col-md-4">
                      <label class="form-label small fw-semibold">Target Route / Deep Link</label>
                      <input
                        type="text"
                        class="form-control form-control-sm"
                        [(ngModel)]="promoForm.link"
                        placeholder="/coupons or /products"
                      />
                    </div>
                    <div class="col-md-3">
                      <label class="form-label small fw-semibold">Coupon Code (Optional)</label>
                      <input
                        type="text"
                        class="form-control form-control-sm font-monospace text-uppercase"
                        [(ngModel)]="promoForm.couponCode"
                        placeholder="e.g. FLASH40"
                      />
                    </div>
                    <div class="col-12">
                      <label class="form-label small fw-semibold">Notification Body</label>
                      <textarea
                        class="form-control form-control-sm"
                        rows="2"
                        [(ngModel)]="promoForm.body"
                        placeholder="Order before 8 PM to enjoy farm-fresh veggies at dark store clearance rates."
                      ></textarea>
                    </div>
                  </div>

                  <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3 pt-3 border-top">
                    <div class="small text-muted">
                      Customers who have toggled off "Promotional Alerts" in their profile will be automatically respected and excluded.
                    </div>
                    <div class="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        class="btn btn-primary btn-sm px-4 fw-bold"
                        [disabled]="isBroadcastingPromo() || !promoForm.title || !promoForm.body"
                        (click)="broadcastPromoPush()"
                      >
                        @if (isBroadcastingPromo()) {
                          <span class="spinner-border spinner-border-sm me-1"></span> Broadcasting…
                        } @else {
                          <i class="bi bi-broadcast me-1"></i> Broadcast Push Notification
                        }
                      </button>
                    </div>
                  </div>

                  @if (promoBroadcastResult()) {
                    <div class="alert alert-success py-2 px-3 mt-3 mb-0 rounded-3 small">
                      <i class="bi bi-check-circle-fill me-1"></i> {{ promoBroadcastResult() }}
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- Full-Width Live Message Logs Drawer -->
          @if (showLogs()) {
            <div class="col-12 mt-4">
              <div class="card border-0 shadow-sm rounded-4">
                <div class="card-header bg-white border-0 pt-4 px-4 pb-2 d-flex align-items-center justify-content-between">
                  <div class="d-flex align-items-center gap-2">
                    <div class="p-2 rounded-3 bg-secondary-subtle text-secondary">
                      <i class="bi bi-journal-text fs-5"></i>
                    </div>
                    <div>
                      <h5 class="fw-bold mb-0">Transactional Message Dispatch Audit Logs</h5>
                      <small class="text-muted">Real-time delivery history across Web Push, SMS and WhatsApp channels</small>
                    </div>
                  </div>
                  <button type="button" class="btn btn-outline-secondary btn-sm" (click)="loadMessageLogs()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Refresh Logs
                  </button>
                </div>
                <div class="card-body p-4 pt-2">
                  @if (isLoadingLogs()) {
                    <div class="text-center py-4 text-muted small">Loading message dispatch records…</div>
                  } @else if (messageLogs().length === 0) {
                    <div class="text-center py-4 text-muted small">
                      No transactional messages dispatched yet. Place a test order or use the Test Station above.
                    </div>
                  } @else {
                    <div class="table-responsive">
                      <table class="table table-sm table-hover align-middle mb-0" style="font-size: 0.82rem;">
                        <thead class="table-light">
                          <tr>
                            <th>Time</th>
                            <th>Channel</th>
                            <th>Event</th>
                            <th>Recipient</th>
                            <th>Order</th>
                            <th>Status</th>
                            <th>Message Preview</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (log of messageLogs(); track log._id || log.id) {
                            <tr>
                              <td class="text-muted text-nowrap font-monospace" style="font-size: 0.75rem;">
                                {{ log.createdAt | date:'d MMM, h:mm:ss a' }}
                              </td>
                              <td>
                                @if (log.channel === 'push') {
                                  <span class="badge bg-primary text-white">
                                    <i class="bi bi-bell-fill me-1"></i> Web Push
                                  </span>
                                } @else if (log.channel === 'whatsapp') {
                                  <span class="badge bg-success-subtle text-success border border-success-subtle">
                                    <i class="bi bi-whatsapp me-1"></i> WhatsApp
                                  </span>
                                } @else {
                                  <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    <i class="bi bi-chat-text me-1"></i> SMS
                                  </span>
                                }
                              </td>
                              <td>
                                <span class="badge bg-light text-dark border font-monospace" style="font-size: 0.72rem;">
                                  {{ log.eventType }}
                                </span>
                              </td>
                              <td class="font-monospace text-nowrap">{{ log.recipientPhone }}</td>
                              <td class="font-monospace">
                                @if (log.orderNumber) {
                                  <b>#{{ log.orderNumber }}</b>
                                } @else {
                                  <span class="text-muted">—</span>
                                }
                              </td>
                              <td>
                                @if (log.status === 'sent') {
                                  <span class="badge bg-success text-white">Sent</span>
                                } @else if (log.status === 'simulated') {
                                  <span class="badge bg-secondary-subtle text-secondary border">Simulated</span>
                                } @else {
                                  <span class="badge bg-danger text-white">Failed</span>
                                }
                              </td>
                              <td class="text-truncate" style="max-width: 280px;" [title]="log.messageBody">
                                {{ log.messageBody }}
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminSettingsPage implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly themeService = inject(ThemeService);

  readonly config = signal<StoreConfig | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  selectedThemePreset = 'emerald';
  themePrimaryColor = '#059669';
  themeAccentColor = '#ea580c';

  formData: any = {
    isOpen: true,
    closedReason: '',
    openingTime: '07:00',
    closingTime: '23:00',
    logoUrl: 'brand-logo-white.svg',
    deliveryRadiusKm: 8.0,
    minOrderAmount: 99,
    freeDeliveryThreshold: 299,
    deliveryFee: 25,
    allowCustomerCancellation: true,
    cancellationWindowMinutes: 3,
    allowDirectRiderContact: true,
    nonReturnableNotice: 'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered.',
    enableSmsAlerts: true,
    enableWhatsAppAlerts: true,
    smsProvider: 'fast2sms',
    smsSenderId: 'ZAPBKT',
    smsApiKey: '',
    whatsAppProvider: 'meta',
    whatsAppApiKey: '',
    whatsAppPhoneNumberId: '',
    whatsAppFromNumber: '+91 9101516662',
    upiVpa: '9101516662@ybl',
    payeeName: 'ZapBasket',
    webhookSecret: 'zb_webhook_secret_live',
    supportPhone: '+91 9101516662',
    supportEmail: 'support@zapbasket.store',
    fssaiLicense: '11224333000542',
    showDemoAccountsOnLogin: true,
    storeLocation: {
      lat: 12.9352,
      lng: 77.6245,
      address: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
    },
  };

  choosePreset(presetId: string) {
    this.selectedThemePreset = presetId;
    const preset = this.themeService.presets.find((p) => p.id === presetId);
    if (preset) {
      this.themePrimaryColor = preset.primary;
      this.themeAccentColor = preset.accent;
      this.themeService.applyPaletteToDom(preset.primary, preset.accent);
    }
  }

  onPrimaryColorChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.selectedThemePreset = 'custom';
    this.themePrimaryColor = val;
    this.themeService.applyPaletteToDom(val, this.themeAccentColor);
  }

  onPrimaryHexChange(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val)) {
      this.selectedThemePreset = 'custom';
      this.themePrimaryColor = val;
      this.themeService.applyPaletteToDom(val, this.themeAccentColor);
    }
  }

  onAccentColorChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.selectedThemePreset = 'custom';
    this.themeAccentColor = val;
    this.themeService.applyPaletteToDom(this.themePrimaryColor, val);
  }

  onAccentHexChange(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val)) {
      this.selectedThemePreset = 'custom';
      this.themeAccentColor = val;
      this.themeService.applyPaletteToDom(this.themePrimaryColor, val);
    }
  }

  resetDefaultTheme() {
    this.choosePreset('emerald');
    this.toasts.show('Reset to default Emerald Velocity theme.');
  }

  testCoords = '12.9352, 77.6245';
  readonly testResult = signal<{ distanceKm: number; eligible: boolean } | null>(null);

  readonly logoInputMode = signal<'upload' | 'url'>('upload');
  readonly logoPreview = signal<string>('brand-logo-white.svg');
  readonly isUploadingLogo = signal<boolean>(false);

  onLogoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toasts.error('Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toasts.error('File size must be under 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.logoPreview.set(result);
      this.formData.logoUrl = result;
      this.toasts.show('Logo loaded! Click "Save Changes" to apply across the store.');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onLogoUrlChange(url: string) {
    if (url && url.trim()) {
      this.logoPreview.set(url.trim());
    } else {
      this.logoPreview.set('brand-logo-white.svg');
    }
  }

  setLogoPreset(url: string) {
    this.formData.logoUrl = url;
    this.logoPreview.set(url);
    this.toasts.show(`Selected preset: ${url}`);
  }

  resetDefaultLogo() {
    this.formData.logoUrl = 'brand-logo-white.svg';
    this.logoPreview.set('brand-logo-white.svg');
    this.toasts.show('Reset to official minimalist emerald ZapBasket logo.');
  }

  onLogoImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('brand-logo-white.svg')) {
      img.src = 'brand-logo-white.svg';
    }
  }

  testPhone = '+91 9101516662';
  testChannel: 'sms' | 'whatsapp' | 'push' = 'push';
  readonly isTestingAlert = signal(false);
  readonly testAlertResult = signal<string | null>(null);

  readonly pushSummary = signal<PushSummaryResponse | null>(null);
  readonly isLoadingPushSummary = signal(false);
  readonly isBroadcastingPromo = signal(false);
  readonly promoBroadcastResult = signal<string | null>(null);

  promoForm = {
    title: '⚡ Flash Offer: 25% Off Fresh Fruits',
    body: 'Stock up your basket with farm-fresh apples, bananas & berries before 8 PM!',
    couponCode: 'FRUIT25',
    link: '/categories',
  };

  readonly showLogs = signal(false);
  readonly messageLogs = signal<MessageLog[]>([]);
  readonly isLoadingLogs = signal(false);

  ngOnInit() {
    void this.loadConfig();
    void this.loadPushSummary();
  }

  async loadPushSummary() {
    this.isLoadingPushSummary.set(true);
    try {
      const summary = await this.shop.getPushSummary();
      this.pushSummary.set(summary);
    } catch (err) {
      console.warn('Could not load push summary:', err);
    } finally {
      this.isLoadingPushSummary.set(false);
    }
  }

  async broadcastPromoPush() {
    if (!this.promoForm.title || !this.promoForm.body) {
      this.toasts.error('Please enter a title and message body for the push broadcast');
      return;
    }
    this.isBroadcastingPromo.set(true);
    this.promoBroadcastResult.set(null);
    try {
      const res = await this.shop.broadcastPromo({
        title: this.promoForm.title,
        body: this.promoForm.body,
        couponCode: this.promoForm.couponCode || undefined,
        link: this.promoForm.link || undefined,
      });
      this.promoBroadcastResult.set(
        `Dispatched successfully: ${res.recipientsCount} opted-in customers targeted (${res.deliveredCount} device tokens sent, ${res.failedCount} failures).`
      );
      this.toasts.show('Promotional push broadcast dispatched!');
      void this.loadPushSummary();
      if (this.showLogs()) {
        void this.loadMessageLogs();
      }
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to broadcast promotional push notification'));
    } finally {
      this.isBroadcastingPromo.set(false);
    }
  }

  toggleLogs() {
    this.showLogs.update((v) => !v);
    if (this.showLogs() && this.messageLogs().length === 0) {
      void this.loadMessageLogs();
    }
  }

  async loadMessageLogs() {
    this.isLoadingLogs.set(true);
    try {
      const logs = await this.shop.getMessageLogs(30);
      this.messageLogs.set(logs);
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Could not fetch message dispatch logs'));
    } finally {
      this.isLoadingLogs.set(false);
    }
  }

  async sendTestAlert() {
    const phone = this.testPhone || (this.testChannel === 'push' ? 'Push-Device' : '');
    if (!phone) {
      this.toasts.error('Please enter a recipient phone number');
      return;
    }
    this.isTestingAlert.set(true);
    this.testAlertResult.set(null);
    try {
      const res = await this.shop.sendTestMessage(this.testChannel, phone);
      this.testAlertResult.set(
        `${this.testChannel.toUpperCase()} alert triggered (${res.log?.status || 'simulated'}). Log ID: #${res.log?._id || 'ok'}`
      );
      this.toasts.show(`Test ${this.testChannel.toUpperCase()} dispatched successfully!`);
      if (this.showLogs()) {
        void this.loadMessageLogs();
      }
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to dispatch test alert'));
    } finally {
      this.isTestingAlert.set(false);
    }
  }

  async loadConfig() {
    this.isLoading.set(true);
    try {
      const data = await this.shop.getAdminStoreConfig();
      this.config.set(data);
      this.formData = {
        isOpen: data.isOpen,
        closedReason: data.closedReason || '',
        openingTime: data.openingTime || '07:00',
        closingTime: data.closingTime || '23:00',
        deliveryRadiusKm: data.deliveryRadiusKm || 8.0,
        minOrderAmount: data.minOrderAmount ?? 99,
        freeDeliveryThreshold: data.freeDeliveryThreshold ?? 299,
        deliveryFee: data.deliveryFee ?? 25,
        allowCustomerCancellation: data.allowCustomerCancellation ?? true,
        cancellationWindowMinutes: data.cancellationWindowMinutes ?? 3,
        allowDirectRiderContact: data.allowDirectRiderContact ?? true,
        nonReturnableNotice:
          data.nonReturnableNotice ||
          'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered.',
        enableSmsAlerts: data.enableSmsAlerts ?? true,
        enableWhatsAppAlerts: data.enableWhatsAppAlerts ?? true,
        smsProvider: data.smsProvider || 'fast2sms',
        smsSenderId: data.smsSenderId || 'ZAPBKT',
        smsApiKey: data.smsApiKey || '',
        whatsAppProvider: data.whatsAppProvider || 'meta',
        whatsAppApiKey: data.whatsAppApiKey || '',
        whatsAppPhoneNumberId: data.whatsAppPhoneNumberId || '',
        whatsAppFromNumber: data.whatsAppFromNumber || '+91 9101516662',
        upiVpa: data.upiVpa || '9101516662@ybl',
        payeeName: data.payeeName || 'ZapBasket',
        webhookSecret: data.webhookSecret || 'zb_webhook_secret_live',
        supportPhone: data.supportPhone || '+91 9101516662',
        supportEmail: data.supportEmail || 'support@zapbasket.store',
        logoUrl: data.logoUrl || 'brand-logo-white.svg',
        fssaiLicense: data.fssaiLicense || '11224333000542',
        showDemoAccountsOnLogin: data.showDemoAccountsOnLogin !== false,
        storeLocation: {
          lat: data.storeLocation?.lat ?? 12.9352,
          lng: data.storeLocation?.lng ?? 77.6245,
          address: data.storeLocation?.address || 'Koramangala 4th Block, Bengaluru',
        },
      };
      this.logoPreview.set(this.formData.logoUrl);

      if (data.theme) {
        this.selectedThemePreset = data.theme.preset || 'emerald';
        this.themePrimaryColor = data.theme.primaryColor || '#059669';
        this.themeAccentColor = data.theme.accentColor || '#ea580c';
        this.themeService.applyPaletteToDom(this.themePrimaryColor, this.themeAccentColor);
      }
    } catch (error) {
      this.toasts.error(errorMessage(error, 'Could not load store configuration'));
    } finally {
      this.isLoading.set(false);
    }
  }

  isValidVpa(vpa: string): boolean {
    return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test((vpa || '').trim());
  }

  isValidFssai(lic: string): boolean {
    return /^\d{14}$/.test((lic || '').trim());
  }

  async saveConfig() {
    if (this.formData.upiVpa && !this.isValidVpa(this.formData.upiVpa)) {
      this.toasts.error('Please enter a valid Merchant UPI VPA (e.g. yourname@bank)');
      return;
    }
    if (this.formData.fssaiLicense && !this.isValidFssai(this.formData.fssaiLicense)) {
      this.toasts.error('FSSAI Food Safety License must be exactly 14 numeric digits');
      return;
    }

    this.formData.theme = {
      preset: this.selectedThemePreset,
      primaryColor: this.themePrimaryColor,
      accentColor: this.themeAccentColor,
      surfaceMode: 'slate-contrast',
    };

    this.isSaving.set(true);
    try {
      const updated = await this.shop.updateStoreConfig(this.formData);
      this.config.set(updated);
      this.toasts.show('Store operational settings & theme saved successfully!');
    } catch (error) {
      this.toasts.error(errorMessage(error, 'Failed to save settings'));
    } finally {
      this.isSaving.set(false);
    }
  }

  async testDistance() {
    const parts = this.testCoords.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      this.toasts.error('Please enter valid coordinates as lat, lng');
      return;
    }

    try {
      const result = await this.shop.checkCoverage(parts[0], parts[1]);
      this.testResult.set({
        distanceKm: result.distanceKm ?? 0,
        eligible: result.eligible,
      });
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Could not check distance'));
    }
  }
}
