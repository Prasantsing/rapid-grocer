import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Address, Coupon, Order, PaymentPayload, UpiPaymentDetails } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { UpiPaymentModalComponent } from '../shared/upi-payment-modal.component';
import { AddressFormComponent } from '../shared/address-form.component';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface DeliveryInstructionOption {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    InrPipe,
    UpiPaymentModalComponent,
    AddressFormComponent,
  ],
  template: `
    <div class="checkout-layout">
      <!-- Breadcrumb Header -->
      <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <a routerLink="/cart" class="text-decoration-none text-muted small d-inline-flex align-items-center gap-1 hover-lift">
          <i class="bi bi-arrow-left"></i>
          <span>Back to Basket</span>
        </a>
        <div class="express-badge">
          <i class="bi bi-lightning-charge-fill text-warning"></i>
          <span>12-Min Delivery</span>
        </div>
      </div>

      @if (!shop.cart()?.items?.length) {
        <div class="empty-checkout panel text-center py-5">
          <div class="empty-basket-icon mb-3">
            <i class="bi bi-basket3 text-muted display-4"></i>
          </div>
          <h2 class="h4 fw-bold mb-2 text-ink">Your basket is empty</h2>
          <p class="text-muted small mb-4">Add fresh fruits, veggies, or snacks before checking out.</p>
          <a class="btn btn-success px-4 py-2 fw-semibold" routerLink="/">Browse Catalog</a>
        </div>
      } @else {
        <div class="checkout-grid">
          <!-- LEFT COLUMN: Address, Delivery Instructions, Payment Selection -->
          <div class="checkout-main">
            <!-- 1. DELIVERY ADDRESS CARD -->
            <section class="checkout-card mb-3">
              <div class="card-head">
                <div class="d-flex align-items-center gap-2">
                  <div class="step-num">1</div>
                  <h3 class="h6 fw-bold mb-0 text-ink">Delivery Location</h3>
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-success change-btn"
                  (click)="openAddressModal()"
                >
                  <i class="bi bi-arrow-left-right me-1"></i> Change
                </button>
              </div>

              @if (currentAddress(); as addr) {
                <div class="active-address-card mt-3">
                  <div class="d-flex align-items-start gap-3">
                    <div class="address-type-icon">
                      <i class="bi" [class.bi-house-heart-fill]="addr.label.toLowerCase() === 'home'"
                             [class.bi-briefcase-fill]="addr.label.toLowerCase() === 'work'"
                             [class.bi-geo-alt-fill]="addr.label.toLowerCase() !== 'home' && addr.label.toLowerCase() !== 'work'"></i>
                    </div>
                    <div class="flex-grow-1 min-w-0">
                      <div class="d-flex align-items-center gap-2">
                        <strong class="text-ink fw-bold">{{ addr.label || 'Delivery Address' }}</strong>
                        <span class="text-muted small">· {{ addr.fullName }}</span>
                      </div>
                      <p class="text-muted small mb-1 text-truncate-2 mt-1">
                        {{ addr.line1 }}, {{ addr.city }} - {{ addr.pincode }}
                      </p>
                      <div class="d-flex align-items-center gap-3 text-muted small" style="font-size: 0.76rem;">
                        <span><i class="bi bi-telephone me-1"></i>{{ addr.phone }}</span>
                        <span class="text-success"><i class="bi bi-check2-circle me-1"></i>Ready for Instant Dispatch</span>
                      </div>
                    </div>
                  </div>
                </div>
              } @else {
                <div class="no-address-box mt-3 text-center p-3 border rounded-3 bg-light">
                  <p class="text-muted small mb-2">No delivery address saved yet.</p>
                  <button type="button" class="btn btn-success btn-sm" (click)="openNewAddressForm()">
                    <i class="bi bi-plus-lg me-1"></i> Add Delivery Address (GPS Auto-Detect)
                  </button>
                </div>
              }
            </section>

            <!-- 2. DELIVERY INSTRUCTIONS (1-TAP CHIPS) -->
            <section class="checkout-card mb-3">
              <div class="card-head">
                <div class="d-flex align-items-center gap-2">
                  <div class="step-num">2</div>
                  <h3 class="h6 fw-bold mb-0 text-ink">Delivery Instructions</h3>
                </div>
                <span class="text-muted small" style="font-size: 0.74rem;">For delivery partner</span>
              </div>

              <div class="instruction-chips mt-3">
                @for (item of instructionOptions; track item.id) {
                  <button
                    type="button"
                    class="instruction-chip"
                    [class.active]="selectedInstructions().includes(item.id)"
                    (click)="toggleInstruction(item.id)"
                  >
                    <i [class]="'bi ' + item.icon"></i>
                    <span>{{ item.label }}</span>
                  </button>
                }
              </div>

              <div class="mt-2 pt-1">
                <input
                  type="text"
                  class="form-control form-control-sm instruction-input"
                  [value]="customNote()"
                  (input)="customNote.set(asValue($event))"
                  placeholder="Add specific gate code, landmark, or directions (optional)…"
                />
              </div>
            </section>

            <!-- 3. PAYMENT METHOD (STREAMLINED 1-TAP SELECTOR) -->
            <section class="checkout-card mb-3">
              <div class="card-head">
                <div class="d-flex align-items-center gap-2">
                  <div class="step-num">3</div>
                  <h3 class="h6 fw-bold mb-0 text-ink">Payment Method</h3>
                </div>
                <span class="text-success small fw-semibold">
                  <i class="bi bi-shield-lock-fill me-1"></i> 100% Safe & Encrypted
                </span>
              </div>

              <div class="payment-options mt-3">
                <!-- Option A: UPI (Recommended) -->
                <div
                  class="payment-option-card"
                  [class.selected]="method() === 'upi'"
                  (click)="method.set('upi')"
                >
                  <div class="form-check m-0 d-flex align-items-center">
                    <input
                      class="form-check-input mt-0 me-3"
                      type="radio"
                      name="paymentMethod"
                      id="methodUpi"
                      [checked]="method() === 'upi'"
                    />
                  </div>
                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div class="d-flex align-items-center gap-2">
                        <strong class="text-ink">UPI (Google Pay, PhonePe, Paytm, QR)</strong>
                        <span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size: 0.65rem;">
                          RECOMMENDED
                        </span>
                      </div>
                      <div class="payment-brand-logos">
                        <span class="brand-pill">GPay</span>
                        <span class="brand-pill">PhonePe</span>
                        <span class="brand-pill">Paytm</span>
                        <span class="brand-pill">QR</span>
                      </div>
                    </div>
                    <p class="text-muted small mb-0 mt-1">
                      Fastest 1-tap payment via any UPI app on your phone or scan instant QR code.
                    </p>
                  </div>
                </div>

                <!-- Option B: Cash / UPI on Delivery (Pay at Door) -->
                <div
                  class="payment-option-card"
                  [class.selected]="method() === 'cod'"
                  (click)="method.set('cod')"
                >
                  <div class="form-check m-0 d-flex align-items-center">
                    <input
                      class="form-check-input mt-0 me-3"
                      type="radio"
                      name="paymentMethod"
                      id="methodCod"
                      [checked]="method() === 'cod'"
                    />
                  </div>
                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex align-items-center justify-content-between gap-2">
                      <strong class="text-ink">Cash / UPI on Delivery</strong>
                      <span class="text-muted small"><i class="bi bi-cash-coin text-success me-1"></i>Pay at Door</span>
                    </div>
                    <p class="text-muted small mb-0 mt-1">
                      Pay cash or scan the delivery partner's QR code when your bag arrives.
                    </p>
                  </div>
                </div>

                <!-- Option C: Cards & NetBanking -->
                <div
                  class="payment-option-card"
                  [class.selected]="method() === 'razorpay'"
                  (click)="method.set('razorpay')"
                >
                  <div class="form-check m-0 d-flex align-items-center">
                    <input
                      class="form-check-input mt-0 me-3"
                      type="radio"
                      name="paymentMethod"
                      id="methodCards"
                      [checked]="method() === 'razorpay'"
                    />
                  </div>
                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex align-items-center justify-content-between gap-2">
                      <strong class="text-ink">Cards & NetBanking</strong>
                      <div class="payment-brand-logos">
                        <span class="brand-pill">Visa</span>
                        <span class="brand-pill">Mastercard</span>
                        <span class="brand-pill">RuPay</span>
                      </div>
                    </div>
                    <p class="text-muted small mb-0 mt-1">
                      Pay with Credit/Debit cards, NetBanking, or digital wallets via Razorpay.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- RIGHT COLUMN: Bill Summary, Savings, & Guarantees -->
          <aside class="checkout-sidebar">
            <div class="checkout-card mb-3">
              <h3 class="h6 fw-bold mb-3 text-ink">Bill Summary</h3>

              <div class="bill-rows">
                <div class="bill-row">
                  <span class="text-muted">Item Total</span>
                  <span class="fw-semibold text-ink">{{ shop.cart()!.subtotal | inr }}</span>
                </div>

                @if ((shop.cart()!.discount || 0) > 0) {
                  <div class="bill-row text-success">
                    <span>Discount Savings</span>
                    <span>− {{ shop.cart()!.discount | inr }}</span>
                  </div>
                }

                <div class="bill-row">
                  <span class="text-muted">Delivery Fee</span>
                  @if (shop.cart()!.deliveryFee === 0) {
                    <span class="text-success fw-bold">FREE</span>
                  } @else {
                    <span class="fw-semibold text-ink">{{ shop.cart()!.deliveryFee | inr }}</span>
                  }
                </div>

                <div class="bill-divider my-2"></div>

                <div class="bill-row total-row">
                  <span class="fw-bold fs-5 text-ink">To Pay</span>
                  <span class="fw-bold fs-4 text-success">{{ shop.cart()!.total | inr }}</span>
                </div>
              </div>

              <!-- Savings Celebration Pill -->
              @if (totalSavings() > 0) {
                <div class="savings-banner mt-3">
                  <i class="bi bi-tag-fill me-1 text-success"></i>
                  <span>Yay! You're saving <b>{{ totalSavings() | inr }}</b> on this order</span>
                </div>
              }

              <!-- Coupon Code Input & Chips -->
              <div class="coupon-box mt-3 pt-3 border-top">
                <div class="d-flex gap-2">
                  <input
                    type="text"
                    class="form-control form-control-sm text-uppercase"
                    placeholder="Enter coupon code"
                    [value]="enteredCouponCode()"
                    (input)="enteredCouponCode.set(asValue($event))"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-success btn-sm px-3 fw-semibold"
                    [disabled]="!enteredCouponCode() || applyingCoupon()"
                    (click)="applyEnteredCoupon()"
                  >
                    @if (applyingCoupon()) {
                      <span class="spinner-border spinner-border-sm" role="status"></span>
                    } @else {
                      Apply
                    }
                  </button>
                </div>

                @if (coupons().length > 0) {
                  <div class="available-coupons mt-2">
                    <span class="text-muted small me-2" style="font-size: 0.72rem;">Available:</span>
                    @for (c of coupons(); track c.code) {
                      <button
                        type="button"
                        class="coupon-chip"
                        (click)="useCoupon(c)"
                        title="{{ c.description }}"
                      >
                        {{ c.code }}
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- Store Closed / Minimum Order Warnings -->
              @if (shop.storeConfig() && !shop.storeConfig()?.isCurrentlyOpen) {
                <div class="alert alert-warning py-2 px-3 small mt-3 mb-0 text-start">
                  <i class="bi bi-clock-history me-1"></i>
                  <b>Store Currently Closed:</b> {{ shop.storeConfig()?.closedReason || 'We are outside operational delivery hours.' }}
                </div>
              }
              @if (isBelowMinimumOrder()) {
                <div class="alert alert-info py-2 px-3 small mt-3 mb-0 text-start">
                  <i class="bi bi-info-circle me-1"></i>
                  Minimum order is <b>{{ shop.storeConfig()!.minOrderAmount | inr }}</b>. Add more items to proceed.
                </div>
              }

              <!-- Desktop Place Order Button -->
              <div class="d-none d-md-block mt-3">
                <button
                  type="button"
                  class="btn btn-success btn-lg w-100 fw-bold py-2 checkout-action-btn"
                  [disabled]="placing() || !currentAddress() || isCheckoutBlocked()"
                  (click)="place()"
                >
                  @if (placing()) {
                    <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                    <span>Placing order…</span>
                  } @else if (isCheckoutBlocked()) {
                    <span>Checkout Unavailable</span>
                  } @else if (method() === 'upi') {
                    <span>Pay {{ shop.cart()!.total | inr }} with UPI ⚡</span>
                  } @else if (method() === 'cod') {
                    <span>Place Order · Pay on Delivery →</span>
                  } @else {
                    <span>Pay {{ shop.cart()!.total | inr }} with Cards →</span>
                  }
                </button>
              </div>

              <!-- Trust & Safety Badges -->
              <div class="trust-strip mt-3 pt-2 text-muted small">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <i class="bi bi-shield-check text-success"></i>
                  <span>100% Genuine & Fresh Farm Groceries</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-arrow-counterclockwise text-primary"></i>
                  <span>No-questions-asked refund policy</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      }
    </div>

    <!-- ADDRESS SELECTION MODAL -->
    @if (showAddressModal()) {
      <div class="modal-backdrop-custom" (click)="closeAddressModal()">
        <div class="modal-dialog-custom" (click)="$event.stopPropagation()">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h4 class="h5 fw-bold mb-0 text-ink">Select Delivery Address</h4>
            <button type="button" class="btn-close" (click)="closeAddressModal()"></button>
          </div>

          @if (showAddressFormInline()) {
            <div class="mb-3">
              <app-address-form
                (saved)="onAddressAdded($event)"
                (cancelled)="showAddressFormInline.set(false)"
              />
            </div>
          } @else {
            <div class="address-picker-list mb-3">
              @for (addr of addresses(); track addr.id) {
                <div
                  class="saved-address-item"
                  [class.selected]="selectedAddressId() === addr.id"
                  (click)="selectAddress(addr.id)"
                >
                  <div class="d-flex align-items-start gap-2">
                    <i class="bi" [class.bi-house-fill]="addr.label.toLowerCase() === 'home'"
                                  [class.bi-briefcase-fill]="addr.label.toLowerCase() === 'work'"
                                  [class.bi-geo-alt-fill]="addr.label.toLowerCase() !== 'home' && addr.label.toLowerCase() !== 'work'"></i>
                    <div class="flex-grow-1 min-w-0">
                      <div class="d-flex align-items-center justify-content-between">
                        <strong class="text-ink">{{ addr.label }}</strong>
                        @if (selectedAddressId() === addr.id) {
                          <span class="badge bg-success" style="font-size: 0.65rem;">ACTIVE</span>
                        }
                      </div>
                      <div class="text-muted small mt-1 text-truncate-2">{{ addr.line1 }}, {{ addr.city }} - {{ addr.pincode }}</div>
                      <div class="text-muted small" style="font-size: 0.75rem;">{{ addr.fullName }} · {{ addr.phone }}</div>
                    </div>
                  </div>
                </div>
              }
            </div>

            <button
              type="button"
              class="btn btn-outline-success w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
              (click)="showAddressFormInline.set(true)"
            >
              <i class="bi bi-plus-circle"></i>
              <span>Add New Address with GPS</span>
            </button>
          }
        </div>
      </div>
    }

    <!-- STREAMLINED UPI MODAL -->
    @if (upiDetails(); as upi) {
      <app-upi-payment-modal
        [details]="upi"
        (paymentSuccess)="onUpiSuccess($event)"
        (paymentCancelled)="onUpiCancelled()"
        (switchedToCod)="onUpiSwitchedToCod($event)"
      />
    }
  `,
  styles: [`
    .checkout-layout {
      max-width: 1040px;
      margin: 0 auto;
      padding-bottom: 7.5rem;
    }

    .express-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 680;
      background: var(--chip-bg, #f1f5f9);
      color: var(--ink, #1e293b);
      padding: 0.25rem 0.65rem;
      border-radius: 20px;
      border: 1px solid var(--chip-border, #e2e8f0);
    }

    .checkout-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    @media (min-width: 860px) {
      .checkout-grid {
        grid-template-columns: 1.5fr 1fr;
        align-items: start;
      }
    }

    .checkout-card {
      background: var(--card, #ffffff);
      color: var(--ink, #1e293b);
      border: 1px solid var(--card-border, #e2e8f0);
      border-radius: 18px;
      padding: 1.2rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
    }

    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--leaf, #059669);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .active-address-card {
      background: var(--chip-bg, #f8fafc);
      border: 1px solid var(--chip-border, #e2e8f0);
      border-radius: 14px;
      padding: 0.95rem;
    }

    .address-type-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--card, #ffffff);
      border: 1px solid var(--line, #e2e8f0);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      color: var(--leaf, #059669);
      flex-shrink: 0;
    }

    .instruction-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .instruction-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.75rem;
      border-radius: 10px;
      border: 1px solid var(--line, #e2e8f0);
      background: var(--chip-bg, #f8fafc);
      color: var(--ink, #334155);
      font-size: 0.78rem;
      font-weight: 550;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .instruction-chip:hover {
      border-color: var(--leaf, #059669);
    }
    .instruction-chip.active {
      background: rgba(5, 150, 105, 0.12);
      border-color: var(--leaf, #059669);
      color: var(--leaf, #059669);
      font-weight: 650;
    }

    .instruction-input {
      background: var(--chip-bg, #f8fafc);
      border-color: var(--line, #e2e8f0);
      color: var(--ink, #1e293b);
      border-radius: 8px;
    }

    .payment-options {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .payment-option-card {
      display: flex;
      align-items: flex-start;
      padding: 0.95rem;
      border-radius: 14px;
      border: 1.5px solid var(--line, #e2e8f0);
      background: var(--card, #ffffff);
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .payment-option-card:hover {
      border-color: var(--leaf, #059669);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
    }
    .payment-option-card.selected {
      border-color: var(--leaf, #059669);
      background: rgba(5, 150, 105, 0.05);
    }

    .payment-brand-logos {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .brand-pill {
      font-size: 0.65rem;
      font-weight: 650;
      padding: 0.12rem 0.4rem;
      border-radius: 6px;
      background: var(--chip-bg, #f1f5f9);
      border: 1px solid var(--chip-border, #e2e8f0);
      color: var(--ink, #475569);
    }

    .bill-rows {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .bill-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.9rem;
    }

    .bill-divider {
      height: 1px;
      background: var(--line, #e2e8f0);
    }

    .savings-banner {
      background: rgba(5, 150, 105, 0.1);
      color: var(--leaf, #059669);
      border: 1px solid rgba(5, 150, 105, 0.2);
      border-radius: 10px;
      padding: 0.6rem 0.8rem;
      font-size: 0.8rem;
      font-weight: 550;
      text-align: center;
    }

    .coupon-chip {
      background: var(--chip-bg, #f8fafc);
      border: 1px dashed var(--leaf, #059669);
      color: var(--leaf, #059669);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      cursor: pointer;
      margin-right: 0.35rem;
    }

    .trust-strip {
      border-top: 1px solid var(--line, #e2e8f0);
    }



    /* Modal Backdrop for Address Selection */
    .modal-backdrop-custom {
      position: fixed;
      inset: 0;
      background: rgba(11, 15, 21, 0.65);
      backdrop-filter: blur(4px);
      z-index: 1060;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-dialog-custom {
      background: var(--card, #ffffff);
      color: var(--ink, #1e293b);
      border: 1px solid var(--card-border, #e2e8f0);
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.4rem;
    }

    .saved-address-item {
      padding: 0.85rem;
      border: 1.5px solid var(--line, #e2e8f0);
      border-radius: 12px;
      margin-bottom: 0.65rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .saved-address-item:hover {
      border-color: var(--leaf, #059669);
    }
    .saved-address-item.selected {
      border-color: var(--leaf, #059669);
      background: rgba(5, 150, 105, 0.06);
    }

    .text-truncate-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
})
export class CheckoutPage {
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<string>('');
  readonly coupons = signal<Coupon[]>([]);
  readonly enteredCouponCode = signal<string>('');
  readonly applyingCoupon = signal<boolean>(false);

  readonly currentAddress = computed(() => {
    const list = this.addresses();
    const id = this.selectedAddressId();
    if (!list.length) return null;
    return list.find((a) => a.id === id) || list[0];
  });

  readonly method = this.shop.paymentMethod;
  readonly upiDetails = signal<UpiPaymentDetails | null>(null);

  readonly selectedInstructions = signal<string[]>([]);
  readonly customNote = signal<string>('');

  readonly instructionOptions: DeliveryInstructionOption[] = [
    { id: 'door', label: 'Leave at door', icon: 'bi-door-closed' },
    { id: 'bell', label: "Don't ring bell", icon: 'bi-bell-slash' },
    { id: 'call', label: 'Call before arrival', icon: 'bi-telephone-forward' },
    { id: 'guard', label: 'Leave with security', icon: 'bi-shield-check' },
  ];

  readonly showAddressModal = signal(false);
  readonly showAddressFormInline = signal(false);
  readonly placing = this.shop.placingOrder;
  readonly demo = signal<PaymentPayload | null>(null);

  readonly totalSavings = computed(() => {
    const cart = this.shop.cart();
    if (!cart) return 0;
    const discount = cart.discount || 0;
    const deliverySaved = cart.deliveryFee === 0 ? 30 : 0;
    return discount + deliverySaved;
  });

  constructor() {
    void this.boot();
    effect(() => {
      const trigger = this.shop.triggerPay$();
      if (trigger > 0) {
        void this.place();
      }
    });
  }

  asValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  toggleInstruction(id: string) {
    const current = this.selectedInstructions();
    if (current.includes(id)) {
      this.selectedInstructions.set(current.filter((item) => item !== id));
    } else {
      this.selectedInstructions.set([...current, id]);
    }
  }

  isBelowMinimumOrder(): boolean {
    const config = this.shop.storeConfig();
    const cart = this.shop.cart();
    if (!config || !cart) return false;
    return (cart.subtotal || 0) < (config.minOrderAmount || 0);
  }

  isCheckoutBlocked(): boolean {
    const config = this.shop.storeConfig();
    if (config && !config.isCurrentlyOpen) return true;
    if (this.isBelowMinimumOrder()) return true;
    return false;
  }

  async boot() {
    try {
      const [addresses, coupons] = await Promise.all([
        this.shop.loadAddresses(),
        this.shop.loadCart().then(() => this.shop.activeCoupons()),
        this.shop.loadStoreConfig(),
      ]);
      this.addresses.set(addresses);
      this.coupons.set(coupons);
      const preferred = addresses.find((item) => item.isDefault) ?? addresses[0];
      if (preferred) this.selectedAddressId.set(preferred.id);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  openAddressModal() {
    this.showAddressFormInline.set(false);
    this.showAddressModal.set(true);
  }

  closeAddressModal() {
    this.showAddressModal.set(false);
  }

  openNewAddressForm() {
    this.showAddressFormInline.set(true);
    this.showAddressModal.set(true);
  }

  selectAddress(id: string) {
    this.selectedAddressId.set(id);
    this.closeAddressModal();
    this.toasts.show('Delivery location updated');
  }

  onAddressAdded(saved: Address) {
    this.selectedAddressId.set(saved.id);
    this.showAddressFormInline.set(false);
    this.showAddressModal.set(false);
    void this.shop.loadAddresses().then((list) => this.addresses.set(list));
    this.toasts.show('New address saved and selected');
  }

  async useCoupon(coupon: Coupon) {
    try {
      this.applyingCoupon.set(true);
      await this.shop.applyCoupon(coupon.code);
      this.toasts.show(`Coupon ${coupon.code} applied!`);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.applyingCoupon.set(false);
    }
  }

  async applyEnteredCoupon() {
    const code = this.enteredCouponCode().trim().toUpperCase();
    if (!code) return;
    try {
      this.applyingCoupon.set(true);
      await this.shop.applyCoupon(code);
      this.toasts.show(`Coupon ${code} applied successfully!`);
      this.enteredCouponCode.set('');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.applyingCoupon.set(false);
    }
  }

  async place() {
    const addr = this.currentAddress();
    if (!addr) {
      this.toasts.error('Please add or select a delivery address');
      this.openAddressModal();
      return;
    }

    this.placing.set(true);
    this.demo.set(null);

    // Assemble combined delivery instruction notes
    const instructionLabels = this.instructionOptions
      .filter((opt) => this.selectedInstructions().includes(opt.id))
      .map((opt) => opt.label);
    const combinedNotes = [
      instructionLabels.length ? `[${instructionLabels.join(', ')}]` : '',
      this.customNote().trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    try {
      const order = await this.shop.placeOrder({
        addressId: addr.id,
        paymentMethod: this.method(),
        notes: combinedNotes,
      });

      await this.shop.loadCart();

      // Cash on Delivery
      if (this.method() === 'cod' || order.paymentStatus === 'paid') {
        this.toasts.show('Order confirmed! Arriving in 12 minutes.');
        await this.router.navigate(['/orders', order.id]);
        return;
      }

      // UPI
      if (this.method() === 'upi') {
        const upi = await this.shop.getUpiDetails(order.id);
        this.upiDetails.set(upi);
        return;
      }

      // Razorpay Cards / Netbanking
      const payment = await this.shop.createPayment(order.id);
      if (payment.mode === 'demo') {
        this.demo.set(payment);
        this.toasts.show('Demo mode active - simulating payment.');
        await this.simulate(payment);
        return;
      }
      if (payment.mode === 'free') {
        await this.router.navigate(['/orders', order.id]);
        return;
      }
      await this.openRazorpay(payment, order.id, order.orderNumber);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.placing.set(false);
    }
  }

  async onUpiSuccess(order: Order) {
    this.upiDetails.set(null);
    this.toasts.show('Payment confirmed! Preparing your delivery.');
    await this.router.navigate(['/orders', order.id]);
  }

  async onUpiCancelled() {
    this.upiDetails.set(null);
    await this.shop.loadCart();
  }

  async onUpiSwitchedToCod(order: Order) {
    this.upiDetails.set(null);
    this.toasts.show('Order switched to Cash on Delivery!');
    await this.router.navigate(['/orders', order.id]);
  }

  async simulate(payment: PaymentPayload) {
    try {
      const order = await this.shop.verifyPayment({
        orderId: payment.orderId,
        razorpayOrderId: payment.razorpayOrderId || '',
        razorpayPaymentId: `pay_demo_${payment.orderNumber}`,
        razorpaySignature: 'demo',
      });
      this.toasts.show('Payment confirmed!');
      await this.router.navigate(['/orders', order.id]);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async openRazorpay(payment: PaymentPayload, orderId: string, orderNumber: string) {
    await loadRazorpay();
    if (!window.Razorpay || !payment.keyId || !payment.razorpayOrderId) {
      this.toasts.error('Razorpay checkout could not load. Please choose UPI or Cash on Delivery.');
      return;
    }
    const checkout = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'ZapBasket',
      description: orderNumber,
      order_id: payment.razorpayOrderId,
      prefill: payment.customer,
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        void this.shop
          .verifyPayment({
            orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
          .then(() => this.router.navigate(['/orders', orderId]))
          .catch((error) => this.toasts.error(errorMessage(error)));
      },
    });
    checkout.open();
  }
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay'));
    document.body.appendChild(script);
  });
}
