import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Order, OrderStatus, User } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

@Component({
  selector: 'app-admin-orders',
  imports: [DatePipe, InrPipe, FormsModule],
  template: `
    <div class="section-head"><h2>Orders</h2></div>
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <select class="form-select w-auto" [(ngModel)]="status" (change)="load()">
        <option value="">All statuses</option>
        @for (item of statuses; track item) { <option [value]="item">{{ label(item) }}</option> }
      </select>
      <input class="form-control" style="max-width: 220px" placeholder="Order number" [(ngModel)]="search" (keyup.enter)="load()" />
    </div>
    <div class="d-grid gap-3">
      @for (order of orders(); track order.id) {
        <article class="panel">
          <div class="d-flex justify-content-between gap-2 flex-wrap">
            <div>
              <strong>{{ order.orderNumber }}</strong>
              <div class="muted">{{ customer(order) }} · {{ order.createdAt | date:'d MMM, h:mm a' }} · {{ order.total | inr }}</div>
            </div>
            <span [class]="'status-pill ' + order.status">{{ label(order.status) }}</span>
          </div>
          <p class="mt-2 mb-2">{{ order.address.line1 }}, {{ order.address.city }}</p>
          <div class="d-flex gap-2 flex-wrap">
            @if (order.status === 'placed') { <button class="btn btn-sm btn-dark" type="button" (click)="move(order, 'confirmed')">Confirm</button> }
            @if (order.status === 'confirmed') { <button class="btn btn-sm btn-dark" type="button" (click)="move(order, 'packed')">Mark packed</button> }
            @if (order.status === 'placed' || order.status === 'confirmed' || order.status === 'packed') {
              <button class="btn btn-sm btn-outline-danger" type="button" (click)="move(order, 'cancelled')">Cancel</button>
            }
            <select class="form-select form-select-sm w-auto" (change)="assign(order, $event)">
              <option value="">Assign rider</option>
              @for (partner of partners(); track partner.id) {
                <option [value]="partner.id">{{ partner.name }}</option>
              }
            </select>
          </div>
        </article>
      }
    </div>
  `,
})
export class AdminOrdersPage {
  private readonly admin = inject(AdminService);
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly orders = signal<Order[]>([]);
  readonly partners = signal<User[]>([]);
  status = '';
  search = '';
  readonly statuses: OrderStatus[] = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

  constructor() {
    void this.load();
    void this.admin.users({ role: 'delivery' }).then((page) => this.partners.set(page.items));
  }

  label(status: string) { return STATUS_LABEL[status] || status; }

  customer(order: Order) {
    return order.user && typeof order.user === 'object' ? order.user.name : 'Customer';
  }

  async load() {
    try {
      const page = await this.admin.orders({ status: this.status, search: this.search });
      this.orders.set(page.items);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async move(order: Order, status: string) {
    try {
      if (status === 'cancelled') await this.shop.cancelOrder(order.id);
      else await this.shop.updateOrderStatus(order.id, status);
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async assign(order: Order, event: Event) {
    const deliveryPartnerId = (event.target as HTMLSelectElement).value;
    if (!deliveryPartnerId) return;
    try {
      await this.admin.assign(order.id, deliveryPartnerId);
      this.toasts.show('Rider assigned');
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }
}
