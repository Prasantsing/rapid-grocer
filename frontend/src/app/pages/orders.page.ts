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
  templateUrl: './orders.page.html',
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
