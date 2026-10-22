import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { GstInvoiceLedgerEntry, GstReportData, GstSlabSummary, StoreGstProfile } from '../core/models';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-admin-gst-billing-page',
  imports: [CommonModule, FormsModule, InrPipe],
  template: `
    <!-- Top Action Bar (hidden when printing) -->
    <div class="section-head mb-3 no-print">
      <div>
        <h2>GST Business Statement & Billing Desk</h2>
        <p class="muted mb-0">Consolidated single-page tax statement, HSN classification, and downloadable retail invoices</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-outline-dark d-inline-flex align-items-center gap-1" type="button" (click)="exportCsv()">
          <i class="bi bi-filetype-csv"></i> Export CSV
        </button>
        <button
          class="btn btn-dark d-inline-flex align-items-center gap-1"
          type="button"
          style="background: #0e6b4f; border-color: #0e6b4f"
          (click)="downloadStatement()"
        >
          <i class="bi bi-download"></i> Download Statement Bill
        </button>
        <button class="btn btn-outline-secondary d-inline-flex align-items-center gap-1" type="button" (click)="printStatement()" title="Direct Print">
          <i class="bi bi-printer"></i> Print
        </button>
      </div>
    </div>

    <!-- Filter & Accounting Period Bar (hidden when printing) -->
    <div class="panel mb-3 p-3 no-print">
      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <!-- Period Preset Buttons -->
        <div class="btn-group btn-group-sm" role="group">
          <button
            type="button"
            class="btn"
            [class.btn-dark]="selectedPeriod() === 'today'"
            [class.btn-outline-dark]="selectedPeriod() !== 'today'"
            (click)="setPeriod('today')"
          >
            Today
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-dark]="selectedPeriod() === 'this_week'"
            [class.btn-outline-dark]="selectedPeriod() !== 'this_week'"
            (click)="setPeriod('this_week')"
          >
            This Week
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-dark]="selectedPeriod() === 'this_month'"
            [class.btn-outline-dark]="selectedPeriod() !== 'this_month'"
            (click)="setPeriod('this_month')"
          >
            This Month
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-dark]="selectedPeriod() === 'last_month'"
            [class.btn-outline-dark]="selectedPeriod() !== 'last_month'"
            (click)="setPeriod('last_month')"
          >
            Last Month
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-dark]="selectedPeriod() === 'custom'"
            [class.btn-outline-dark]="selectedPeriod() !== 'custom'"
            (click)="setPeriod('custom')"
          >
            Custom Range
          </button>
        </div>

        <!-- Custom Date Range Picker (shown when custom is selected) -->
        @if (selectedPeriod() === 'custom') {
          <div class="d-flex gap-2 align-items-center">
            <input type="date" class="form-control form-control-sm" [(ngModel)]="customFrom" />
            <span class="muted">to</span>
            <input type="date" class="form-control form-control-sm" [(ngModel)]="customTo" />
            <button class="btn btn-sm btn-dark" type="button" (click)="load()">Apply</button>
          </div>
        }

        <div class="muted small">
          Active Range: <strong>{{ report()?.period?.startDate | date:'mediumDate' }}</strong> — <strong>{{ report()?.period?.endDate | date:'mediumDate' }}</strong>
        </div>
      </div>
    </div>

    <!-- Printable & Downloadable Official GST Statement Document Container -->
    <div class="gst-document-sheet panel p-4 bg-white" id="gstPrintArea">
      <!-- Official Business Letterhead -->
      <div class="gst-letterhead border-bottom pb-3 mb-3">
        <div class="row align-items-start">
          <div class="col-8">
            <h3 class="mb-0 fw-bold">{{ store()?.businessName }}</h3>
            <p class="text-muted small mb-1">Trade Name: <strong>{{ store()?.tradeName }}</strong> · CIN: {{ store()?.cin }}</p>
            <p class="small mb-1">{{ store()?.address }}</p>
            <p class="small mb-0 text-muted">
              Email: {{ store()?.email }} | Phone: {{ store()?.phone }} | FSSAI: {{ store()?.fssaiLicense }}
            </p>
          </div>
          <div class="col-4 text-end">
            <span class="badge bg-dark text-white p-2 mb-2 fs-6">GST TAX INVOICE STATEMENT</span>
            <div class="font-monospace small">
              <div><strong>GSTIN:</strong> {{ store()?.gstin }}</div>
              <div><strong>State:</strong> {{ store()?.state }} (Code: {{ store()?.stateCode }})</div>
              <div><strong>Tax Type:</strong> {{ store()?.taxType }}</div>
              <div><strong>Generated:</strong> {{ todayDate | date:'medium' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Financial Summary Cards -->
      @if (report()?.summary; as s) {
        <div class="stat-grid mb-4">
          <div class="panel stat border">
            <span>Gross Business Turnover</span>
            <strong class="text-dark">{{ s.totalGrossTurnover | inr }}</strong>
            <small class="muted">Across {{ s.totalOrders }} completed orders</small>
          </div>
          <div class="panel stat border">
            <span>Taxable Value (Pre-Tax)</span>
            <strong class="text-primary">{{ s.totalTaxableValue | inr }}</strong>
            <small class="muted">Net revenue base for GST</small>
          </div>
          <div class="panel stat border">
            <span>CGST (Central Tax)</span>
            <strong class="text-success">{{ s.totalCgst | inr }}</strong>
            <small class="muted">50% Central share</small>
          </div>
          <div class="panel stat border">
            <span>SGST (State Tax)</span>
            <strong class="text-success">{{ s.totalSgst | inr }}</strong>
            <small class="muted">50% Karnataka state share</small>
          </div>
        </div>

        <div class="p-3 mb-4 rounded border d-flex justify-content-between align-items-center" style="background: #f8fafc;">
          <div>
            <h5 class="mb-0 fw-bold">Total GST Tax Liability (CGST + SGST)</h5>
            <small class="text-muted">Total tax collected on behalf of Government for this period</small>
          </div>
          <div class="text-end">
            <strong class="fs-3 text-success font-monospace">{{ s.totalGstCollected | inr }}</strong>
          </div>
        </div>
      }

      <!-- HSN & Tax Slab Breakdown Table -->
      <div class="mb-4">
        <h5 class="fw-bold mb-2">1. HSN / GST Rate Slab Summary</h5>
        <div class="table-wrap">
          <table class="plain border">
            <thead class="table-light">
              <tr>
                <th>GST Rate Slab</th>
                <th>HSN Codes</th>
                <th class="text-center">Units Sold</th>
                <th class="text-end">Taxable Amount</th>
                <th class="text-end">CGST (₹)</th>
                <th class="text-end">SGST (₹)</th>
                <th class="text-end">Total Tax (₹)</th>
                <th class="text-end">Gross Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              @for (slab of report()?.slabs || []; track slab.rate) {
                <tr>
                  <td>
                    <strong>{{ slab.rate }}%</strong>
                    <div class="muted small">{{ slab.label }}</div>
                  </td>
                  <td class="font-monospace small">{{ slab.hsn }}</td>
                  <td class="text-center font-monospace">{{ slab.itemsCount }}</td>
                  <td class="text-end font-monospace">{{ slab.taxableValue | inr }}</td>
                  <td class="text-end font-monospace text-success">{{ slab.cgst | inr }}</td>
                  <td class="text-end font-monospace text-success">{{ slab.sgst | inr }}</td>
                  <td class="text-end font-monospace fw-bold text-success">{{ slab.totalTax | inr }}</td>
                  <td class="text-end font-monospace fw-bold">{{ slab.gross | inr }}</td>
                </tr>
              }
            </tbody>
            <tfoot class="table-light fw-bold">
              @if (report()?.summary; as s) {
                <tr>
                  <td colspan="3">Consolidated Totals</td>
                  <td class="text-end font-monospace">{{ s.totalTaxableValue | inr }}</td>
                  <td class="text-end font-monospace text-success">{{ s.totalCgst | inr }}</td>
                  <td class="text-end font-monospace text-success">{{ s.totalSgst | inr }}</td>
                  <td class="text-end font-monospace text-success">{{ s.totalGstCollected | inr }}</td>
                  <td class="text-end font-monospace">{{ s.totalGrossTurnover | inr }}</td>
                </tr>
              }
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Transaction Invoices Ledger Table -->
      <div class="mb-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="fw-bold mb-0">2. Order-by-Order Retail Tax Ledger</h5>
          <span class="muted small">Total: {{ (report()?.invoices || []).length }} Invoices</span>
        </div>

        @if ((report()?.invoices || []).length === 0) {
          <div class="text-center p-4 border rounded bg-light">
            <p class="muted mb-0">No delivered orders found in this period range.</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table class="plain border">
              <thead class="table-light">
                <tr>
                  <th>Invoice No.</th>
                  <th>Date & Time</th>
                  <th>Customer (B2C)</th>
                  <th>Payment</th>
                  <th class="text-end">Taxable (₹)</th>
                  <th class="text-end">CGST (₹)</th>
                  <th class="text-end">SGST (₹)</th>
                  <th class="text-end">Total GST (₹)</th>
                  <th class="text-end">Total Bill (₹)</th>
                  <th class="text-center no-print" style="min-width: 140px;">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of report()?.invoices || []; track inv.id) {
                  <tr>
                    <td class="font-monospace fw-semibold">{{ inv.invoiceNumber }}</td>
                    <td class="small">{{ inv.createdAt | date:'short' }}</td>
                    <td>
                      <div>{{ inv.customerName }}</div>
                      @if (inv.customerPhone) {
                        <small class="muted">{{ inv.customerPhone }}</small>
                      }
                    </td>
                    <td>
                      <span class="badge bg-light text-dark border">{{ inv.paymentMethod }}</span>
                    </td>
                    <td class="text-end font-monospace">{{ inv.taxableAmount | inr }}</td>
                    <td class="text-end font-monospace text-muted">{{ inv.cgstAmount | inr }}</td>
                    <td class="text-end font-monospace text-muted">{{ inv.sgstAmount | inr }}</td>
                    <td class="text-end font-monospace fw-semibold text-success">{{ inv.totalGst | inr }}</td>
                    <td class="text-end font-monospace fw-bold">{{ inv.grossAmount | inr }}</td>
                    <td class="text-center no-print">
                      <div class="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          class="btn btn-outline-dark py-0 px-2"
                          (click)="viewInvoiceModal(inv)"
                          title="View Bill Details"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          class="btn btn-dark py-0 px-2 d-inline-flex align-items-center gap-1"
                          (click)="downloadInvoice(inv)"
                          title="Download Tax Invoice Bill"
                        >
                          <i class="bi bi-download"></i> Bill
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Legal Declaration & Signature Footer -->
      <div class="gst-declaration pt-3 border-top mt-4">
        <div class="row align-items-end">
          <div class="col-8 small text-muted">
            <p class="mb-1"><strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct under Indian Goods and Services Tax Rules, 2017.</p>
            <p class="mb-0">Whether tax is payable on reverse charge basis: <strong>No</strong></p>
          </div>
          <div class="col-4 text-end">
            <div style="height: 48px;"></div>
            <div class="border-top pt-1 small fw-bold">
              For {{ store()?.businessName }}<br />
              <span class="text-muted fw-normal">Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Individual Order Invoice Modal -->
    @if (activeInvoice()) {
      <div class="modal-sheet no-print" (click)="closeInvoiceModal()">
        <div class="sheet bg-white p-4" (click)="$event.stopPropagation()" style="max-width: 680px;">
          <div class="d-flex justify-content-between align-items-start border-bottom pb-2 mb-3">
            <div>
              <h4 class="mb-0 fw-bold">Tax Invoice: {{ activeInvoice()?.invoiceNumber }}</h4>
              <p class="muted small mb-0">Order: {{ activeInvoice()?.orderNumber }} · {{ activeInvoice()?.createdAt | date:'medium' }}</p>
            </div>
            <button type="button" class="btn-close" (click)="closeInvoiceModal()"></button>
          </div>

          <div class="row mb-3 small">
            <div class="col-6">
              <strong>Billed To:</strong>
              <div>{{ activeInvoice()?.customerName }}</div>
              <div>Phone: {{ activeInvoice()?.customerPhone || 'N/A' }}</div>
              <div>Destination: {{ activeInvoice()?.customerCity }}</div>
            </div>
            <div class="col-6 text-end">
              <strong>Billed By:</strong>
              <div>{{ store()?.businessName }}</div>
              <div>GSTIN: {{ store()?.gstin }}</div>
              <div>Payment: {{ activeInvoice()?.paymentMethod }} ({{ activeInvoice()?.paymentStatus }})</div>
            </div>
          </div>

          <table class="table table-sm border small mb-3">
            <thead class="table-light">
              <tr>
                <th>Item</th>
                <th>HSN</th>
                <th>Qty</th>
                <th class="text-end">Rate</th>
                <th class="text-end">Taxable</th>
                <th class="text-end">GST</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (it of activeInvoice()?.items || []; track it.name) {
                <tr>
                  <td>{{ it.name }}</td>
                  <td class="font-monospace">{{ it.hsn }}</td>
                  <td>{{ it.quantity }} {{ it.unit }}</td>
                  <td class="text-end font-monospace">{{ it.rate | inr }}</td>
                  <td class="text-end font-monospace">{{ it.taxableAmount | inr }}</td>
                  <td class="text-end font-monospace text-success">{{ it.totalGst | inr }} ({{ it.gstRate }}%)</td>
                  <td class="text-end font-monospace fw-semibold">{{ it.grossAmount | inr }}</td>
                </tr>
              }
            </tbody>
            <tfoot class="table-light fw-bold">
              <tr>
                <td colspan="4">Total Bill</td>
                <td class="text-end font-monospace">{{ activeInvoice()?.taxableAmount | inr }}</td>
                <td class="text-end font-monospace text-success">{{ activeInvoice()?.totalGst | inr }}</td>
                <td class="text-end font-monospace">{{ activeInvoice()?.grossAmount | inr }}</td>
              </tr>
            </tfoot>
          </table>

          <div class="d-flex justify-content-end gap-2 border-top pt-2">
            <button type="button" class="btn btn-outline-secondary" (click)="closeInvoiceModal()">Close</button>
            <button type="button" class="btn btn-outline-dark d-inline-flex align-items-center gap-1" (click)="printStatement()">
              <i class="bi bi-printer"></i> Print
            </button>
            <button
              type="button"
              class="btn btn-dark d-inline-flex align-items-center gap-1"
              style="background: #0e6b4f; border-color: #0e6b4f"
              (click)="downloadInvoice()"
            >
              <i class="bi bi-download"></i> Download Invoice Bill
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminGstBillingPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);

  readonly report = signal<GstReportData | null>(null);
  readonly store = signal<StoreGstProfile | null>(null);
  readonly loading = signal(false);

  readonly selectedPeriod = signal<string>('this_month');
  customFrom = '';
  customTo = '';
  readonly todayDate = new Date();

  readonly activeInvoice = signal<GstInvoiceLedgerEntry | null>(null);

  constructor() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    this.customFrom = firstDay;
    this.customTo = today;

    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const query: { period?: string; from?: string; to?: string } = {
        period: this.selectedPeriod(),
      };
      if (this.selectedPeriod() === 'custom') {
        query.from = this.customFrom;
        query.to = this.customTo;
      }
      const data = await this.admin.gstReport(query);
      this.report.set(data);
      this.store.set(data.store);
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'Failed to generate GST statement');
    } finally {
      this.loading.set(false);
    }
  }

  setPeriod(period: string) {
    this.selectedPeriod.set(period);
    void this.load();
  }

  printStatement() {
    window.print();
  }

  viewInvoiceModal(inv: GstInvoiceLedgerEntry) {
    this.activeInvoice.set(inv);
  }

  closeInvoiceModal() {
    this.activeInvoice.set(null);
  }

  /**
   * Generates and downloads a complete standalone, styled GST Statement Bill document
   */
  downloadStatement() {
    const r = this.report();
    const s = this.store();
    if (!r || !s) {
      this.toasts.error('Statement data is still loading');
      return;
    }

    const fmtInr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const slabsHtml = r.slabs.map((slab) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>${slab.rate}%</strong><br/><small style="color: #64748b;">${slab.label}</small></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${slab.hsn}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${slab.itemsCount}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(slab.taxableValue)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(slab.cgst)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(slab.sgst)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${fmtInr(slab.totalTax)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(slab.gross)}</td>
      </tr>
    `).join('');

    const invoicesHtml = r.invoices.map((inv) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${inv.invoiceNumber}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px;">${new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${inv.customerName}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${inv.paymentMethod}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(inv.taxableAmount)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #64748b;">${fmtInr(inv.cgstAmount)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #64748b;">${fmtInr(inv.sgstAmount)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${fmtInr(inv.totalGst)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(inv.grossAmount)}</td>
      </tr>
    `).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GST Tax Statement - ${s.businessName} - ${this.selectedPeriod()}</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .doc-card { max-width: 960px; margin: 0 auto; background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #0f172a; color: #ffffff; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-box { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
    .kpi-box span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .kpi-box strong { font-size: 20px; font-family: monospace; }
    .tax-highlight { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; }
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; font-size: 12px; }
    @media print {
      body { background: #fff; padding: 0; }
      .doc-card { border: none; box-shadow: none; padding: 0; width: 100%; max-width: 100%; }
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="doc-card">
    <div style="text-align: right; margin-bottom: 12px;" class="print-btn">
      <button onclick="window.print()" style="padding: 6px 14px; background: #0e6b4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <div class="header-row">
      <div>
        <h2 style="margin: 0 0 4px 0;">${s.businessName}</h2>
        <div style="color: #64748b; font-size: 13px; margin-bottom: 4px;">Trade Name: <strong>${s.tradeName}</strong> · CIN: ${s.cin}</div>
        <div style="font-size: 12px; margin-bottom: 4px;">${s.address}</div>
        <div style="font-size: 12px; color: #64748b;">Email: ${s.email} | Phone: ${s.phone} | FSSAI: ${s.fssaiLicense}</div>
      </div>
      <div style="text-align: right; font-size: 12px;">
        <span class="badge">OFFICIAL GST STATEMENT</span>
        <div style="margin-top: 8px; font-family: monospace;">
          <div><strong>GSTIN:</strong> ${s.gstin}</div>
          <div><strong>State:</strong> ${s.state} (Code: ${s.stateCode})</div>
          <div><strong>Period:</strong> ${new Date(r.period.startDate).toLocaleDateString('en-IN')} to ${new Date(r.period.endDate).toLocaleDateString('en-IN')}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <span>GROSS BUSINESS TURNOVER</span>
        <strong style="color: #0f172a;">${fmtInr(r.summary.totalGrossTurnover)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">${r.summary.totalOrders} total orders</small>
      </div>
      <div class="kpi-box">
        <span>TAXABLE VALUE (PRE-TAX)</span>
        <strong style="color: #0284c7;">${fmtInr(r.summary.totalTaxableValue)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">Net retail revenue</small>
      </div>
      <div class="kpi-box">
        <span>CGST (CENTRAL TAX)</span>
        <strong style="color: #059669;">${fmtInr(r.summary.totalCgst)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">50% Central share</small>
      </div>
      <div class="kpi-box">
        <span>SGST (STATE TAX)</span>
        <strong style="color: #059669;">${fmtInr(r.summary.totalSgst)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">50% State share</small>
      </div>
    </div>

    <div class="tax-highlight">
      <div>
        <h4 style="margin: 0; color: #065f46;">Total GST Liability (CGST + SGST)</h4>
        <small style="color: #047857;">Collected for Government remission under GST Rules 2017</small>
      </div>
      <div style="font-size: 26px; font-weight: bold; font-family: monospace; color: #065f46;">
        ${fmtInr(r.summary.totalGstCollected)}
      </div>
    </div>

    <h4 style="margin: 0 0 8px 0;">1. HSN / GST Rate Slab Summary</h4>
    <table>
      <thead>
        <tr>
          <th>GST Rate</th>
          <th>HSN Codes</th>
          <th style="text-align: center;">Units</th>
          <th style="text-align: right;">Taxable Amount</th>
          <th style="text-align: right;">CGST (₹)</th>
          <th style="text-align: right;">SGST (₹)</th>
          <th style="text-align: right;">Total Tax (₹)</th>
          <th style="text-align: right;">Gross (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${slabsHtml}
      </tbody>
      <tfoot style="background: #f1f5f9; font-weight: bold;">
        <tr>
          <td colspan="3" style="padding: 8px; border: 1px solid #e2e8f0;">TOTALS</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(r.summary.totalTaxableValue)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(r.summary.totalCgst)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(r.summary.totalSgst)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(r.summary.totalGstCollected)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(r.summary.totalGrossTurnover)}</td>
        </tr>
      </tfoot>
    </table>

    <h4 style="margin: 0 0 8px 0;">2. Order-by-Order Retail Tax Ledger (${r.invoices.length} Invoices)</h4>
    <table>
      <thead>
        <tr>
          <th>Invoice No.</th>
          <th>Date</th>
          <th>Customer (B2C)</th>
          <th style="text-align: center;">Payment</th>
          <th style="text-align: right;">Taxable</th>
          <th style="text-align: right;">CGST</th>
          <th style="text-align: right;">SGST</th>
          <th style="text-align: right;">GST Total</th>
          <th style="text-align: right;">Bill Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoicesHtml}
      </tbody>
    </table>

    <div class="signature-row">
      <div style="max-width: 65%; color: #64748b;">
        <p style="margin: 0 0 4px 0;"><strong>Declaration:</strong> We declare that this statement shows the actual price of the goods described and that all particulars are true and correct under Indian GST Rules.</p>
        <p style="margin: 0;">Whether tax is payable on reverse charge basis: <strong>No</strong></p>
      </div>
      <div style="text-align: right;">
        <div style="height: 48px;"></div>
        <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: bold;">
          For ${s.businessName}<br/>
          <span style="font-weight: normal; color: #64748b;">Authorized Signatory</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ZapBasket_GST_Statement_${this.selectedPeriod()}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toasts.show('📥 GST Statement Bill downloaded successfully');
  }

  /**
   * Generates and downloads an individual customer tax invoice bill
   */
  downloadInvoice(targetInv?: GstInvoiceLedgerEntry | null) {
    const inv = targetInv || this.activeInvoice();
    const s = this.store();
    if (!inv || !s) {
      this.toasts.error('No invoice selected to download');
      return;
    }

    const fmtInr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const itemsHtml = (inv.items || []).map((it) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${it.name}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${it.hsn}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${it.quantity} ${it.unit}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(it.rate)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(it.taxableAmount)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(it.totalGst)} (${it.gstRate}%)</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(it.grossAmount)}</td>
      </tr>
    `).join('');

    const invoiceDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${inv.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .bill-card { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header-row { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .info-grid { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; }
    .totals-box { width: 280px; margin-left: auto; font-size: 13px; margin-bottom: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; }
    @media print {
      body { background: #fff; padding: 0; }
      .bill-card { border: none; box-shadow: none; padding: 0; width: 100%; }
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="bill-card">
    <div style="text-align: right; margin-bottom: 12px;" class="print-btn">
      <button onclick="window.print()" style="padding: 6px 14px; background: #0e6b4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <div class="header-row">
      <div>
        <h2 style="margin: 0 0 4px 0;">${s.businessName}</h2>
        <div style="font-size: 12px; color: #64748b;">${s.address}</div>
        <div style="font-size: 12px; color: #64748b;">Email: ${s.email} | Phone: ${s.phone} | FSSAI: ${s.fssaiLicense}</div>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #0f172a; color: #ffffff;">RETAIL TAX INVOICE</span>
        <div style="margin-top: 6px; font-family: monospace; font-size: 12px;">
          <div><strong>Invoice No:</strong> ${inv.invoiceNumber}</div>
          <div><strong>Order Ref:</strong> ${inv.orderNumber}</div>
          <div><strong>Date:</strong> ${new Date(inv.createdAt).toLocaleString('en-IN')}</div>
          <div><strong>GSTIN:</strong> ${s.gstin}</div>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <strong>Billed To (Customer):</strong>
        <div>${inv.customerName}</div>
        <div>Phone: ${inv.customerPhone || 'N/A'}</div>
        <div>Delivery Destination: ${inv.customerCity}</div>
        <div>State Code: ${s.stateCode} (${s.state})</div>
      </div>
      <div style="text-align: right;">
        <strong>Payment Information:</strong>
        <div>Method: <strong>${inv.paymentMethod}</strong></div>
        <div>Status: <span style="color: #047857; font-weight: bold;">${inv.paymentStatus.toUpperCase()}</span></div>
        <div>Place of Supply: ${s.state}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th>HSN</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Rate</th>
          <th style="text-align: right;">Taxable Amount</th>
          <th style="text-align: right;">GST Rate</th>
          <th style="text-align: right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row">
        <span>Taxable Subtotal:</span>
        <span style="font-family: monospace;">${fmtInr(inv.taxableAmount)}</span>
      </div>
      <div class="totals-row">
        <span>CGST (Central Tax):</span>
        <span style="font-family: monospace; color: #047857;">${fmtInr(inv.cgstAmount)}</span>
      </div>
      <div class="totals-row">
        <span>SGST (State Tax):</span>
        <span style="font-family: monospace; color: #047857;">${fmtInr(inv.sgstAmount)}</span>
      </div>
      <div class="totals-row" style="font-size: 15px; font-weight: bold; padding-top: 6px; border-top: 2px solid #0f172a;">
        <span>Invoice Total:</span>
        <span style="font-family: monospace;">${fmtInr(inv.grossAmount)}</span>
      </div>
    </div>

    <div class="signature-row">
      <div style="max-width: 65%;">
        <p style="margin: 0 0 4px 0;"><strong>Declaration:</strong> This invoice shows the actual price of the goods described under the Goods and Services Tax Act.</p>
        <p style="margin: 0;">Supply is meant for retail consumption.</p>
      </div>
      <div style="text-align: right; font-weight: bold; color: #0f172a;">
        <div style="height: 40px;"></div>
        <div style="border-top: 1px solid #0f172a; padding-top: 4px;">
          For ${s.businessName}<br/>
          <span style="font-weight: normal; color: #64748b;">Authorized Signatory</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([invoiceDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ZapBasket_Tax_Invoice_${inv.orderNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toasts.show(`📥 Downloaded Invoice Bill for ${inv.orderNumber}`);
  }

  exportCsv() {
    const r = this.report();
    if (!r || !r.invoices || r.invoices.length === 0) {
      this.toasts.error('No invoice data available to export');
      return;
    }

    const headers = ['Invoice Number', 'Order Number', 'Date', 'Customer Name', 'Phone', 'City', 'Payment Method', 'Taxable Value', 'CGST', 'SGST', 'Total GST', 'Gross Total'];
    const rows = r.invoices.map((inv) => [
      inv.invoiceNumber,
      inv.orderNumber,
      new Date(inv.createdAt).toISOString(),
      `"${inv.customerName}"`,
      inv.customerPhone,
      inv.customerCity,
      inv.paymentMethod,
      inv.taxableAmount,
      inv.cgstAmount,
      inv.sgstAmount,
      inv.totalGst,
      inv.grossAmount,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ZapBasket_GST_Report_${this.selectedPeriod()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toasts.show('CSV Report exported');
  }
}
