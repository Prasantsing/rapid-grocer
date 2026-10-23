import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

@Component({
  selector: 'app-checkout-page',
  imports: [ReactiveFormsModule, RouterLink, InrPipe, UpiPaymentModalComponent, AddressFormComponent],
  template: `
    <div class="section-head"><h2>Checkout</h2><a routerLink="/cart">Edit basket</a></div>
    @if (!shop.cart()?.items?.length) {
      <div class="empty panel"><h2>Nothing to check out</h2><a routerLink="/">Browse the shelf</a></div>
    } @else {
      <div class="split">
        <div>
          <section class="panel mb-3">
            <h3>Deliver to</h3>
            @for (address of addresses(); track address.id) {
              <button class="choice mb-2" type="button" [class.on]="selected() === address.id" (click)="selected.set(address.id)">
                <strong>{{ address.label }} · {{ address.fullName }}</strong>
                <div class="muted">{{ address.line1 }}, {{ address.city }} {{ address.pincode }}</div>
              </button>
            }
            <button class="btn btn-outline-dark btn-sm mb-2" type="button" (click)="showForm.set(!showForm())">
              <i class="bi" [class.bi-x-lg]="showForm()" [class.bi-geo-alt-fill]="!showForm()"></i>
              <span class="ms-1">{{ showForm() ? 'Close form' : 'New address (GPS auto-detect)' }}</span>
            </button>
            @if (showForm()) {
              <div class="p-3 border rounded-3 bg-white mt-2 mb-3 shadow-sm">
                <app-address-form (saved)="onAddressAdded($event)" (cancelled)="showForm.set(false)" />
              </div>
            }
          </section>
          <section class="panel">
            <h3>Pay</h3>
            <button class="choice mb-2" type="button" [class.on]="method() === 'upi'" (click)="method.set('upi')">
              <div class="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
                <div class="text-start">
                  <div class="d-flex align-items-center gap-2">
                    <strong>UPI (Google Pay, PhonePe, Paytm, BHIM, QR)</strong>
                    <span class="badge bg-success" style="font-size: 0.68rem;">RECOMMENDED</span>
                  </div>
                  <div class="muted small mt-1">
                    Instant payment to <b>{{ shop.storeConfig()?.upiVpa || '9101516662@ybl' }}</b>
                    ({{ shop.storeConfig()?.payeeName || 'ZapBasket' }})
                  </div>
                </div>
                <div class="d-flex align-items-center gap-1">
                  <span class="badge bg-light text-dark border" style="font-size: 0.68rem; font-weight: 600;">GPay</span>
                  <span class="badge bg-light text-dark border" style="font-size: 0.68rem; font-weight: 600;">PhonePe</span>
                  <span class="badge bg-light text-dark border" style="font-size: 0.68rem; font-weight: 600;">Paytm</span>
                  <span class="badge bg-light text-dark border" style="font-size: 0.68rem; font-weight: 600;">BHIM</span>
                </div>
              </div>
            </button>
            <button class="choice mb-2" type="button" [class.on]="method() === 'cod'" (click)="method.set('cod')">
              <div class="text-start">
                <strong>Cash on delivery</strong>
                <div class="muted small">Pay with cash or scan delivery partner's QR at your door</div>
              </div>
            </button>
            <button class="choice" type="button" [class.on]="method() === 'razorpay'" (click)="method.set('razorpay')">
              <div class="text-start">
                <strong>Cards / Netbanking via Razorpay</strong>
                <div class="muted small">Debit cards, credit cards, and online banking</div>
              </div>
            </button>
            <label class="form-label mt-3">Note for the rider</label>
            <input class="form-control" [value]="notes()" (input)="notes.set(asValue($event))" placeholder="Gate code, landmark, or delivery note…" />
          </section>
        </div>
        <aside class="panel">
          <p class="summary-row"><span>Items</span><span>{{ shop.cart()!.subtotal | inr }}</span></p>
          <p class="summary-row"><span>Discount</span><span>− {{ shop.cart()!.discount | inr }}</span></p>
          <p class="summary-row"><span>Delivery</span><span>{{ shop.cart()!.deliveryFee === 0 ? 'Free' : (shop.cart()!.deliveryFee | inr) }}</span></p>
          <p class="summary-row total-row"><span>To pay</span><span>{{ shop.cart()!.total | inr }}</span></p>
          @if (coupons().length) {
            <p class="eyebrow mt-3">Coupons on the counter</p>
            @for (coupon of coupons(); track coupon.code) {
              <button class="choice mb-2" type="button" (click)="useCoupon(coupon)">{{ coupon.code }} · {{ coupon.description }}</button>
            }
          }

          <!-- Store Closed / Minimum Order Warnings -->
          @if (shop.storeConfig() && !shop.storeConfig()?.isCurrentlyOpen) {
            <div class="alert alert-warning py-2 px-3 small mt-2 mb-2 text-start">
              <i class="bi bi-clock-history me-1"></i>
              <b>Store Closed:</b> {{ shop.storeConfig()?.closedReason || 'We are currently outside operational hours.' }}
            </div>
          }
          @if (isBelowMinimumOrder()) {
            <div class="alert alert-info py-2 px-3 small mt-2 mb-2 text-start">
              <i class="bi bi-info-circle me-1"></i>
              Minimum order is <b>{{ shop.storeConfig()!.minOrderAmount | inr }}</b>. Add more items to proceed.
            </div>
          }

          <button
            class="btn btn-dark w-100 mt-2 py-2"
            type="button"
            [disabled]="placing() || !selected() || isCheckoutBlocked()"
            (click)="place()"
          >
            @if (placing()) {
              <span>Placing order…</span>
            } @else if (isCheckoutBlocked()) {
              <span>Checkout Unavailable</span>
            } @else if (method() === 'upi') {
              <span>Pay {{ shop.cart()!.total | inr }} with UPI</span>
            } @else if (method() === 'cod') {
              <span>Place order (Cash on delivery)</span>
            } @else {
              <span>Place order ({{ shop.cart()!.total | inr }})</span>
            }
          </button>
          @if (demo(); as payment) {
            <div class="choice on mt-3">
              <strong>Demo payment</strong>
              <p class="muted">Razorpay keys are not configured, so this charge stays inside the store.</p>
              <button class="btn btn-warning" type="button" (click)="simulate(payment)">Simulate successful payment</button>
            </div>
          }
        </aside>
      </div>
    }

    @if (upiDetails(); as upi) {
      <app-upi-payment-modal
        [details]="upi"
        (paymentSuccess)="onUpiSuccess($event)"
        (paymentCancelled)="onUpiCancelled()"
        (switchedToCod)="onUpiSwitchedToCod($event)"
        (payLater)="onUpiPayLater($event)"
      />
    }
  `,
})
export class CheckoutPage {
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly addresses = signal<Address[]>([]);
  readonly coupons = signal<Coupon[]>([]);
  readonly selected = signal('');
  readonly method = signal<'cod' | 'razorpay' | 'upi'>('upi');
  readonly upiDetails = signal<UpiPaymentDetails | null>(null);
  readonly notes = signal('');
  readonly showForm = signal(false);
  readonly placing = signal(false);
  readonly demo = signal<PaymentPayload | null>(null);

