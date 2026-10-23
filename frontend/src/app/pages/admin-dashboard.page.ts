import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardData, FeedbackSummaryResponse } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ShopService } from '../core/shop.service';
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

      <!-- CUSTOMER SATISFACTION & RIDER TIPS STRIP -->
      @if (feedback(); as fb) {
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-4">
            <div class="panel h-100 p-3">
              <span class="text-muted small text-uppercase fw-semibold d-block">Store Quality Rating</span>
              <div class="d-flex align-items-baseline gap-2 mt-1">
                <span class="fs-3 fw-bold text-warning">⭐ {{ fb.summary.avgStoreRating }}</span>
                <span class="text-muted small">/ 5.0 ({{ fb.summary.totalRatings }} reviews)</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="panel h-100 p-3">
              <span class="text-muted small text-uppercase fw-semibold d-block">Rider Delivery Rating</span>
              <div class="d-flex align-items-baseline gap-2 mt-1">
                <span class="fs-3 fw-bold text-warning">⭐ {{ fb.summary.avgRiderRating }}</span>
                <span class="text-muted small">/ 5.0 on-time benchmark</span>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="panel h-100 p-3">
              <span class="text-muted small text-uppercase fw-semibold d-block">Rider Tips Disbursed</span>
              <div class="d-flex align-items-baseline gap-2 mt-1">
                <span class="fs-3 fw-bold text-success">{{ fb.summary.totalTipsCollected | inr }}</span>
                <span class="text-muted small">across {{ fb.summary.tipsCount }} tips</span>
              </div>
            </div>
          </div>
        </div>
      }

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
            <p class="summary-row"><span>{{ item.emoji }} {{ item.name }}</span><strong>{{ item.stock }} left</strong></p>
          }
          <h3 class="mt-4">Status mix</h3>
          @for (row of dash.ordersByStatus; track row.status) {
            <p class="summary-row"><span>{{ label(row.status) }}</span><span>{{ row.count }}</span></p>
          }
        </section>
      </div>

      <!-- RECENT CUSTOMER FEEDBACK & REVIEWS STREAM -->
      @if (feedback()?.recentFeedback?.length) {
        <section class="panel mt-3">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h3 class="mb-0">Recent Customer Reviews</h3>
            <span class="badge bg-light text-secondary border">Live Feedback</span>
          </div>
          <div class="row g-3">
            @for (rev of feedback()!.recentFeedback; track rev.orderId) {
              <div class="col-12 col-md-6">
                <div class="p-3 bg-light rounded-3 border h-100">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <strong>{{ rev.orderNumber }}</strong>
                      <span class="text-muted small ms-2">· {{ rev.customerName }}</span>
                    </div>
                    <span class="text-warning small fw-bold">⭐ {{ rev.storeRating }}/5 Store</span>
                  </div>
                  @if (rev.riderRating) {
                    <div class="small text-muted mb-1">
                      Rider: <b>{{ rev.riderName }}</b> · ⭐ {{ rev.riderRating }}/5
                      @if (rev.tipAmount > 0) {
                        <span class="badge bg-success-subtle text-success ms-1">+₹{{ rev.tipAmount }} tip</span>
                      }
                    </div>
                  }
                  @if (rev.deliveryTags.length) {
                    <div class="d-flex flex-wrap gap-1 mb-2">
                      @for (t of rev.deliveryTags; track t) {
                        <span class="badge bg-white text-dark border" style="font-size: 0.7rem;">{{ t }}</span>
                      }
                    </div>
                  }
                  @if (rev.comments) {
                    <div class="small text-secondary fst-italic">"{{ rev.comments }}"</div>
                  }
                  <div class="text-end text-muted mt-2" style="font-size: 0.68rem;">
                    {{ rev.submittedAt | date:'mediumDate' }}
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      }
    }
  `,
})
export class AdminDashboardPage {
  private readonly admin = inject(AdminService);
  private readonly shop = inject(ShopService);
  readonly data = signal<DashboardData | null>(null);
  readonly feedback = signal<FeedbackSummaryResponse | null>(null);
  readonly error = signal('');

  constructor() {
    this.admin.dashboard().then((data) => this.data.set(data)).catch((error) => this.error.set(errorMessage(error)));
    this.shop.getFeedbackSummary().then((fb) => this.feedback.set(fb)).catch(() => {});
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }
}

