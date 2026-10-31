import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReportData } from '../core/models';
import { AdminService } from '../core/admin.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

export interface CalendarDayCell {
  dayNumber: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  revenue: number;
  orders: number;
  hasSales: boolean;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, InrPipe],
  template: `
    <div class="section-head d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <h2>Sales & Order Intelligence</h2>
        <p class="text-muted mb-0 small">Monthly breakdown, date performance metrics, and product sales insights</p>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" (click)="refresh()" [disabled]="loading()">
          <span class="bi bi-arrow-clockwise"></span>
          {{ loading() ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    @if (error()) {
      <div class="alert alert-danger d-flex align-items-center gap-2" role="alert">
        <span class="bi bi-exclamation-triangle-fill"></span>
        <div>{{ error() }}</div>
      </div>
    }

    <!-- High-Level KPI Strip -->
    @if (report(); as data) {
      <div class="stat-grid mb-4">
        <article class="stat rounded-3">
          <span>Total Revenue</span>
          <strong class="text-success">{{ data.revenue | inr }}</strong>
          <small class="text-muted">{{ activePresetLabel() }}</small>
        </article>
        <article class="stat rounded-3">
          <span>Total Orders</span>
          <strong>{{ data.orders }}</strong>
          <small class="text-muted">Avg: {{ dailyAvgOrders() }} orders / day</small>
        </article>
        <article class="stat rounded-3">
          <span>Average Basket</span>
          <strong>{{ data.averageOrderValue | inr }}</strong>
          <small class="text-muted">{{ data.newCustomers }} new customers</small>
        </article>
        <article class="stat rounded-3">
          <span>Peak Sales Day</span>
          <strong class="text-primary" style="font-size: 1.25rem;">{{ peakDayInfo().label }}</strong>
          <small class="text-muted">{{ peakDayInfo().revenue ? (peakDayInfo().revenue | inr) : 'No orders yet' }}</small>
        </article>
      </div>

      <!-- Monthly Sales Calendar View -->
      <div class="calendar-card mb-4">
        <div class="calendar-header">
          <div class="calendar-title-group">
            <button class="calendar-nav-btn" (click)="prevMonth()" title="Previous Month" aria-label="Previous Month">
              ‹
            </button>
            <h3>
              <span class="bi bi-calendar3 text-success"></span>
              {{ monthTitle() }}
            </h3>
            <button class="calendar-nav-btn" (click)="nextMonth()" title="Next Month" aria-label="Next Month">
              ›
            </button>
            <button class="calendar-today-btn" (click)="jumpToToday()">
              Today
            </button>
          </div>

          <div class="calendar-presets">
            <button 
              type="button" 
              class="calendar-preset-btn" 
              [class.active]="activePreset() === 'this_month'"
              (click)="setPreset('this_month')">
              This Month
            </button>
            <button 
              type="button" 
              class="calendar-preset-btn" 
              [class.active]="activePreset() === 'last_month'"
              (click)="setPreset('last_month')">
              Last Month
            </button>
            <button 
              type="button" 
              class="calendar-preset-btn" 
              [class.active]="activePreset() === 'last_30_days'"
              (click)="setPreset('last_30_days')">
              Last 30 Days
            </button>
          </div>
        </div>

        <!-- Weekday Headers (Mon - Sun) -->
        <div class="calendar-weekday-bar">
          <div class="calendar-weekday">Mon</div>
          <div class="calendar-weekday">Tue</div>
          <div class="calendar-weekday">Wed</div>
          <div class="calendar-weekday">Thu</div>
          <div class="calendar-weekday">Fri</div>
          <div class="calendar-weekday">Sat</div>
          <div class="calendar-weekday text-danger">Sun</div>
        </div>

        <!-- 7-Column Days Grid -->
        <div class="calendar-grid">
          @for (cell of calendarCells(); track cell.dateStr) {
            <div 
              class="calendar-day-cell"
              [class.calendar-day-overflow]="!cell.isCurrentMonth"
              [class.calendar-day-today]="cell.isToday"
              [class.calendar-day-selected]="cell.isSelected"
              [class.calendar-day-has-sales]="cell.hasSales"
              (click)="selectDay(cell)">
              
              <div class="calendar-cell-top">
                <span class="calendar-date-num">{{ cell.dayNumber }}</span>
                @if (cell.isToday) {
                  <span class="calendar-today-badge">TODAY</span>
                }
              </div>

              <div class="calendar-cell-body">
                @if (cell.isCurrentMonth) {
                  @if (cell.hasSales) {
                    <span class="calendar-rev-badge" [title]="cell.revenue | inr">
                      {{ formatCompact(cell.revenue) }}
                    </span>
                    <div class="calendar-order-meta">
                      <span class="calendar-dot"></span>
                      <span>{{ cell.orders }} {{ cell.orders === 1 ? 'order' : 'orders' }}</span>
                    </div>
                  } @else {
                    <span class="calendar-empty-day">—</span>
                  }
                }
              </div>
            </div>
          }
        </div>

        <!-- Selected Day Spotlight Panel -->
        @if (selectedDay(); as day) {
          <div class="calendar-spotlight-card">
            <div class="spotlight-header">
              <div>
                <h4>
                  <span class="bi bi-calendar-event me-1 text-success"></span>
                  {{ formatSelectedDate(day.dateStr) }}
                  @if (day.isToday) {
                    <span class="badge bg-success ms-2">Today</span>
                  }
                </h4>
                <p class="text-muted small mb-0">Daily operational metrics and order distribution</p>
              </div>
              <div>
                <a routerLink="/admin/orders" class="btn btn-sm btn-outline-success">
                  <span class="bi bi-box-seam me-1"></span> View Orders
                </a>
              </div>
            </div>

            <div class="spotlight-grid">
              <div class="spotlight-metric">
                <div class="metric-label">Daily Revenue</div>
                <div class="metric-value text-success">{{ day.revenue | inr }}</div>
              </div>
              <div class="spotlight-metric">
                <div class="metric-label">Orders Placed</div>
                <div class="metric-value">{{ day.orders }}</div>
              </div>
              <div class="spotlight-metric">
                <div class="metric-label">Avg Order Basket</div>
                <div class="metric-value">
                  {{ day.orders > 0 ? (day.revenue / day.orders | inr) : '₹0' }}
                </div>
              </div>
              <div class="spotlight-metric">
                <div class="metric-label">Month Revenue Share</div>
                <div class="metric-value text-primary">
                  {{ dayRevenueShare(day.revenue) }}%
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Split Analytical Columns: Top Products & Orders By Status -->
      <div class="split">
        <section class="panel">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">
              <span class="bi bi-trophy text-warning me-2"></span> Top Performing Products
            </h3>
            <span class="badge bg-light text-dark border">{{ data.topProducts.length }} items</span>
          </div>

          @if (data.topProducts.length === 0) {
            <p class="text-muted small py-3">No product sales recorded in this timeframe.</p>
          } @else {
            @for (item of data.topProducts; track item.name) {
              <div class="summary-row py-2 border-bottom d-flex justify-content-between align-items-center">
                <div>
                  <div class="fw-semibold text-ink">{{ item.name }}</div>
                  <small class="text-muted">{{ item.quantity }} units sold</small>
                </div>
                <strong class="text-ink">{{ item.revenue | inr }}</strong>
              </div>
            }
          }
        </section>

        <section class="panel">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">
              <span class="bi bi-pie-chart text-info me-2"></span> Orders By Status
            </h3>
            <span class="badge bg-light text-dark border">{{ data.orders }} total</span>
          </div>

          @if (data.ordersByStatus.length === 0) {
            <p class="text-muted small py-3">No status data available.</p>
          } @else {
            @for (row of data.ordersByStatus; track row.status) {
              <div class="summary-row py-2 border-bottom d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                  <span class="status-pill {{ row.status }} px-2 py-1 rounded small">
                    {{ label(row.status) }}
                  </span>
                </div>
                <div>
                  <strong class="me-2">{{ row.count }}</strong>
                  <span class="text-muted small">({{ statusPercentage(row.count, data.orders) }}%)</span>
                </div>
              </div>
            }
          }
        </section>
      </div>
    }
  `,
})
export class AdminReportsPage {
  private readonly admin = inject(AdminService);

