import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Order } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

@Component({
  selector: 'app-delivery-page',
  imports: [DatePipe, InrPipe],
  template: `
    <div class="section-head"><h2>Your runs</h2></div>
    <div class="d-flex gap-2 mb-3">
      @for (tab of tabs; track tab.id) {
        <button class="btn" type="button" [class.btn-dark]="scope() === tab.id" [class.btn-outline-dark]="scope() !== tab.id" (click)="setScope(tab.id)">{{ tab.label }}</button>
      }
    </div>
    @if (loading()) { <p class="muted">Checking the board…</p> }
    @else if (!orders().length) {
      <div class="empty panel"><h2>Nothing in this pile</h2><p>New confirmed orders show up under Open.</p></div>
    } @else {
      <div class="job">
        @for (order of orders(); track order.id) {
          <article class="panel">
            <div class="d-flex justify-content-between">
              <strong>{{ order.orderNumber }}</strong>
              <span [class]="'status-pill ' + order.status">{{ label(order.status) }}</span>
            </div>
            <p class="mb-1 mt-2">{{ order.address.fullName }} · {{ order.address.phone }}</p>
            <p class="muted">{{ order.address.line1 }}@if (order.address.landmark) {, {{ order.address.landmark }}}<br>{{ order.address.city }} {{ order.address.pincode }}</p>
            <p>{{ order.items.length }} items · {{ order.total | inr }} · {{ order.createdAt | date:'h:mm a' }}</p>
            <div class="d-flex gap-2 flex-wrap">
              @if (scope() === 'available') {
                <button class="btn btn-dark" type="button" (click)="accept(order)">Accept run</button>
              }
              @if (order.status === 'packed') {
                <button class="btn btn-warning" type="button" (click)="move(order, 'out_for_delivery')">I'm on the way</button>
              }
              @if (order.status === 'out_for_delivery') {
                <button class="btn btn-dark" type="button" (click)="move(order, 'delivered')">Mark delivered</button>
              }
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class DeliveryPage {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly orders = signal<Order[]>([]);
  readonly scope = signal<'available' | 'active' | 'history'>('active');
  readonly loading = signal(true);
  readonly tabs = [
    { id: 'active' as const, label: 'Active' },
    { id: 'available' as const, label: 'Open' },
    { id: 'history' as const, label: 'History' },
  ];

  constructor() { void this.load(); }

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
