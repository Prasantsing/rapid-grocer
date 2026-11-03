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
  templateUrl: './upi-payment-modal.component.html',
  styleUrl: './upi-payment-modal.component.scss',
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
