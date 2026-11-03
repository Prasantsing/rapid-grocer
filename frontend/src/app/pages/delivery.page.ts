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
  templateUrl: './delivery.page.html',
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
