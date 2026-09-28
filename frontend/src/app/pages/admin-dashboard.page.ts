import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardData } from '../core/models';
import { AdminService } from '../core/admin.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

@Component({
  selector: 'app-admin-dashboard',
  imports: [InrPipe, DatePipe, RouterLink],
  template: `
    <div class="section-head"><div><p class="eyebrow">Today</p><h2>Store pulse</h2></div></div>
    @if (error()) { <div class="panel">{{ error() }}</div> }
    @if (data(); as dash) {
      <div class="stat-grid mb-3">
        <article class="stat"><span>Revenue</span><strong>{{ dash.revenue | inr }}</strong></article>
        <article class="stat"><span>Orders</span><strong>{{ dash.orders }}</strong></article>
        <article class="stat"><span>Today</span><strong>{{ dash.todayOrders }}</strong><span>{{ dash.todayRevenue | inr }}</span></article>
        <article class="stat"><span>Avg basket</span><strong>{{ dash.averageOrderValue | inr }}</strong></article>
      </div>
      <div class="split">
        <section class="panel">
          <h3>Recent orders</h3>
          @for (order of dash.recentOrders; track order.id) {
            <a class="line-item text-reset" [routerLink]="['/admin/orders']">
              <span>{{ order.orderNumber }}<br><small class="muted">{{ order.customer }} · {{ order.createdAt | date:'d MMM, h:mm a' }}</small></span>
              <span [class]="'status-pill ' + order.status">{{ label(order.status) }}</span>
            </a>
          }
        </section>
        <section class="panel">
          <h3>Running low</h3>
          @for (item of dash.lowStock; track item.id) {
            <p class="summary-row"><span>{{ item.emoji }} {{ item.name }}</span><strong>{{ item.stock }} {{ item.unit }}</strong></p>
          }
          <h3 class="mt-4">Status mix</h3>
          @for (row of dash.ordersByStatus; track row.status) {
            <p class="summary-row"><span>{{ label(row.status) }}</span><span>{{ row.count }}</span></p>
          }
        </section>
      </div>
    }
  `,
})
export class AdminDashboardPage {
  private readonly admin = inject(AdminService);
  readonly data = signal<DashboardData | null>(null);
  readonly error = signal('');

  constructor() {
    this.admin.dashboard().then((data) => this.data.set(data)).catch((error) => this.error.set(errorMessage(error)));
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }
}
