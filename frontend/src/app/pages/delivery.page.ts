import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Order, RiderLedgerResponse, StoreConfig } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';
import { RiderNavigationModalComponent } from '../shared/rider-navigation-modal.component';

@Component({
  selector: 'app-delivery-page',
  imports: [DatePipe, InrPipe, RiderNavigationModalComponent],
  template: `
    <div class="section-head mb-3">
      <div>
        <h2>Your runs</h2>
        <p class="muted mb-0">Deliver groceries within 10-15 minutes</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <div class="px-3 py-1 bg-warning-subtle text-warning-emphasis rounded-3 border border-warning-subtle text-center">
          <small class="d-block" style="font-size: 0.68rem;">RIDER RATING</small>
          <strong class="fs-6">⭐ {{ avgRiderRating() }}/5</strong>
        </div>
        <div class="px-3 py-1 bg-success-subtle text-success rounded-3 border border-success-subtle text-center">
          <small class="d-block" style="font-size: 0.68rem;">TIPS EARNED</small>
          <strong class="fs-6">{{ totalTips() | inr }}</strong>
        </div>
        <button
          type="button"
          class="btn px-3 py-1 bg-info-subtle text-info-emphasis rounded-3 border border-info-subtle text-center p-0"
          (click)="showLedgerModal.set(true)">
          <small class="d-block" style="font-size: 0.68rem;">CASH IN HAND (COD)</small>
          <strong class="fs-6">{{ riderLedger()?.cashInHand || 0 | inr }}</strong>
        </button>
      </div>
    </div>
    <div class="d-flex gap-2 mb-3">
      @for (tab of tabs; track tab.id) {
        <button class="btn" type="button" [class.btn-dark]="scope() === tab.id" [class.btn-outline-dark]="scope() !== tab.id" (click)="setScope(tab.id)">{{ tab.label }}</button>
      }
    </div>
    @if (loading()) { <p class="muted">Checking the board…</p> }
    @else if (!orders().length) {
      <div class="empty panel"><h2>Nothing in this pile</h2><p>New confirmed orders show up under Open.</p></div>
    } @else {
      <div class="job">
        @for (order of orders(); track order.id) {
          <article class="panel">
            <div class="d-flex justify-content-between">
              <strong>{{ order.orderNumber }}</strong>
              <span [class]="'status-pill ' + order.status">{{ label(order.status) }}</span>
            </div>
            <p class="mb-1 mt-2">
              <strong>{{ order.address.fullName }}</strong> ·
              <a [href]="'tel:' + order.address.phone" class="text-decoration-none text-dark fw-semibold">
                <i class="bi bi-telephone text-success me-1"></i>{{ order.address.phone }}
              </a>
            </p>
            <p class="muted mb-2">
              {{ order.address.line1 }}@if (order.address.line2) {, {{ order.address.line2 }}}
              <br>
              @if (order.address.landmark) {
                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle me-1">
                  <i class="bi bi-pin-map-fill"></i> Landmark: {{ order.address.landmark }}
                </span>
              }
              {{ order.address.city }} {{ order.address.pincode }}
            </p>
            <p class="mb-2">{{ order.items.length }} items · {{ order.total | inr }} · {{ order.createdAt | date:'h:mm a' }}</p>

            @if (order.feedback?.riderRating) {
              <div class="mt-2 py-1 px-2 rounded bg-warning-subtle text-warning-emphasis small d-flex align-items-center justify-content-between">
                <span><i class="bi bi-star-fill text-warning me-1"></i> Customer Rating: <b>{{ order.feedback?.riderRating }}/5</b></span>
                @if (order.feedback?.deliveryTags?.length) {
                  <span class="text-secondary font-monospace" style="font-size: 0.72rem;">{{ order.feedback?.deliveryTags?.join(', ') }}</span>
                }
              </div>
            }

            @if (order.tip && order.tip.amount > 0) {
              <div class="mt-1 py-1 px-2 rounded bg-success-subtle text-success small d-flex align-items-center justify-content-between">
                <span><i class="bi bi-cash-coin me-1"></i> Customer Tip: <b>{{ order.tip.amount | inr }}</b></span>
                <span class="badge bg-success text-white">Direct Tip</span>
              </div>
            }

            <div class="d-flex gap-2 flex-wrap mt-3 align-items-center justify-content-between">
              <div class="d-flex gap-2 flex-wrap">
                @if (scope() === 'available') {
                  <button class="btn btn-dark" type="button" (click)="accept(order)">Accept run</button>
                }
                @if (order.status === 'packed') {
                  <button class="btn btn-warning" type="button" (click)="move(order, 'out_for_delivery')">
                    <i class="bi bi-bicycle me-1"></i> I'm on the way
                  </button>
                }
                @if (order.status === 'out_for_delivery') {
                  <button class="btn btn-dark" type="button" (click)="openOtpPrompt(order)">
                    <i class="bi bi-shield-check me-1"></i> Verify OTP & Deliver
                  </button>
                }
              </div>

              <!-- RIDER DIRECTION GUIDE & ROUTE MAP BUTTON -->
              <button
                type="button"
                class="btn btn-outline-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                (click)="openNavigation(order)">
                <i class="bi bi-compass"></i>
                <span>Navigate</span>
                @if (order.address.landmark) {
                  <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle ms-1" style="font-size: 0.65rem;">
                    Guide
                  </span>
                }
              </button>
            </div>
          </article>
        }
      </div>
    }

    <!-- RIDER DIRECTION GUIDE & OSM MAP MODAL -->
    @if (activeNavOrder()) {
      <app-rider-navigation-modal
        [order]="activeNavOrder()!"
        [storeConfig]="storeConfig()"
        (close)="activeNavOrder.set(null)"
        (statusChange)="onNavStatusChange($event)" />
    }

    <!-- RIDER DOORSTEP DELIVERY OTP MODAL -->
    @if (otpPromptOrder(); as ord) {
      <div class="review-modal-backdrop" (click)="closeOtpModal()">
        <div class="review-modal-content" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center bg-dark text-white rounded-top">
            <h5 class="h6 fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-shield-lock-fill text-warning"></i>
              Doorstep Delivery Verification
            </h5>
            <button type="button" class="btn-close btn-close-white" (click)="closeOtpModal()"></button>
          </div>

          <div class="p-3">
            <div class="p-3 mb-3 bg-light rounded-3 border">
              <div class="d-flex justify-content-between align-items-center">
                <strong>{{ ord.orderNumber }}</strong>
                <span class="badge bg-secondary font-monospace">{{ ord.total | inr }}</span>
              </div>
              <div class="small text-muted mt-1">
                <strong>Customer:</strong> {{ ord.address.fullName }} ·
                <a [href]="'tel:' + ord.address.phone" class="text-decoration-none fw-semibold text-dark">
                  <i class="bi bi-telephone text-success me-1"></i>{{ ord.address.phone }}
                </a>
              </div>
              @if (ord.paymentMethod === 'cod') {
                <div class="mt-2 py-1 px-2 rounded bg-warning-subtle text-warning-emphasis small fw-bold">
                  <i class="bi bi-cash-stack me-1"></i> Collect {{ ord.total | inr }} Cash on Delivery
                </div>
              }
            </div>

            <label class="form-label small fw-bold text-uppercase text-muted d-block text-center mb-1">
              Enter 4-Digit Customer OTP
            </label>
            <div class="d-flex justify-content-center mb-3">
              <input
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="4"
                autocomplete="one-time-code"
                class="form-control form-control-lg text-center font-monospace fw-bold fs-2"
                style="letter-spacing: 0.35em; width: 220px;"
                placeholder="••••"
                [value]="otpValue()"
                (input)="onOtpInput($event)"
                autofocus
              />
            </div>

            @if (otpError()) {
              <div class="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                <div>{{ otpError() }}</div>
              </div>
            }

            <button
              type="button"
              class="btn btn-success w-100 fw-bold py-2 mb-2 d-flex align-items-center justify-content-center gap-2"
              [disabled]="otpValue().length !== 4 || verifyingOtp()"
              (click)="submitDeliveryOtp()">
              @if (verifyingOtp()) {
                <span class="spinner-border spinner-border-sm"></span> Verifying Handover…
              } @else {
                <i class="bi bi-check2-circle fs-5"></i> Verify & Mark Delivered
              }
            </button>

            <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                [disabled]="resendingRiderOtp()"
                (click)="resendOtpForOrder(ord.id)">
                <i class="bi bi-arrow-clockwise me-1" [class.spin]="resendingRiderOtp()"></i> Resend OTP SMS
              </button>

              <button
                type="button"
                class="btn btn-link btn-sm text-decoration-none text-muted p-0"
                (click)="showAdminBypassInfo.set(!showAdminBypassInfo())">
                Customer offline?
              </button>
            </div>

            @if (showAdminBypassInfo()) {
              <div class="mt-2 p-2 bg-warning-subtle rounded border border-warning-subtle small text-dark">
                <i class="bi bi-info-circle me-1 text-warning-emphasis"></i>
                If customer's phone is discharged or unreachable, contact Dark Store Desk at
                <a [href]="'tel:' + (storeConfig()?.supportPhone || '+919101516662')" class="fw-bold text-dark">
                  {{ storeConfig()?.supportPhone || '+91 9101516662' }}
                </a>
                to verify with manager authorization.
              </div>
            }
          </div>
        </div>
      </div>
    }

    <!-- RIDER CASH DRAWER & SETTLEMENT MODAL -->
    @if (showLedgerModal()) {
      <div class="review-modal-backdrop" (click)="showLedgerModal.set(false)">
        <div class="review-modal-content" style="max-width: 480px;" (click)="$event.stopPropagation()">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h5 class="h6 fw-bold mb-0">
              <i class="bi bi-wallet2 text-primary me-1"></i>
              Cash in Hand (COD Drawer)
            </h5>
            <button type="button" class="btn-close" (click)="showLedgerModal.set(false)"></button>
          </div>

          <div class="p-3">
            <div class="p-3 bg-light rounded-3 border text-center mb-3">
              <span class="text-muted small text-uppercase fw-semibold d-block">Unremitted Cash Balance</span>
              <h2 class="fw-bold text-dark my-1">{{ riderLedger()?.cashInHand || 0 | inr }}</h2>
              <div class="text-muted" style="font-size: 0.75rem;">
                <i class="bi bi-info-circle me-1"></i>
                Deposit this cash with the dark store cashier at the end of your shift.
              </div>
            </div>

            <h6 class="small fw-bold text-muted text-uppercase mb-2">Recent Shift Settlements</h6>
            @if (!riderLedger()?.settlements?.length) {
              <div class="p-3 bg-white border rounded text-center text-muted small">
                No past cash deposits recorded yet.
              </div>
            } @else {
              <div class="d-flex flex-column gap-2" style="max-height: 240px; overflow-y: auto;">
                @for (s of riderLedger()!.settlements; track s.receiptNumber) {
                  <div class="p-2 border rounded bg-white small d-flex justify-content-between align-items-center">
                    <div>
                      <strong class="text-success">{{ s.amount | inr }} deposited</strong>
                      <div class="text-muted" style="font-size: 0.7rem;">Receipt: {{ s.receiptNumber }} · {{ s.settledAt | date:'d MMM, h:mm a' }}</div>
                    </div>
                    <span class="badge bg-success-subtle text-success border border-success-subtle">Settled</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class DeliveryPage {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly orders = signal<Order[]>([]);
  readonly scope = signal<'available' | 'active' | 'history'>('active');
  readonly loading = signal(true);
  readonly riderLedger = signal<RiderLedgerResponse | null>(null);
  readonly showLedgerModal = signal(false);
  readonly storeConfig = signal<StoreConfig | null>(null);
  readonly activeNavOrder = signal<Order | null>(null);
  readonly otpPromptOrder = signal<Order | null>(null);
  readonly otpValue = signal<string>('');
  readonly otpError = signal<string>('');
  readonly verifyingOtp = signal<boolean>(false);
  readonly resendingRiderOtp = signal<boolean>(false);
  readonly showAdminBypassInfo = signal<boolean>(false);
  readonly tabs = [
    { id: 'active' as const, label: 'Active' },
    { id: 'available' as const, label: 'Open' },
    { id: 'history' as const, label: 'History' },
  ];

  readonly totalTips = computed(() =>
    this.orders().reduce((sum, o) => sum + (o.tip?.amount || 0), 0)
  );

  readonly avgRiderRating = computed(() => {
    const rated = this.orders().filter((o) => o.feedback?.riderRating);
    if (!rated.length) return '5.0';
    const sum = rated.reduce((s, o) => s + (o.feedback?.riderRating || 0), 0);
    return (sum / rated.length).toFixed(1);
  });

  constructor() {
    void this.load();
    void this.loadLedger();
    void this.loadStoreConfig();
  }

  async loadStoreConfig() {
    try {
      const cfg = await this.shop.loadStoreConfig();
      if (cfg) this.storeConfig.set(cfg);
    } catch (_) {}
  }

  openNavigation(order: Order) {
    this.activeNavOrder.set(order);
  }

  openOtpPrompt(order: Order) {
    this.otpPromptOrder.set(order);
    this.otpValue.set('');
    this.otpError.set('');
    this.showAdminBypassInfo.set(false);
  }

  closeOtpModal() {
    this.otpPromptOrder.set(null);
    this.otpValue.set('');
    this.otpError.set('');
    this.showAdminBypassInfo.set(false);
  }

  onOtpInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 4);
    this.otpValue.set(clean);
    this.otpError.set('');
  }

  async submitDeliveryOtp() {
    const order = this.otpPromptOrder();
    const otp = this.otpValue();
    if (!order || otp.length !== 4) return;

    this.verifyingOtp.set(true);
    this.otpError.set('');
    try {
      await this.shop.verifyDeliveryOtp(order.id, otp);
      this.toasts.show(`Order ${order.orderNumber} successfully delivered!`);
      this.closeOtpModal();
      if (this.activeNavOrder()?.id === order.id) {
        this.activeNavOrder.set(null);
      }
      await this.load();
      await this.loadLedger();
    } catch (err) {
      this.otpError.set(errorMessage(err));
    } finally {
      this.verifyingOtp.set(false);
    }
  }

  async resendOtpForOrder(orderId: string) {
    this.resendingRiderOtp.set(true);
    try {
      const res = await this.shop.resendDeliveryOtp(orderId);
      this.toasts.show(res.message || 'OTP resent to customer via SMS!');
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.resendingRiderOtp.set(false);
    }
  }

  async onNavStatusChange(event: { order: Order; status: string }) {
    if (event.status === 'delivered') {
      this.openOtpPrompt(event.order);
      return;
    }
    await this.move(event.order, event.status);
    if (this.activeNavOrder()?.id === event.order.id) {
      this.activeNavOrder.set({
        ...event.order,
        status: event.status as any,
      });
    }
  }

  async loadLedger() {
    try {
      const data = await this.shop.getRiderLedger();
      this.riderLedger.set(data);
    } catch (_) {}
  }

  label(status: string) { return STATUS_LABEL[status] || status; }

  setScope(scope: 'available' | 'active' | 'history') {
    this.scope.set(scope);
    void this.load();
  }

  async accept(order: Order) {
    try {
      await this.shop.acceptOrder(order.id);
      this.toasts.show('Run accepted');
      this.scope.set('active');
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async move(order: Order, status: string) {
    try {
      await this.shop.updateOrderStatus(order.id, status);
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async load() {
    this.loading.set(true);
    try {
      const page = await this.shop.orders({ scope: this.scope() });
      this.orders.set(page.items);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