  readonly report = signal<ReportData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  
  // Active month cursor
  readonly currentMonth = signal<Date>(new Date());
  readonly selectedDateStr = signal<string | null>(null);
  readonly activePreset = signal<'this_month' | 'last_month' | 'last_30_days' | 'custom'>('this_month');

  // Month Title e.g. "October 2026"
  readonly monthTitle = computed(() => {
    const d = this.currentMonth();
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  });

  // Label for current preset
  readonly activePresetLabel = computed(() => {
    switch (this.activePreset()) {
      case 'this_month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'last_30_days': return 'Last 30 Days';
      default: return 'Custom Range';
    }
  });

  // Calendar Day Cells Computation
  readonly calendarCells = computed<CalendarDayCell[]>(() => {
    const activeDate = this.currentMonth();
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const todayStr = this.formatDateIso(new Date());
    const selStr = this.selectedDateStr();

    // Map of sales by date from API report
    const dayMap = new Map<string, { orders: number; revenue: number }>();
    if (this.report()?.ordersByDay) {
      for (const item of this.report()!.ordersByDay) {
        dayMap.set(item.date, { orders: item.orders, revenue: item.revenue });
      }
    }

    const cells: CalendarDayCell[] = [];

    // First day of current month
    const firstDayOfMonth = new Date(year, month, 1);
    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Weekday of the 1st (0 = Sun, 1 = Mon ... 6 = Sat)
    // Convert so Mon = 0, Sun = 6
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

    // Previous month overflow days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dateStr = this.formatDateIso(prevDate);
      cells.push({
        dayNumber: dNum,
        dateStr,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        revenue: 0,
        orders: 0,
        hasSales: false,
      });
    }

    // Current month days (1 to daysInMonth)
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dateStr = this.formatDateIso(currDate);
      const sales = dayMap.get(dateStr) || { orders: 0, revenue: 0 };
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selStr || (!selStr && isToday);

      cells.push({
        dayNumber: d,
        dateStr,
        isCurrentMonth: true,
        isToday,
        isSelected,
        revenue: sales.revenue,
        orders: sales.orders,
        hasSales: sales.orders > 0 || sales.revenue > 0,
      });
    }

