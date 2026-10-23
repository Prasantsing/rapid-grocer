import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { StoreConfig } from '../core/models';
import { InrPipe } from '../shared/inr.pipe';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InrPipe],
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
                <div class="d-flex align-items-center gap-2">
                  <div class="p-2 rounded-3 bg-primary-subtle text-primary">
                    <i class="bi bi-qr-code fs-5"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold mb-0">Merchant UPI & Webhook Parameters</h5>
                    <small class="text-muted">Settlement VPA and automated callback security</small>
                  </div>
                </div>
              </div>
              <div class="card-body p-4 pt-2">
                <div class="row g-3 mb-3">
                  <div class="col-sm-6">
                    <label for="upiVpa" class="form-label small fw-semibold">Payee UPI VPA</label>
                    <input
                      id="upiVpa"
                      type="text"
                      class="form-control font-monospace"
                      [(ngModel)]="formData.upiVpa"
                      placeholder="e.g. 9101516662@ybl"
                    />
                    <div class="form-text small">Receives customer payments</div>
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
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminSettingsPage implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);

  readonly config = signal<StoreConfig | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  formData: any = {
    isOpen: true,
    closedReason: '',
    openingTime: '07:00',
    closingTime: '23:00',
    deliveryRadiusKm: 8.0,
    minOrderAmount: 99,
    freeDeliveryThreshold: 299,
    deliveryFee: 25,
    allowCustomerCancellation: true,
    cancellationWindowMinutes: 3,
    allowDirectRiderContact: true,
    nonReturnableNotice: 'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered.',
    upiVpa: '9101516662@ybl',
    payeeName: 'ZapBasket',
    webhookSecret: 'zb_webhook_secret_live',
    supportPhone: '+91 9101516662',
    supportEmail: 'support@zapbasket.store',
    storeLocation: {
      lat: 12.9352,
      lng: 77.6245,
      address: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
    },
  };

  testCoords = '12.9352, 77.6245';
  readonly testResult = signal<{ distanceKm: number; eligible: boolean } | null>(null);

  ngOnInit() {
    void this.loadConfig();
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
        upiVpa: data.upiVpa || '9101516662@ybl',
        payeeName: data.payeeName || 'ZapBasket',
        webhookSecret: data.webhookSecret || 'zb_webhook_secret_live',
        supportPhone: data.supportPhone || '+91 9101516662',
        supportEmail: data.supportEmail || 'support@zapbasket.store',
        storeLocation: {
          lat: data.storeLocation?.lat ?? 12.9352,
          lng: data.storeLocation?.lng ?? 77.6245,
          address: data.storeLocation?.address || 'Koramangala 4th Block, Bengaluru',
        },
      };
    } catch (error) {
      this.toasts.error(errorMessage(error, 'Could not load store configuration'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveConfig() {
    this.isSaving.set(true);
    try {
      const updated = await this.shop.updateStoreConfig(this.formData);
      this.config.set(updated);
      this.toasts.show('Store operational settings saved successfully!');
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
