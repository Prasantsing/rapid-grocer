import { Component, inject, signal } from '@angular/core';
import { ReportData } from '../core/models';
import { AdminService } from '../core/admin.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

@Component({
  selector: 'app-admin-reports',
  imports: [InrPipe],
  template: `
    <div class="section-head"><h2>Reports</h2></div>
    <form class="d-flex gap-2 mb-3 flex-wrap" (submit)="run($event)">
      <input class="form-control w-auto" type="date" name="from" />
      <input class="form-control w-auto" type="date" name="to" />
      <button class="btn btn-dark" type="submit">Update</button>
    </form>
    @if (error()) { <p class="text-danger">{{ error() }}</p> }
    @if (report(); as data) {
      <div class="stat-grid mb-3">
        <article class="stat"><span>Revenue</span><strong>{{ data.revenue | inr }}</strong></article>
        <article class="stat"><span>Orders</span><strong>{{ data.orders }}</strong></article>
        <article class="stat"><span>Avg basket</span><strong>{{ data.averageOrderValue | inr }}</strong></article>
        <article class="stat"><span>New customers</span><strong>{{ data.newCustomers }}</strong></article>
      </div>
      <div class="split">
        <section class="panel">
          <h3>Revenue by day</h3>
          @for (day of data.ordersByDay; track day.date) {
            <div class="bar-row">
              <span>{{ day.date.slice(5) }}</span>
              <div class="bar"><span [style.width.%]="width(day.revenue)"></span></div>
              <strong>{{ day.revenue | inr }}</strong>
            </div>
          }
        </section>
        <section class="panel">
          <h3>Top products</h3>
          @for (item of data.topProducts; track item.name) {
            <p class="summary-row"><span>{{ item.name }}</span><span>{{ item.quantity }} · {{ item.revenue | inr }}</span></p>
          }
          <h3 class="mt-4">By status</h3>
          @for (row of data.ordersByStatus; track row.status) {
            <p class="summary-row"><span>{{ label(row.status) }}</span><span>{{ row.count }}</span></p>
          }
        </section>
      </div>
    }
  `,
})
export class AdminReportsPage {
  private readonly admin = inject(AdminService);
  readonly report = signal<ReportData | null>(null);
  readonly error = signal('');

  constructor() { void this.load(); }

  async run(event: Event) {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    await this.load(String(form.get('from') || ''), String(form.get('to') || ''));
  }

  width(value: number) {
    const max = Math.max(...(this.report()?.ordersByDay.map((day) => day.revenue) ?? [1]), 1);
    return Math.max(4, (value / max) * 100);
  }

  label(status: string) { return STATUS_LABEL[status] || status; }

  private async load(from = '', to = '') {
    try {
      this.report.set(await this.admin.report(from || undefined, to || undefined));
      this.error.set('');
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
