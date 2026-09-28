import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Address, Coupon, PaymentPayload } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

@Component({
  selector: 'app-checkout-page',
  imports: [ReactiveFormsModule, RouterLink, InrPipe],
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
            <button class="btn btn-outline-dark btn-sm" type="button" (click)="showForm.set(!showForm())">{{ showForm() ? 'Close form' : 'New address' }}</button>
            @if (showForm()) {
              <form class="row g-2 mt-2" [formGroup]="form" (ngSubmit)="saveAddress()">
                <div class="col-md-4">
                  <select class="form-select" formControlName="label">
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="col-md-8"><input class="form-control" placeholder="Full name" formControlName="fullName" /></div>
                <div class="col-md-6"><input class="form-control" placeholder="Mobile" formControlName="phone" /></div>
                <div class="col-12"><input class="form-control" placeholder="Address line" formControlName="line1" /></div>
                <div class="col-md-6"><input class="form-control" placeholder="City" formControlName="city" /></div>
                <div class="col-md-3"><input class="form-control" placeholder="State" formControlName="state" /></div>
                <div class="col-md-3"><input class="form-control" placeholder="Pincode" formControlName="pincode" /></div>
                <div class="col-12"><button class="btn btn-dark" type="submit" [disabled]="form.invalid || saving()">Save address</button></div>
              </form>
            }
          </section>
          <section class="panel">
            <h3>Pay</h3>
            <button class="choice mb-2" type="button" [class.on]="method() === 'cod'" (click)="method.set('cod')">Cash on delivery</button>
            <button class="choice" type="button" [class.on]="method() === 'razorpay'" (click)="method.set('razorpay')">UPI / card via Razorpay</button>
            <label class="form-label mt-3">Note for the rider</label>
            <input class="form-control" [value]="notes()" (input)="notes.set(asValue($event))" />
          </section>
        </div>
        <aside class="panel">
          <p class="summary-row"><span>Items</span><span>{{ shop.cart()!.subtotal | inr }}</span></p>
          <p class="summary-row"><span>Discount</span><span>− {{ shop.cart()!.discount | inr }}</span></p>
          <p class="summary-row"><span>Delivery</span><span>{{ shop.cart()!.deliveryFee | inr }}</span></p>
          <p class="summary-row total-row"><span>To pay</span><span>{{ shop.cart()!.total | inr }}</span></p>
          @if (coupons().length) {
            <p class="eyebrow mt-3">Coupons on the counter</p>
            @for (coupon of coupons(); track coupon.code) {
              <button class="choice mb-2" type="button" (click)="useCoupon(coupon)">{{ coupon.code }} · {{ coupon.description }}</button>
            }
          }
          <button class="btn btn-dark w-100 mt-2" type="button" [disabled]="placing() || !selected()" (click)="place()">
            {{ placing() ? 'Placing…' : 'Place order' }}
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
  readonly method = signal<'cod' | 'razorpay'>('cod');
  readonly notes = signal('');
  readonly showForm = signal(false);
  readonly placing = signal(false);
  readonly saving = signal(false);
  readonly demo = signal<PaymentPayload | null>(null);
  readonly form = this.fb.nonNullable.group({
    label: 'Home' as 'Home' | 'Work' | 'Other',
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    line1: ['', Validators.required],
    city: ['Bengaluru', Validators.required],
    state: ['Karnataka', Validators.required],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    void this.boot();
  }

  asValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  async boot() {
    try {
      const [addresses, coupons] = await Promise.all([
        this.shop.loadAddresses(),
        this.shop.loadCart().then(() => this.shop.activeCoupons()),
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

  async saveAddress() {
    this.saving.set(true);
    try {
      const saved = await this.shop.saveAddress(this.form.getRawValue());
      this.addresses.set(saved);
      const newest = saved[0];
      if (newest) this.selected.set(newest.id);
      this.showForm.set(false);
      this.toasts.show('Address saved');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
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
