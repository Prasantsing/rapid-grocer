import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
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
    <div class="section-head mb-3">
      <div>
        <h2>Your runs</h2>
        <p class="muted mb-0">Deliver groceries within 10-15 minutes</p>
      </div>
      <div class="d-flex gap-2">
        <div class="px-3 py-1 bg-warning-subtle text-warning-emphasis rounded-3 border border-warning-subtle text-center">
          <small class="d-block" style="font-size: 0.68rem;">RIDER RATING</small>
          <strong class="fs-6">⭐ {{ avgRiderRating() }}/5</strong>
        </div>
        <div class="px-3 py-1 bg-success-subtle text-success rounded-3 border border-success-subtle text-center">
          <small class="d-block" style="font-size: 0.68rem;">TIPS EARNED</small>
          <strong class="fs-6">{{ totalTips() | inr }}</strong>
        </div>
      </div>
    </div>
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

            @if (order.feedback?.riderRating) {
              <div class="mt-2 py-1 px-2 rounded bg-warning-subtle text-warning-emphasis small d-flex align-items-center justify-content-between">
                <span><i class="bi bi-star-fill text-warning me-1"></i> Customer Rating: <b>{{ order.feedback?.riderRating }}/5</b></span>
                @if (order.feedback?.deliveryTags?.length) {
                  <span class="text-secondary font-monospace" style="font-size: 0.72rem;">{{ order.feedback?.deliveryTags?.join(', ') }}</span>
                }
              </div>
            }

            @if (order.tip && order.tip.amount > 0) {
              <div class="mt-1 py-1 px-2 rounded bg-success-subtle text-success small d-flex align-items-center justify-content-between">
                <span><i class="bi bi-cash-coin me-1"></i> Customer Tip: <b>{{ order.tip.amount | inr }}</b></span>
                <span class="badge bg-success text-white">Direct Tip</span>
              </div>
            }

            <div class="d-flex gap-2 flex-wrap mt-3">
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

  readonly totalTips = computed(() =>
    this.orders().reduce((sum, o) => sum + (o.tip?.amount || 0), 0)
  );

  readonly avgRiderRating = computed(() => {
    const rated = this.orders().filter((o) => o.feedback?.riderRating);
    if (!rated.length) return '5.0';
    const sum = rated.reduce((s, o) => s + (o.feedback?.riderRating || 0), 0);
    return (sum / rated.length).toFixed(1);
  });

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
