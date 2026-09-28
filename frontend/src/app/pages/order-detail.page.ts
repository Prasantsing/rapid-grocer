import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order } from '../core/models';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { ORDER_STEPS, STATUS_LABEL } from '../shared/status';

@Component({
  selector: 'app-order-detail-page',
  imports: [DatePipe, RouterLink, InrPipe],
  template: `
    <a class="muted" routerLink="/orders">All orders</a>
    @if (loading()) {
      <p class="mt-3">Tracking the bag…</p>
    } @else if (order(); as current) {
      <div class="section-head">
        <div>
          <h2>{{ current.orderNumber }}</h2>
          <p class="muted mb-0">{{ current.createdAt | date:'d MMM, h:mm a' }}</p>
        </div>
        <span [class]="'status-pill ' + current.status">{{ label(current.status) }}</span>
      </div>
      <div class="split">
        <div class="panel">
          @if (current.status !== 'cancelled') {
            <p class="eyebrow">Arriving around {{ eta(current) }}</p>
            <ol class="timeline">
              @for (step of steps; track step; let last = $last) {
                <li [class.done]="reached(current, step)">
                  <div>
                    <div class="dot"></div>
                    @if (!last) { <div class="track"></div> }
                  </div>
                  <div class="pb-3">
                    <strong>{{ label(step) }}</strong>
                    <div class="muted">{{ noteFor(current, step) }}</div>
                  </div>
                </li>
              }
            </ol>
          } @else {
            <p>This order was cancelled. Stock is back on the shelf.</p>
          }
          @for (item of current.items; track item.productId) {
            <div class="line-item">
              <div class="d-flex gap-3 align-items-center">
                <div class="line-art" [style.background]="item.tint">{{ item.emoji }}</div>
                <div>{{ item.name }}<div class="muted">{{ item.quantity }} × {{ item.unit }}</div></div>
              </div>
              <strong>{{ item.lineTotal | inr }}</strong>
            </div>
          }
        </div>
        <aside class="panel">
          <h3>Drop</h3>
          <p class="mb-1"><strong>{{ current.address.fullName }}</strong></p>
          <p class="muted">{{ current.address.line1 }}<br>{{ current.address.city }} {{ current.address.pincode }}<br>{{ current.address.phone }}</p>
          @if (partnerName(current)) { <p>Rider: {{ partnerName(current) }}</p> }
          <p class="summary-row"><span>Payment</span><span [class]="'status-pill ' + current.paymentStatus">{{ label(current.paymentStatus) }}</span></p>
          <p class="summary-row"><span>Items</span><span>{{ current.subtotal | inr }}</span></p>
          <p class="summary-row"><span>Discount</span><span>− {{ current.discount | inr }}</span></p>
          <p class="summary-row total-row"><span>Total</span><span>{{ current.total | inr }}</span></p>
          @if (canCancel(current)) {
            <button class="btn btn-outline-danger w-100" type="button" (click)="cancel(current)">Cancel order</button>
          }
        </aside>
      </div>
    }
  `,
})
export class OrderDetailPage {
  private readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly steps = ORDER_STEPS;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || '';
      this.loading.set(true);
      this.shop.order(id).then((order) => this.order.set(order))
        .catch((error) => this.toasts.error(errorMessage(error)))
        .finally(() => this.loading.set(false));
    });
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }

  reached(order: Order, step: string) {
    return ORDER_STEPS.indexOf(order.status) >= ORDER_STEPS.indexOf(step);
  }

  noteFor(order: Order, step: string) {
    return order.timeline.find((entry) => entry.status === step)?.note || '';
  }

  eta(order: Order) {
    return new Date(new Date(order.createdAt).getTime() + 12 * 60 * 1000)
      .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }

  partnerName(order: Order) {
    return order.deliveryPartner && typeof order.deliveryPartner === 'object' ? order.deliveryPartner.name : '';
  }

  canCancel(order: Order) {
    return this.auth.user()?.role === 'customer' && (order.status === 'placed' || order.status === 'confirmed');
  }

  async cancel(order: Order) {
    try {
      this.order.set(await this.shop.cancelOrder(order.id));
      this.toasts.show('Order cancelled');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }
}
