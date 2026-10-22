import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../core/models';
import { ShopService } from '../core/shop.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';
import { OrderProgressBarComponent } from '../shared/order-progress-bar.component';

@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, InrPipe, DatePipe, OrderProgressBarComponent],
  template: `
    <div class="section-head"><h2>Orders</h2></div>
    @if (loading()) {
      <p class="muted">Looking up your runs…</p>
    } @else if (error()) {
      <div class="empty panel"><p>{{ error() }}</p></div>
    } @else if (orders().length === 0) {
      <div class="empty panel"><h2>No orders yet</h2><a routerLink="/">Fill a basket</a></div>
    } @else {
      <div class="d-grid gap-3">
        @for (order of orders(); track order.id) {
          <a class="panel order-card text-reset text-decoration-none" [routerLink]="['/orders', order.id]">
            <div class="d-flex justify-content-between gap-3 mb-2">
              <div>
                <strong>{{ order.orderNumber }}</strong>
                <p class="muted mb-0">{{ order.createdAt | date:'d MMM, h:mm a' }} · {{ order.items.length }} items</p>
              </div>
              <div class="text-end">
                <span [class]="'status-pill ' + order.status">{{ label(order.status) }}</span>
                <div class="mt-1 fw-bold">{{ order.total | inr }}</div>
              </div>
            </div>
            <!-- Compact progress bar for fast visual tracking -->
            <app-order-progress-bar [order]="order" [status]="order.status" [compact]="true" />
          </a>
        }
      </div>
    }
  `,
})
export class OrdersPage {
  private readonly shop = inject(ShopService);
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.shop.orders().then((page) => this.orders.set(page.items))
      .catch((error) => this.error.set(errorMessage(error)))
      .finally(() => this.loading.set(false));
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }
}