    // Trailing overflow days to fill the final week
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const needed = 7 - remainder;
      for (let d = 1; d <= needed; d++) {
        const nextDate = new Date(year, month + 1, d);
        const dateStr = this.formatDateIso(nextDate);
        cells.push({
          dayNumber: d,
          dateStr,
          isCurrentMonth: false,
          isToday: false,
          isSelected: false,
          revenue: 0,
          orders: 0,
          hasSales: false,
        });
      }
    }

    return cells;
  });

  // Selected Day Data
  readonly selectedDay = computed<CalendarDayCell | null>(() => {
    const cells = this.calendarCells();
    const sel = cells.find((c) => c.isSelected && c.isCurrentMonth);
    if (sel) return sel;
    // Default to today if in current month
    const todayCell = cells.find((c) => c.isToday && c.isCurrentMonth);
    if (todayCell) return todayCell;
    // Otherwise first day of the month
    return cells.find((c) => c.isCurrentMonth) || null;
  });

  // Daily average orders in the period
  readonly dailyAvgOrders = computed(() => {
    const data = this.report();
    if (!data || data.orders === 0) return 0;
    const activeDays = new Date(this.currentMonth().getFullYear(), this.currentMonth().getMonth() + 1, 0).getDate();
    return Math.round((data.orders / activeDays) * 10) / 10;
  });

  // Peak sales day calculation
  readonly peakDayInfo = computed(() => {
    const byDay = this.report()?.ordersByDay || [];
    if (!byDay.length) return { label: 'None', revenue: 0 };
    const sorted = [...byDay].sort((a, b) => b.revenue - a.revenue);
    const peak = sorted[0];
    if (!peak || peak.revenue === 0) return { label: 'None', revenue: 0 };
    const dateObj = new Date(peak.date);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { label, revenue: peak.revenue };
  });

  constructor() {
    // Select today initially
    this.selectedDateStr.set(this.formatDateIso(new Date()));
    void this.loadForCurrentMonth();
  }

  prevMonth() {
    const cur = this.currentMonth();
    this.currentMonth.set(new Date(cur.getFullYear(), cur.getMonth() - 1, 1));
    this.activePreset.set('custom');
    void this.loadForCurrentMonth();
  }

  nextMonth() {
    const cur = this.currentMonth();
    this.currentMonth.set(new Date(cur.getFullYear(), cur.getMonth() + 1, 1));
    this.activePreset.set('custom');
    void this.loadForCurrentMonth();
  }

  jumpToToday() {
    const now = new Date();
    this.currentMonth.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.selectedDateStr.set(this.formatDateIso(now));
    this.activePreset.set('this_month');
    void this.loadForCurrentMonth();
  }

  setPreset(preset: 'this_month' | 'last_month' | 'last_30_days') {
    this.activePreset.set(preset);
    const now = new Date();
    if (preset === 'this_month') {
      this.currentMonth.set(new Date(now.getFullYear(), now.getMonth(), 1));
      this.selectedDateStr.set(this.formatDateIso(now));
      void this.loadForCurrentMonth();
    } else if (preset === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      this.currentMonth.set(lastMonth);
      this.selectedDateStr.set(this.formatDateIso(lastMonth));
      const year = lastMonth.getFullYear();
      const month = lastMonth.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      void this.load(from, to);
    } else if (preset === 'last_30_days') {
      const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      this.currentMonth.set(new Date(now.getFullYear(), now.getMonth(), 1));
      this.selectedDateStr.set(this.formatDateIso(now));
      void this.load(this.formatDateIso(fromDate), this.formatDateIso(now));
    }
  }

  selectDay(cell: CalendarDayCell) {
    if (!cell.isCurrentMonth) return;
    this.selectedDateStr.set(cell.dateStr);
  }

  refresh() {
    void this.loadForCurrentMonth();
  }

  formatCompact(val: number): string {
    if (!val) return '';
    if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
    if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'k';
    return '₹' + Math.round(val);
  }

  formatSelectedDate(dateStr: string): string {
    if (!dateStr) return '';
    // Format e.g. "Wednesday, 28 October 2026"
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  dayRevenueShare(dayRev: number): string {
    const total = this.report()?.revenue || 0;
    if (total <= 0 || !dayRev) return '0';
    return ((dayRev / total) * 100).toFixed(1);
  }

  statusPercentage(count: number, total: number): string {
    if (!total || count <= 0) return '0';
    return Math.round((count / total) * 100).toString();
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }

  private formatDateIso(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async loadForCurrentMonth() {
    const activeDate = this.currentMonth();
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    await this.load(from, to);
  }

  private async load(from: string, to: string) {
    this.loading.set(true);
    try {
      const data = await this.admin.report(from, to);
      this.report.set(data);
      this.error.set('');
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }
}
