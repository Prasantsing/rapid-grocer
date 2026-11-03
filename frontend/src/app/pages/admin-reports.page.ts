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
  templateUrl: './admin-reports.page.html',
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