  constructor() {
    void this.boot();
  }

  asValue(event: Event) {
    return (event.target as HTMLInputElement).value;
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
      if (preferred) this.selected.set(preferred.id);
      if (!addresses.length) this.showForm.set(true);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  onAddressAdded(saved: Address) {
    this.selected.set(saved.id);
    this.showForm.set(false);
    void this.shop.loadAddresses().then((list) => this.addresses.set(list));
  }

  async useCoupon(coupon: Coupon) {
    try {
      await this.shop.applyCoupon(coupon.code);
      this.toasts.show(`${coupon.code} applied`);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async place() {
    const addressId = this.selected();
    if (!addressId) return;
    this.placing.set(true);
    this.demo.set(null);
    try {
      const order = await this.shop.placeOrder({
        addressId,
        paymentMethod: this.method(),
        notes: this.notes(),
      });
      await this.shop.loadCart();
      if (this.method() === 'cod' || order.paymentStatus === 'paid') {
        this.toasts.show('Order placed');
        await this.router.navigate(['/orders', order.id]);
        return;
      }
      if (this.method() === 'upi') {
        const upi = await this.shop.getUpiDetails(order.id);
        this.upiDetails.set(upi);
        return;
      }
      const payment = await this.shop.createPayment(order.id);
      if (payment.mode === 'demo') {
        this.demo.set(payment);
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
    this.toasts.show('Payment confirmed! Your order is being packed.');
    await this.router.navigate(['/orders', order.id]);
  }

  async onUpiCancelled() {
    this.upiDetails.set(null);
    await this.shop.loadCart();
  }

  async onUpiSwitchedToCod(order: Order) {
    this.upiDetails.set(null);
    await this.router.navigate(['/orders', order.id]);
  }

  async onUpiPayLater(order: Order) {
    this.upiDetails.set(null);
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
      this.toasts.show('Payment received');
      await this.router.navigate(['/orders', order.id]);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async openRazorpay(payment: PaymentPayload, orderId: string, orderNumber: string) {
    await loadRazorpay();
    if (!window.Razorpay || !payment.keyId || !payment.razorpayOrderId) {
      this.toasts.error('Razorpay checkout did not load.');
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
        void this.shop.verifyPayment({
          orderId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }).then(() => this.router.navigate(['/orders', orderId]))
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
