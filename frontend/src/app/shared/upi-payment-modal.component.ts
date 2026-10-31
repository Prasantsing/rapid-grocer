import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Order, UpiPaymentDetails } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from './inr.pipe';

@Component({
  selector: 'app-upi-payment-modal',
  standalone: true,
  imports: [InrPipe],
  template: `
    <div class="upi-overlay" (click)="onBackdropClick($event)">
      <div class="upi-sheet" role="dialog" aria-modal="true" aria-labelledby="upi-dialog-title">
        <!-- Close Button -->
        @if (status() !== 'success') {
          <button type="button" class="sheet-close-btn" (click)="requestClose()" aria-label="Close UPI payment">
            <i class="bi bi-x-lg"></i>
          </button>
        }

        <!-- SUCCESS STATE -->
        @if (status() === 'success') {
          <div class="text-center py-4 px-3">
            <div class="success-sparkle-circle mb-3 mx-auto">
              <i class="bi bi-check2-circle text-success fs-1"></i>
            </div>
            <h3 id="upi-dialog-title" class="fw-bold mb-1 text-ink">Payment Successful!</h3>
            <p class="fs-4 fw-bold text-success mb-2">{{ details.amount | inr }}</p>
            <p class="text-muted small mb-3">
              Order #<b>{{ details.orderNumber }}</b> has been verified and confirmed.<br>
              Our partner is packing your items now.
            </p>
            <div class="d-inline-flex align-items-center gap-2 p-2 px-3 rounded-pill bg-success-subtle text-success small mb-4">
              <span class="spinner-border spinner-border-sm" role="status"></span>
              <span>Redirecting to live order tracking in {{ redirectCountdown() }}s…</span>
            </div>
            <div>
              <button type="button" class="btn btn-success w-100 py-2 fw-semibold" (click)="finishRedirect()">
                Track Order Live Now →
              </button>
            </div>
          </div>
        } @else {
          <!-- ACTIVE PAYMENT STATE -->
          <div class="upi-content">
            <!-- Header -->
            <div class="text-center mb-3">
              <div class="d-inline-flex align-items-center gap-2 px-2 py-1 rounded-pill bg-light border small text-muted mb-2">
                <i class="bi bi-shield-check text-success"></i>
                <span>100% Secure UPI · ZapBasket Verified</span>
              </div>
              <h3 id="upi-dialog-title" class="h5 fw-bold mb-1 text-ink">Pay with UPI</h3>
              <div class="pay-amount-hero">{{ details.amount | inr }}</div>
              <div class="text-muted small">
                Order #<b>{{ details.orderNumber }}</b> · Payee: <b>{{ details.payeeName || 'ZapBasket' }}</b>
              </div>
            </div>

            <!-- Mobile: Direct 1-Tap UPI App Launch Buttons -->
            <div class="mb-3">
              <div class="text-muted small fw-semibold mb-2 text-start">
                <i class="bi bi-phone me-1 text-primary"></i> 1-Tap UPI Apps:
              </div>
              <div class="upi-app-grid">
                <a
                  [href]="details.gpayUri || details.genericUri"
                  class="upi-app-card gpay-card"
                  (click)="onAppClicked('Google Pay')"
                >
                  <div class="upi-app-icon gpay-icon">
                    <span class="gpay-g">G</span><span class="gpay-pay">Pay</span>
                  </div>
                  <span class="upi-app-name">Google Pay</span>
                </a>

                <a
                  [href]="details.phonepeUri || details.genericUri"
                  class="upi-app-card phonepe-card"
                  (click)="onAppClicked('PhonePe')"
                >
                  <div class="upi-app-icon phonepe-icon">
                    <i class="bi bi-p-circle-fill"></i>
                  </div>
                  <span class="upi-app-name">PhonePe</span>
                </a>

                <a
                  [href]="details.paytmUri || details.genericUri"
                  class="upi-app-card paytm-card"
                  (click)="onAppClicked('Paytm')"
                >
                  <div class="upi-app-icon paytm-icon">
                    <span>Paytm</span>
                  </div>
                  <span class="upi-app-name">Paytm</span>
                </a>

                <a
                  [href]="details.genericUri"
                  class="upi-app-card any-upi-card"
                  (click)="onAppClicked('Any UPI')"
                >
                  <div class="upi-app-icon any-icon">
                    <i class="bi bi-lightning-charge-fill text-warning"></i>
                  </div>
                  <span class="upi-app-name">Other UPI</span>
                </a>
              </div>
            </div>

            <!-- QR Code Section for Scanning / Desktop -->
            <div class="qr-box-container mb-3 text-center">
              <div class="qr-wrapper">
                <img
                  [src]="qrImageUrl()"
                  alt="Scan UPI QR Code to Pay"
                  class="qr-code-img"
                  width="168"
                  height="168"
                  loading="eager"
                />
              </div>
              <div class="d-flex align-items-center justify-content-center gap-2 mt-2">
                <span class="vpa-badge font-monospace">{{ details.upiId }}</span>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary py-0 px-2 copy-btn"
                  (click)="copyVpa()"
                  title="Copy UPI ID"
                >
                  <i class="bi" [class.bi-clipboard]="!vpaCopied()" [class.bi-check-lg]="vpaCopied()"></i>
                  <span class="ms-1" style="font-size: 0.72rem;">{{ vpaCopied() ? 'Copied' : 'Copy' }}</span>
                </button>
              </div>
              <div class="text-muted small mt-1" style="font-size: 0.75rem;">
                Scan with GPay, PhonePe, Paytm, BHIM, or any banking app
              </div>
            </div>

            <!-- Primary Action Buttons -->
            <div class="d-flex flex-column gap-2">
              <button
                type="button"
                class="btn btn-success btn-lg w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                [disabled]="isVerifying()"
                (click)="confirmPaymentCompleted()"
              >
                @if (isVerifying()) {
                  <span class="spinner-border spinner-border-sm" role="status"></span>
                  <span>Verifying Payment…</span>
                } @else {
                  <i class="bi bi-check-circle-fill"></i>
                  <span>I Have Paid — Confirm Order</span>
                }
              </button>

              <!-- Helpful Fallbacks -->
              <div class="d-flex align-items-center justify-content-between gap-2 mt-1">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm flex-grow-1 py-1"
                  [disabled]="isSwitching()"
                  (click)="switchToCod()"
                >
                  @if (isSwitching()) {
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    <span>Switching…</span>
                  } @else {
                    <i class="bi bi-cash me-1"></i> Pay with Cash on Delivery
                  }
                </button>

                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm py-1 px-2"
                  [disabled]="isCancelling()"
                  (click)="cancelAndRestoreCart()"
                  title="Cancel this order and keep your basket items"
                >
                  @if (isCancelling()) {
                    <span class="spinner-border spinner-border-sm" role="status"></span>
                  } @else {
                    <i class="bi bi-x-circle me-1"></i> Cancel
                  }
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .upi-overlay {
      position: fixed;
      inset: 0;
      background: rgba(11, 15, 21, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: fadeIn 0.2s ease-out;
    }

    .upi-sheet {
      position: relative;
      background: var(--card, #ffffff);
      color: var(--ink, #1e293b);
      border: 1px solid var(--card-border, rgba(0, 0, 0, 0.1));
      border-radius: 24px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25);
      width: 100%;
      max-width: 440px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sheet-close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid var(--line, #e2e8f0);
      background: var(--chip-bg, #f8fafc);
      color: var(--ink, #334155);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      z-index: 2;
    }
    .sheet-close-btn:hover {
      background: var(--line, #e2e8f0);
      transform: scale(1.05);
    }

    .pay-amount-hero {
      font-family: Outfit, sans-serif;
      font-size: 2.2rem;
      font-weight: 750;
      color: var(--ink, #0f172a);
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .upi-app-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
    }

    .upi-app-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.65rem 0.25rem;
      border-radius: 14px;
      border: 1px solid var(--line, #e2e8f0);
      background: var(--chip-bg, #f8fafc);
      text-decoration: none;
      color: var(--ink, #1e293b);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .upi-app-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
      border-color: var(--leaf, #059669);
    }

    .upi-app-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-bottom: 0.35rem;
    }

    .gpay-card .upi-app-icon {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      font-size: 0.9rem;
    }
    .gpay-g { color: #4285f4; font-weight: 800; }
    .gpay-pay { color: #5f6368; font-weight: 600; margin-left: 1px; }

    .phonepe-card .upi-app-icon {
      background: #5f259f;
      color: #ffffff;
      font-size: 1.3rem;
    }

    .paytm-card .upi-app-icon {
      background: #002e6e;
      color: #00b9f5;
      font-size: 0.72rem;
      font-weight: 800;
    }

    .any-upi-card .upi-app-icon {
      background: #0f172a;
      color: #ffffff;
      font-size: 1.1rem;
    }

    .upi-app-name {
      font-size: 0.72rem;
      font-weight: 600;
      text-align: center;
    }

    .qr-box-container {
      background: var(--chip-bg, #f8fafc);
      border: 1px solid var(--line, #e2e8f0);
      border-radius: 16px;
      padding: 0.85rem;
    }

    .qr-wrapper {
      background: #ffffff;
      padding: 0.5rem;
      border-radius: 12px;
      display: inline-block;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .qr-code-img {
      display: block;
      border-radius: 6px;
    }

    .vpa-badge {
      font-size: 0.78rem;
      font-weight: 600;
      background: var(--card, #ffffff);
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      border: 1px solid var(--line, #e2e8f0);
      color: var(--ink, #0f172a);
    }

    .success-sparkle-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: scalePop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes scalePop {
      0% { transform: scale(0.6); opacity: 0; }
      70% { transform: scale(1.15); }
      100% { transform: scale(1); opacity: 1; }
    }

    @media (max-width: 576px) {
      .upi-sheet {
        padding: 1.25rem 1rem;
        border-radius: 20px;
      }
      .pay-amount-hero {
        font-size: 1.9rem;
      }
      .upi-app-icon {
        width: 36px;
        height: 36px;
      }
    }
  `],
})
export class UpiPaymentModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) details!: UpiPaymentDetails;
  @Output() paymentSuccess = new EventEmitter<Order>();
  @Output() paymentCancelled = new EventEmitter<void>();
  @Output() switchedToCod = new EventEmitter<Order>();
  @Output() payLater = new EventEmitter<Order>();

  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly status = signal<'idle' | 'success'>('idle');
  readonly isVerifying = signal(false);
  readonly isSwitching = signal(false);
  readonly isCancelling = signal(false);
  readonly vpaCopied = signal(false);
  readonly redirectCountdown = signal(2);

  private pollTimer: any = null;
  private redirectTimer: any = null;

  ngOnInit() {
    this.startBackgroundStatusPoll();
  }

  ngOnDestroy() {
    this.stopTimers();
  }

  private stopTimers() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.redirectTimer) {
      clearInterval(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  qrImageUrl(): string {
    const data = encodeURIComponent(this.details.genericUri);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${data}`;
  }

  copyVpa() {
    const vpa = this.details.upiId;
    navigator.clipboard?.writeText(vpa);
    this.vpaCopied.set(true);
    this.toasts.show('UPI ID copied to clipboard');
    setTimeout(() => this.vpaCopied.set(false), 2000);
  }

  onAppClicked(appName: string) {
    this.toasts.show(`Opening ${appName}… complete your payment in the app.`);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('upi-overlay')) {
      this.requestClose();
    }
  }

  requestClose() {
    if (this.status() === 'success') {
      this.finishRedirect();
      return;
    }
    this.paymentCancelled.emit();
  }

  async confirmPaymentCompleted() {
    if (this.isVerifying()) return;
    this.isVerifying.set(true);
    try {
      const result = await this.shop.verifyUpiPayment({
        orderId: this.details.orderId,
        status: 'success',
      });
      this.stopTimers();
      this.status.set('success');
      this.toasts.show('Payment confirmed! Preparing your delivery.');
      this.startRedirectCountdown(result.order);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.isVerifying.set(false);
    }
  }

  async switchToCod() {
    if (this.isSwitching()) return;
    this.isSwitching.set(true);
    try {
      const order = await this.shop.switchToCod(this.details.orderId);
      this.stopTimers();
      this.toasts.show('Switched to Cash on Delivery! Order confirmed.');
      this.switchedToCod.emit(order);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.isSwitching.set(false);
    }
  }

  async cancelAndRestoreCart() {
    if (this.isCancelling()) return;
    this.isCancelling.set(true);
    try {
      await this.shop.cancelAndRestoreCart(this.details.orderId, 'User cancelled from UPI sheet');
      await this.shop.loadCart();
      this.stopTimers();
      this.toasts.show('Order cancelled. Items returned to your basket.');
      this.paymentCancelled.emit();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.isCancelling.set(false);
    }
  }

  private startBackgroundStatusPoll() {
    this.pollTimer = setInterval(async () => {
      if (this.status() === 'success') return;
      try {
        const check = await this.shop.getUpiStatus(this.details.orderId);
        if (check.isConfirmed || check.paymentStatus === 'paid' || check.orderStatus === 'confirmed') {
          this.stopTimers();
          this.status.set('success');
          this.toasts.show('Payment verified via gateway!');
          this.startRedirectCountdown(null);
        }
      } catch {
        // Ignore background polling errors
      }
    }, 3000);
  }

  private lastOrder: Order | null = null;

  private startRedirectCountdown(order: Order | null) {
    this.lastOrder = order;
    this.redirectCountdown.set(2);
    this.redirectTimer = setInterval(() => {
      const current = this.redirectCountdown();
      if (current <= 1) {
        this.stopTimers();
        this.finishRedirect();
      } else {
        this.redirectCountdown.set(current - 1);
      }
    }, 1000);
  }

  finishRedirect() {
    this.stopTimers();
    if (this.lastOrder) {
      this.paymentSuccess.emit(this.lastOrder);
    } else {
      this.router.navigate(['/orders', this.details.orderId]);
    }
  }
}
