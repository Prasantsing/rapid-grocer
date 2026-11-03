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
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.scss',
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
