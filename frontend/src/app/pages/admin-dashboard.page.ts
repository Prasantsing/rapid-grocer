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
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
})
export class AdminDashboardPage {
  private readonly admin = inject(AdminService);
  readonly shop = inject(ShopService);
  readonly data = signal<DashboardData | null>(null);
  readonly feedback = signal<FeedbackSummaryResponse | null>(null);
  readonly error = signal('');

  constructor() {
    this.admin.dashboard().then((data) => this.data.set(data)).catch((error) => this.error.set(errorMessage(error)));
    this.shop.getFeedbackSummary().then((fb) => this.feedback.set(fb)).catch(() => {});
    void this.shop.loadStoreConfig();
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }
}

